'use server';

import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  product,
  productImage,
  productVariant,
  productVariantAvgCost,
  purchaseOrder,
  purchaseOrderLine,
} from '@frc-e-commerce/db/schema';
import { requireTenantId } from '@/lib/tenant';
import { requireSessionCapability } from '@/lib/auth/permissions';

export type PurchaseVariantOption = {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  color: string | null;
  size: string | null;
  sizeKind: string | null;
  variantName: string;
  imageUrl: string | null;
  currentStock: number;
  /** Precio de venta vigente (en moneda primary del tenant) — para calcular margen. */
  currentSellPrice: number;
  avgCostInPrimary: number;
  /** Último costo unitario para esta variante. Si supplierId/currencyCode están dados, prioriza match exacto. */
  lastUnitCost: {
    value: number;
    currencyCode: string;
    receivedAt: Date | null;
  } | null;
};

const searchSchema = z.object({
  query: z.string().trim().max(200).default(''),
  supplierId: z.string().uuid().optional(),
  currencyCode: z.string().max(10).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  /** Offset para paginación. Solo aplica a búsquedas con query (no al top-20). */
  offset: z.number().int().min(0).default(0),
});

/** Quita variantes "Default" (color=null AND size=null) cuando su producto tiene
 *  otra variante activa con color/talle. La Default queda solo si es la única. */
async function filterOutDummyDefaults(
  tenantId: string,
  variantIds: string[]
): Promise<string[]> {
  if (variantIds.length === 0) return variantIds;

  const rows = await db
    .select({
      id: productVariant.id,
      productId: productVariant.productId,
      color: productVariant.color,
      size: productVariant.size,
    })
    .from(productVariant)
    .where(
      and(eq(productVariant.tenantId, tenantId), inArray(productVariant.id, variantIds))
    );

  const defaultCandidates = rows.filter((r) => !r.color && !r.size);
  if (defaultCandidates.length === 0) return variantIds;

  const candidateProductIds = Array.from(
    new Set(defaultCandidates.map((r) => r.productId))
  );
  const siblings = await db
    .selectDistinct({ productId: productVariant.productId })
    .from(productVariant)
    .where(
      and(
        eq(productVariant.tenantId, tenantId),
        inArray(productVariant.productId, candidateProductIds),
        eq(productVariant.active, true),
        or(isNotNull(productVariant.color), isNotNull(productVariant.size))
      )
    );
  const productsWithRealVariants = new Set(siblings.map((r) => r.productId));

  const excludeIds = new Set(
    defaultCandidates
      .filter((r) => productsWithRealVariants.has(r.productId))
      .map((r) => r.id)
  );

  return variantIds.filter((id) => !excludeIds.has(id));
}

/** Empareja variantes para usar como líneas de PO. Filtra archivadas y "Default" cuando hay variantes reales. */
export async function searchVariantsForPurchase(
  input: z.infer<typeof searchSchema>
): Promise<
  | { ok: true; results: PurchaseVariantOption[]; hasMore: boolean }
  | { ok: false; error: string }
