'use server';

import { and, eq, ilike, or, desc, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  product,
  productVariant,
  productImage,
} from '@frc-e-commerce/db/schema';
import { requireTenantId } from '@/lib/tenant';
import { requireSessionCapability } from '@/lib/auth/permissions';

export type PosSearchResultProduct = {
  productId: string;
  name: string;
  basePrice: number;
  imageUrl: string | null;
  variantCount: number;
  /** Si tiene una sola variante, su info para shortcut directo al detalle */
  singleVariant: PosVariantOption | null;
};

const searchSchema = z.object({
  query: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(50).default(20),
});

/**
 * Busca productos activos del tenant que matcheen query en name/slug o que tengan
 * alguna variante cuyo SKU/name contenga el término. Retorna agrupado por producto.
 */
export async function posSearchProducts(input: z.infer<typeof searchSchema>): Promise<
  | { ok: true; results: PosSearchResultProduct[] }
  | { ok: false; error: string }
> {
  try {
    const tenantId = await requireTenantId();
    await requireSessionCapability(tenantId, 'pos.sell');
    const parsed = searchSchema.parse(input);
    const q = `%${parsed.query}%`;

    // Step 1: matching products by name/slug
    const productsByName = await db
      .select({
        id: product.id,
        name: product.name,
        basePrice: product.basePrice,
      })
      .from(product)
      .where(
        and(
          eq(product.tenantId, tenantId),
          eq(product.status, 'active'),
          or(ilike(product.name, q), ilike(product.slug, q))
        )
      )
      .limit(parsed.limit);

    // Step 2: matching products via variants (sku/name)
    const productsByVariant = await db
      .select({
        id: product.id,
        name: product.name,
        basePrice: product.basePrice,
      })
      .from(productVariant)
      .innerJoin(product, eq(productVariant.productId, product.id))
      .where(
        and(
          eq(product.tenantId, tenantId),
          eq(product.status, 'active'),
          eq(productVariant.active, true),
          or(ilike(productVariant.sku, q), ilike(productVariant.name, q))
        )
      )
      .limit(parsed.limit);

    // Merge unique
    const productMap = new Map<string, { id: string; name: string; basePrice: number }>();
    for (const p of [...productsByName, ...productsByVariant]) productMap.set(p.id, p);
    const productIds = Array.from(productMap.keys());
    if (productIds.length === 0) return { ok: true, results: [] };

    // Step 3: variantes activas + count + single-variant detail
    const variants = await db
      .select({
        productId: productVariant.productId,
        variantId: productVariant.id,
        sku: productVariant.sku,
        price: productVariant.price,
        stock: productVariant.stock,
        name: productVariant.name,
        color: productVariant.color,
        size: productVariant.size,
        sizeKind: productVariant.sizeKind,
        attributes: productVariant.attributes,
      })
      .from(productVariant)
      .where(
        and(
          inArray(productVariant.productId, productIds),
          eq(productVariant.active, true)
        )
      );

    const variantsByProduct = new Map<string, typeof variants>();
    for (const v of variants) {
      const list = variantsByProduct.get(v.productId) ?? [];
      list.push(v);
      variantsByProduct.set(v.productId, list);
    }

    // Step 4: imagen default por producto (variantId IS NULL, position 0)
    const defaultImages = await db
      .select({
        productId: productImage.productId,
        url: productImage.url,
      })
      .from(productImage)
      .where(
        and(
          inArray(productImage.productId, productIds),
          sql`${productImage.variantId} IS NULL`
        )
      )
      .orderBy(productImage.position);
    const imageByProduct = new Map<string, string>();
    for (const i of defaultImages) {
      if (!imageByProduct.has(i.productId)) imageByProduct.set(i.productId, i.url);
    }

    // Construir resultados
    const results: PosSearchResultProduct[] = [];
    for (const p of productMap.values()) {
      const vList = variantsByProduct.get(p.id) ?? [];
      const productImg = imageByProduct.get(p.id) ?? null;
      const single: PosVariantOption | null =
        vList.length === 1 && vList[0]
          ? {
              variantId: vList[0].variantId,
              productId: p.id,
              productName: p.name,
              sku: vList[0].sku,
              variantName: vList[0].name,
              color: vList[0].color,
              size: vList[0].size,
              sizeKind: vList[0].sizeKind,
              attributesLabel: formatVariantLabel(
                vList[0].color,
                vList[0].size,
                vList[0].attributes ?? {}
              ),
              price: vList[0].price,
              stock: vList[0].stock,
              imageUrl: productImg,
            }
          : null;
      results.push({
        productId: p.id,
        name: p.name,
        basePrice: p.basePrice,
        imageUrl: productImg,
        variantCount: vList.length,
        singleVariant: single,
      });
    }

    return { ok: true, results: results.slice(0, parsed.limit) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error de búsqueda' };
  }
}

// ── Variantes de un producto (para diálogo 2) ──────────────────────────────────

export type PosVariantOption = {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  variantName: string;
  color: string | null;
  size: string | null;
  sizeKind: string | null;
  attributesLabel: string;
  price: number;
  stock: number;
  imageUrl: string | null;
};

export async function getProductVariants(productId: string): Promise<{
  ok: true;
  variants: PosVariantOption[];
} | { ok: false; error: string }> {
  try {
    const tenantId = await requireTenantId();
    await requireSessionCapability(tenantId, 'pos.sell');

    const [p] = await db
      .select({ id: product.id, name: product.name })
      .from(product)
      .where(and(eq(product.id, productId), eq(product.tenantId, tenantId)))
      .limit(1);
    if (!p) return { ok: false, error: 'Producto no encontrado' };

    const variants = await db
      .select({
        variantId: productVariant.id,
        sku: productVariant.sku,
        name: productVariant.name,
        price: productVariant.price,
        stock: productVariant.stock,
        color: productVariant.color,
        size: productVariant.size,
        sizeKind: productVariant.sizeKind,
        attributes: productVariant.attributes,
      })
      .from(productVariant)
      .where(
        and(
          eq(productVariant.productId, productId),
          eq(productVariant.active, true)
        )
      )
      .orderBy(productVariant.color, productVariant.size, productVariant.name);

    // Imágenes por variante
    const images = await db
      .select({
        variantId: productImage.variantId,
        url: productImage.url,
        position: productImage.position,
      })
      .from(productImage)
      .where(eq(productImage.productId, productId))
      .orderBy(productImage.position);
    const imageByVariant = new Map<string, string>();
    let defaultImg: string | null = null;
    for (const i of images) {
      if (!i.variantId) {
        if (!defaultImg) defaultImg = i.url;
        continue;
      }
      if (!imageByVariant.has(i.variantId)) imageByVariant.set(i.variantId, i.url);
    }

    return {
      ok: true,
      variants: variants.map((v) => ({
        variantId: v.variantId,
        productId,
        productName: p.name,
        sku: v.sku,
        variantName: v.name,
        color: v.color,
        size: v.size,
        sizeKind: v.sizeKind,
        attributesLabel: formatVariantLabel(v.color, v.size, v.attributes ?? {}),
        price: v.price,
        stock: v.stock,
        imageUrl: imageByVariant.get(v.variantId) ?? defaultImg,
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error' };
  }
}

function formatVariantLabel(
  color: string | null | undefined,
  size: string | null | undefined,
  attrs: Record<string, string>
): string {
  const parts: string[] = [];
  if (color) parts.push(color);
  if (size) parts.push(`Talle ${size}`);
  for (const [k, v] of Object.entries(attrs)) {
    parts.push(`${k}: ${v}`);
  }
  return parts.join(' · ');
}
