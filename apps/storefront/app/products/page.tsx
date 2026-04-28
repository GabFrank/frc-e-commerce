import Link from 'next/link';
import { searchProducts } from '../../lib/products';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const products = await searchProducts();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
        Productos
      </h1>

      {products.length === 0 ? (
        <p className="mt-8 text-zinc-500">
          No hay productos disponibles. Cargá productos desde el admin para empezar.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <Link
              key={p.productId}
              href={`/products/${p.slug}`}
              className="group flex flex-col rounded-2xl border border-zinc-200 p-4 transition hover:shadow-md dark:border-zinc-800"
            >
              {p.productAsset ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.productAsset.preview + '?preset=medium'}
                  alt={p.productName}
                  className="aspect-square w-full rounded-xl object-cover"
                />
              ) : (
                <div className="aspect-square w-full rounded-xl bg-zinc-100 dark:bg-zinc-800" />
              )}
              <div className="mt-4 flex flex-1 flex-col">
                <h2 className="font-semibold group-hover:underline">{p.productName}</h2>
                <p className="mt-2 text-sm text-zinc-500">
                  {formatPrice(p.priceWithTax.min, p.currencyCode)}
                  {p.priceWithTax.max !== p.priceWithTax.min
                    ? ` - ${formatPrice(p.priceWithTax.max, p.currencyCode)}`
                    : ''}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'PYG' ? 0 : 2,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}