> {
  try {
    const tenantId = await requireTenantId();
    await requireSessionCapability(tenantId, 'purchase.write');
    const parsed = searchSchema.parse(input);
    const query = parsed.query.trim();

    let variantIds: string[] = [];

    let rawCount = 0;
    if (query.length === 0) {
      // Sin query: las N variantes más compradas en los últimos 90 días. Sin paginación.
      const since = new Date(Date.now() - 90 * 86400_000);
      const top = await db
        .select({
          variantId: purchaseOrderLine.variantId,
          totalQty: sql<number>`sum(${purchaseOrderLine.quantity})`.mapWith(Number),
        })
        .from(purchaseOrderLine)
        .innerJoin(purchaseOrder, eq(purchaseOrder.id, purchaseOrderLine.purchaseOrderId))
        .where(
          and(
            eq(purchaseOrder.tenantId, tenantId),
            gte(purchaseOrder.createdAt, since),
            ne(purchaseOrder.status, 'cancelled')
          )
        )
        .groupBy(purchaseOrderLine.variantId)
        .orderBy(desc(sql`sum(${purchaseOrderLine.quantity})`))
        .limit(parsed.limit);
      variantIds = top.map((r) => r.variantId);
      rawCount = top.length;
    } else {
      const q = `%${query}%`;
      // Buscar a nivel de variante: por SKU, name de variante, o name/slug de producto padre.
      // Ordenamos por sku para que la paginación sea estable entre páginas.
      const matches = await db
        .select({ id: productVariant.id, sku: productVariant.sku })
        .from(productVariant)
        .innerJoin(product, eq(product.id, productVariant.productId))
        .where(
          and(
            eq(productVariant.tenantId, tenantId),
            eq(productVariant.active, true),
            or(
              ilike(productVariant.sku, q),
              ilike(productVariant.name, q),
              ilike(productVariant.color, q),
              ilike(product.name, q),
              ilike(product.slug, q)
            )
          )
        )
        .orderBy(asc(productVariant.sku))
        .limit(parsed.limit)
        .offset(parsed.offset);
      variantIds = matches.map((r) => r.id);
      rawCount = matches.length;
    }

    // Filtra "Default" cuando el producto tiene variantes reales con color/talle
    variantIds = await filterOutDummyDefaults(tenantId, variantIds);

    // Si la página vino llena (rawCount == limit), asumimos que hay más resultados.
    // Sólo aplica a búsquedas con query (la top-N tiene tope fijo y no se pagina).
    const hasMore = query.length > 0 && rawCount === parsed.limit;

    if (variantIds.length === 0) return { ok: true, results: [], hasMore };

    // Trae detalles + avg cost + producto + imagen default
    const rows = await db
      .select({
        variantId: productVariant.id,
        productId: productVariant.productId,
        productName: product.name,
        sku: productVariant.sku,
        color: productVariant.color,
        size: productVariant.size,
        sizeKind: productVariant.sizeKind,
        variantName: productVariant.name,
        currentStock: productVariant.stock,
        currentSellPrice: productVariant.price,
        avgCostInPrimary: productVariantAvgCost.avgCostInPrimary,
      })
      .from(productVariant)
      .innerJoin(product, eq(product.id, productVariant.productId))
      .leftJoin(productVariantAvgCost, eq(productVariantAvgCost.variantId, productVariant.id))
      .where(
        and(
          eq(productVariant.tenantId, tenantId),
          eq(productVariant.active, true),
          inArray(productVariant.id, variantIds)
        )
      );

    // Imagen por variante: primero `productImage.variantId = variantId`, fallback a producto sin variantId
    const images = await db
      .select({
        productId: productImage.productId,
        variantId: productImage.variantId,
        url: productImage.url,
        position: productImage.position,
      })
      .from(productImage)
      .where(
        and(
          eq(productImage.tenantId, tenantId),
          inArray(productImage.productId, rows.map((r) => r.productId))
        )
      );
    const imageByVariant = new Map<string, string>();
    const imageByProduct = new Map<string, string>();
    // Primer paso: imagen por variante explícita
    const sortedImgs = [...images].sort((a, b) => a.position - b.position);
    for (const img of sortedImgs) {
      if (img.variantId && !imageByVariant.has(img.variantId)) {
        imageByVariant.set(img.variantId, img.url);
      }
      if (!img.variantId && !imageByProduct.has(img.productId)) {
        imageByProduct.set(img.productId, img.url);
      }
    }

    // Último costo: subquery por variantId. Si supplier/currency dados, prioriza ese match.
    const lastCostByVariant = new Map<string, PurchaseVariantOption['lastUnitCost']>();

    if (parsed.supplierId && parsed.currencyCode) {
      // 1) intento con match exacto supplier + currency
      const matched = await db
        .select({
          variantId: purchaseOrderLine.variantId,
          unitCost: purchaseOrderLine.unitCostInCurrency,
          currencyCode: purchaseOrder.currencyCode,
          receivedAt: purchaseOrder.receivedAt,
        })
        .from(purchaseOrderLine)
        .innerJoin(purchaseOrder, eq(purchaseOrder.id, purchaseOrderLine.purchaseOrderId))
        .where(
          and(
            eq(purchaseOrder.tenantId, tenantId),
            eq(purchaseOrder.supplierId, parsed.supplierId),
            eq(purchaseOrder.currencyCode, parsed.currencyCode),
            inArray(purchaseOrder.status, ['received', 'partially_received', 'placed']),
            inArray(purchaseOrderLine.variantId, variantIds)
          )
        )
        .orderBy(desc(purchaseOrder.placedAt), desc(purchaseOrder.createdAt));
      for (const m of matched) {
        if (lastCostByVariant.has(m.variantId)) continue;
        lastCostByVariant.set(m.variantId, {
          value: Number(m.unitCost),
          currencyCode: m.currencyCode,
          receivedAt: m.receivedAt,
        });
      }
    }

    // 2) fallback: cualquier PO no cancelada del tenant para variantes que aún no tengan lastCost
    const missing = variantIds.filter((id) => !lastCostByVariant.has(id));
    if (missing.length > 0) {
      const fallback = await db
        .select({
          variantId: purchaseOrderLine.variantId,
          unitCost: purchaseOrderLine.unitCostInCurrency,
          currencyCode: purchaseOrder.currencyCode,
          receivedAt: purchaseOrder.receivedAt,
        })
        .from(purchaseOrderLine)
        .innerJoin(purchaseOrder, eq(purchaseOrder.id, purchaseOrderLine.purchaseOrderId))
        .where(
          and(
            eq(purchaseOrder.tenantId, tenantId),
            ne(purchaseOrder.status, 'cancelled'),
            inArray(purchaseOrderLine.variantId, missing)
          )
        )
        .orderBy(desc(purchaseOrder.placedAt), desc(purchaseOrder.createdAt));
      for (const m of fallback) {
        if (lastCostByVariant.has(m.variantId)) continue;
        lastCostByVariant.set(m.variantId, {
          value: Number(m.unitCost),
          currencyCode: m.currencyCode,
          receivedAt: m.receivedAt,
        });
      }
    }

    const results: PurchaseVariantOption[] = rows.map((r) => ({
      variantId: r.variantId,
      productId: r.productId,
      productName: r.productName,
      sku: r.sku,
      color: r.color,
      size: r.size,
      sizeKind: r.sizeKind,
      variantName: r.variantName,
      imageUrl: imageByVariant.get(r.variantId) ?? imageByProduct.get(r.productId) ?? null,
      currentStock: r.currentStock,
      currentSellPrice: Number(r.currentSellPrice ?? 0),
      avgCostInPrimary: Number(r.avgCostInPrimary ?? 0),
      lastUnitCost: lastCostByVariant.get(r.variantId) ?? null,
    }));

    // Preservar orden de variantIds (importante para query vacío que devuelve por ranking)
    const order = new Map(variantIds.map((id, i) => [id, i]));
    results.sort((a, b) => (order.get(a.variantId) ?? 0) - (order.get(b.variantId) ?? 0));

    return { ok: true, results, hasMore };
  } catch (e) {
    console.error('[searchVariantsForPurchase] failed', e);
    const message =
      e instanceof Error && 'cause' in e && e.cause instanceof Error
        ? `${e.message} — cause: ${e.cause.message}`
        : e instanceof Error
          ? e.message
          : 'Error inesperado';
    return { ok: false, error: message };
  }
}

