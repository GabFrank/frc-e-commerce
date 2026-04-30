import Link from 'next/link';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { product, productVariant } from '@frc-e-commerce/db/schema';
import { requireTenantId } from '@/lib/tenant';
import { Button } from '@/components/ui/button';
import { ProductStatusBadge } from '@/components/admin/products/ProductStatusBadge';

export default async function ProductsPage() {
  const tenantId = await requireTenantId();

  // Fetch products with aggregated variant count and total stock
  const products = await db
    .select({
      id: product.id,
      name: product.name,
      slug: product.slug,
      status: product.status,
      basePrice: product.basePrice,
      currency: product.currency,
      createdAt: product.createdAt,
    })
    .from(product)
    .where(eq(product.tenantId, tenantId))
    .orderBy(desc(product.createdAt));

  // Fetch variant summaries per product
  const variantSummaries = await db
    .select({
      productId: productVariant.productId,
      variantCount: sql<number>`cast(count(*) as int)`,
      totalStock: sql<number>`cast(coalesce(sum(${productVariant.stock}), 0) as int)`,
      firstSku: sql<string>`min(${productVariant.sku})`,
    })
    .from(productVariant)
    .where(eq(productVariant.tenantId, tenantId))
    .groupBy(productVariant.productId);

  const summaryMap = new Map(variantSummaries.map((v) => [v.productId, v]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Productos</h1>
        <Link href="/admin/productos/new">
          <Button>+ Nuevo producto</Button>
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
          <p className="text-zinc-500 text-sm mb-4">Aún no hay productos. Creá el primero.</p>
          <Link href="/admin/productos/new">
            <Button variant="outline">+ Nuevo producto</Button>
          </Link>
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-600 text-left">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">SKU / Variantes</th>
                <th className="px-3 py-2">Stock total</th>
                <th className="px-3 py-2">Precio base</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const summary = summaryMap.get(p.id);
                return (
                  <tr key={p.id} className="border-t hover:bg-zinc-50 transition-colors">
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-zinc-500">
                      {summary ? (
                        <span>
                          <span className="font-mono text-xs">{summary.firstSku}</span>
                          {summary.variantCount > 1 && (
                            <span className="ml-1 text-xs text-zinc-400">
                              +{summary.variantCount - 1} más
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">Sin variantes</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {summary ? summary.totalStock.toLocaleString('es-PY') : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {p.basePrice.toLocaleString('es-PY')}{' '}
                      <span className="text-xs text-zinc-400">{p.currency}</span>
                    </td>
                    <td className="px-3 py-2">
                      <ProductStatusBadge status={p.status} />
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/productos/${p.id}`}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
