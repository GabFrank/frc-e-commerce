import Link from 'next/link';
import { and, desc, eq, gt, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { product, productVariant, productImage } from '@frc-e-commerce/db/schema';
import { requireTenantId } from '@/lib/tenant';
import { Button } from '@/components/ui/button';
import {
  ProductsListClient,
  type ProductRow,
  type ProductsFilters,
} from '@/components/admin/products/ProductsListClient';

const VALID_STATUS = ['active', 'draft', 'archived'] as const;
const VALID_GENDER = ['masculino', 'femenino', 'unisex', 'infantil'] as const;
const VALID_PAGE_SIZES = [25, 50, 100];

type SearchParams = Promise<{
  q?: string;
  status?: string;
  stock?: string;
  gender?: string;
  page?: string;
  pageSize?: string;
}>;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const tenantId = await requireTenantId();
  const params = await searchParams;

  // Parse + validate
  const q = (params.q ?? '').trim();
  const status = params.status && VALID_STATUS.includes(params.status as (typeof VALID_STATUS)[number])
    ? params.status
    : 'all';
  const stock = params.stock === 'with' || params.stock === 'without' ? params.stock : 'all';
  const gender = params.gender && VALID_GENDER.includes(params.gender as (typeof VALID_GENDER)[number])
    ? params.gender
    : 'all';
  const pageSize = VALID_PAGE_SIZES.includes(Number(params.pageSize))
    ? Number(params.pageSize)
    : 25;
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);

  // ── WHERE: filtros directos sobre product (q, status, gender) ────────────────
  const conditions = [eq(product.tenantId, tenantId)];
  if (q) {
    // Match en name/slug O en SKU de alguna variante.
    const variantMatch = db
      .select({ id: productVariant.productId })
      .from(productVariant)
      .where(
        and(
          eq(productVariant.tenantId, tenantId),
          ilike(productVariant.sku, `%${q}%`)
        )
      );
    conditions.push(
      or(
        ilike(product.name, `%${q}%`),
        ilike(product.slug, `%${q}%`),
        inArray(product.id, variantMatch)
      )!
    );
  }
  if (status !== 'all') {
    conditions.push(eq(product.status, status as (typeof VALID_STATUS)[number]));
  }
  if (gender !== 'all') {
    conditions.push(eq(product.gender, gender as (typeof VALID_GENDER)[number]));
  }

  // Filtro de stock: usa subquery sobre productVariant agregado.
  // Calculamos stock por producto y filtramos en HAVING via subquery.
  if (stock !== 'all') {
    const stockAggregate = db
      .select({
        productId: productVariant.productId,
        totalStock: sql<number>`cast(coalesce(sum(${productVariant.stock}), 0) as int)`.as(
          'total_stock'
        ),
      })
      .from(productVariant)
      .where(eq(productVariant.tenantId, tenantId))
      .groupBy(productVariant.productId)
      .as('stock_agg');
    if (stock === 'with') {
      // Productos cuyo stock total > 0
      const idsWithStock = db
        .select({ id: stockAggregate.productId })
        .from(stockAggregate)
        .where(gt(stockAggregate.totalStock, 0));
      conditions.push(inArray(product.id, idsWithStock));
    } else {
      // Sin stock: stock_agg <= 0 O sin filas en agregado (producto sin variantes)
      const idsNoStock = db
        .select({ id: stockAggregate.productId })
        .from(stockAggregate)
        .where(lte(stockAggregate.totalStock, 0));
      conditions.push(
        or(
          inArray(product.id, idsNoStock),
          sql`${product.id} NOT IN (SELECT product_id FROM ${productVariant} WHERE tenant_id = ${tenantId})`
        )!
      );
    }
  }

  const whereClause = and(...conditions);

  // ── Count total para paginación ───────────────────────────────────────────────
  const [{ value: total }] = await db
    .select({ value: sql<number>`cast(count(*) as int)` })
    .from(product)
    .where(whereClause);

  // ── Productos paginados ──────────────────────────────────────────────────────
  const offset = (page - 1) * pageSize;
  const products = await db
    .select({
      id: product.id,
      name: product.name,
      slug: product.slug,
      status: product.status,
      gender: product.gender,
      basePrice: product.basePrice,
      currency: product.currency,
      createdAt: product.createdAt,
    })
    .from(product)
    .where(whereClause)
    .orderBy(desc(product.createdAt))
    .limit(pageSize)
    .offset(offset);

  const productIds = products.map((p) => p.id);

  // ── Resumen de variantes ─────────────────────────────────────────────────────
  const summaries = productIds.length
    ? await db
        .select({
          productId: productVariant.productId,
          variantCount: sql<number>`cast(count(*) as int)`,
          colorCount: sql<number>`cast(count(distinct ${productVariant.color}) filter (where ${productVariant.color} is not null) as int)`,
          sizeCount: sql<number>`cast(count(distinct ${productVariant.size}) filter (where ${productVariant.size} is not null) as int)`,
          totalStock: sql<number>`cast(coalesce(sum(${productVariant.stock}), 0) as int)`,
          firstSku: sql<string>`min(${productVariant.sku})`,
        })
        .from(productVariant)
        .where(
          and(
            eq(productVariant.tenantId, tenantId),
            inArray(productVariant.productId, productIds)
          )
        )
        .groupBy(productVariant.productId)
    : [];
  const summaryMap = new Map(summaries.map((s) => [s.productId, s]));

  // ── Imagen default por producto (variantId IS NULL, menor position) ──────────
  const defaultImages = productIds.length
    ? await db
        .select({
          productId: productImage.productId,
          url: productImage.url,
          position: productImage.position,
        })
        .from(productImage)
        .where(
          and(
            eq(productImage.tenantId, tenantId),
            inArray(productImage.productId, productIds),
            sql`${productImage.variantId} IS NULL`
          )
        )
        .orderBy(productImage.position)
    : [];
  const imageByProduct = new Map<string, string>();
  for (const img of defaultImages) {
    if (!imageByProduct.has(img.productId)) imageByProduct.set(img.productId, img.url);
  }

  const rows: ProductRow[] = products.map((p) => {
    const s = summaryMap.get(p.id);
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      status: p.status,
      gender: p.gender,
      basePrice: p.basePrice,
      currency: p.currency,
      imageUrl: imageByProduct.get(p.id) ?? null,
      variantCount: s?.variantCount ?? 0,
      colorCount: s?.colorCount ?? 0,
      sizeCount: s?.sizeCount ?? 0,
      totalStock: s?.totalStock ?? 0,
      firstSku: s?.firstSku ?? null,
    };
  });

  const filters: ProductsFilters = { q, status, stock, gender, page, pageSize };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Productos</h1>
        <Link href="/admin/productos/new">
          <Button>+ Nuevo producto</Button>
        </Link>
      </div>

      <ProductsListClient rows={rows} total={total} filters={filters} />
    </div>
  );
}