/** Trae las variantes activas de un producto específico mapeadas al shape de PO.
 *  Filtra la Default cuando el producto tiene variantes reales con color/talle. */
export async function getVariantsForProductPurchase(
  productId: string
): Promise<{ ok: true; results: PurchaseVariantOption[] } | { ok: false; error: string }> {
  try {
    const tenantId = await requireTenantId();
    await requireSessionCapability(tenantId, 'purchase.write');
    const rows = await db
      .select({ id: productVariant.id })
      .from(productVariant)
      .where(
        and(
          eq(productVariant.tenantId, tenantId),
          eq(productVariant.productId, productId),
          eq(productVariant.active, true)
        )
      );
    const allIds = rows.map((r) => r.id);
    // Mismo filtro que en el buscador: si hay variantes reales, oculta la Default
    const filteredIds = await filterOutDummyDefaults(tenantId, allIds);
    return enrichVariants(tenantId, filteredIds);
  } catch (e) {
    console.error('[getVariantsForProductPurchase] failed', e);
    const message =
      e instanceof Error && 'cause' in e && e.cause instanceof Error
        ? `${e.message} — cause: ${e.cause.message}`
        : e instanceof Error
          ? e.message
          : 'Error inesperado';
    return { ok: false, error: message };
  }
}

/** Dado un set de variantIds, devuelve el detalle enriched para PO.
 *  Exportada para que otras actions (ej. getDraftForEdit) puedan reutilizar. */
