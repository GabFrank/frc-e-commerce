import { notFound } from 'next/navigation';
import { getProductBySlug } from '../../../lib/products';

export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <div>
          {product.featuredAsset ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.featuredAsset.preview + '?preset=large'}
              alt={product.name}
              className="w-full rounded-2xl object-cover"
            />
          ) : (
            <div className="aspect-square w-full rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
          )}
        </div>

        <div>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: 'var(--color-primary)' }}
          >
            {product.name}
          </h1>

          <div
            className="mt-4 prose prose-zinc dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: product.description }}
          />

          <div className="mt-8 space-y-3">
            {product.variants.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div>
                  <p className="font-semibold">{v.name}</p>
                  <p className="text-sm text-zinc-500">SKU: {v.sku}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatPrice(v.priceWithTax, v.currencyCode)}</p>
                  <p className="text-xs text-zinc-500">{v.stockLevel}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="mt-8 w-full rounded-full px-6 py-3 text-white"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            Agregar al carrito
          </button>
        </div>
      </div>
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