export async function enrichVariantsForPurchase(
  tenantId: string,
  variantIds: string[]
): Promise<{ ok: true; results: PurchaseVariantOption[] }> {
  return enrichVariants(tenantId, variantIds);
}

async function enrichVariants(
  tenantId: string,
  variantIds: string[]
): Promise<{ ok: true; results: PurchaseVariantOption[] }> {
  if (variantIds.length === 0) return { ok: true, results: [] };

  const rows = await db
    .select({
      variantId: productVariant.id,
      productId: productVariant.productId,
      productName: product.name,
      sku: productVariant.sku,
      color: productVariant.color,
      size: productVariant.size,
      sizeKind: productVariant.sizeKind,
      variantName: productVariant.name,
      currentStock: productVariant.stock,
      currentSellPrice: productVariant.price,
      avgCostInPrimary: productVariantAvgCost.avgCostInPrimary,
    })
    .from(productVariant)
    .innerJoin(product, eq(product.id, productVariant.productId))
    .leftJoin(productVariantAvgCost, eq(productVariantAvgCost.variantId, productVariant.id))
    .where(
      and(eq(productVariant.tenantId, tenantId), inArray(productVariant.id, variantIds))
    );

  const images = await db
    .select({
      productId: productImage.productId,
      variantId: productImage.variantId,
      url: productImage.url,
      position: productImage.position,
    })
    .from(productImage)
    .where(
      and(
        eq(productImage.tenantId, tenantId),
        inArray(productImage.productId, rows.map((r) => r.productId))
      )
    );
  const imageByVariant = new Map<string, string>();
  const imageByProduct = new Map<string, string>();
  for (const img of [...images].sort((a, b) => a.position - b.position)) {
    if (img.variantId && !imageByVariant.has(img.variantId)) {
      imageByVariant.set(img.variantId, img.url);
    }
    if (!img.variantId && !imageByProduct.has(img.productId)) {
      imageByProduct.set(img.productId, img.url);
    }
  }

  const results: PurchaseVariantOption[] = rows.map((r) => ({
    variantId: r.variantId,
    productId: r.productId,
    productName: r.productName,
    sku: r.sku,
    color: r.color,
    size: r.size,
    sizeKind: r.sizeKind,
    variantName: r.variantName,
    imageUrl: imageByVariant.get(r.variantId) ?? imageByProduct.get(r.productId) ?? null,
    currentStock: r.currentStock,
    currentSellPrice: Number(r.currentSellPrice ?? 0),
    avgCostInPrimary: Number(r.avgCostInPrimary ?? 0),
    lastUnitCost: null,
  }));

  return { ok: true, results };
}
