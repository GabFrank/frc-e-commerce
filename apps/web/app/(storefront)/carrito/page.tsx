import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, inArray } from 'drizzle-orm';
import { getCurrentTenant } from '@/lib/tenant';
import { formatMoney } from '@frc-e-commerce/shared-utils';
import type { CurrencyCode } from '@frc-e-commerce/shared-utils';
import { Button } from '@/components/ui/button';
import { CartLineControls } from '@/components/storefront/cart-line-controls';
import { getCartWithLines } from '@/lib/actions/cart';
import { db } from '@/lib/db';
import { product, productVariant, productImage } from '@frc-e-commerce/db/schema';

interface CartLineDisplay {
  id: string;
  variantId: string;
  variantName: string;
  productName: string;
  productSlug: string;
  unitPrice: number;
  currency: string;
  qty: number;
  maxStock: number;
  imageUrl: string | null;
}

export default async function CarritoPage() {
  const tenant = await getCurrentTenant().catch(() => null);
  if (!tenant) notFound();

  const cartData = await getCartWithLines();
  const currency = tenant.defaultCurrency ?? 'PYG';

  let lines: CartLineDisplay[] = [];

  if (cartData && cartData.lines.length > 0) {
    const variantIds = cartData.lines.map((l) => l.variantId);
    const variants = await db
      .select()
      .from(productVariant)
      .where(inArray(productVariant.id, variantIds));
    const productIds = Array.from(new Set(variants.map((v) => v.productId)));
    const products = productIds.length
      ? await db.select().from(product).where(inArray(product.id, productIds))
      : [];
    const images = productIds.length
      ? await db.select().from(productImage).where(inArray(productImage.productId, productIds))
      : [];
    const firstImageByProduct = new Map<string, string>();
    for (const img of images.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
      if (!firstImageByProduct.has(img.productId)) firstImageByProduct.set(img.productId, img.url);
    }
    const variantById = new Map(variants.map((v) => [v.id, v]));
    const productById = new Map(products.map((p) => [p.id, p]));

    lines = cartData.lines
      .map((line) => {
        const v = variantById.get(line.variantId);
        if (!v) return null;
        const p = productById.get(v.productId);
        if (!p) return null;
        return {
          id: line.id,
          variantId: line.variantId,
          variantName: v.name,
          productName: p.name,
          productSlug: p.slug,
          unitPrice: line.unitPrice,
          currency: cartData.cart.currency,
          qty: line.quantity,
          maxStock: v.stock,
          imageUrl: firstImageByProduct.get(p.id) ?? null,
        };
      })
      .filter((l): l is CartLineDisplay => l !== null);
  }

  const total = lines.reduce((acc, l) => acc + l.unitPrice * l.qty, 0);
  const formattedTotal = formatMoney({ amount: total, currency: currency as CurrencyCode });

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold">Tu carrito</h1>
        <p className="mb-6 text-zinc-500">El carrito está vacío.</p>
        <Button asChild>
          <Link href="/productos">Ver productos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Tu carrito</h1>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Tabla de líneas */}
        <div className="flex-1 space-y-3">
          {lines.map((line) => (
            <div key={line.id} className="flex gap-4 rounded-xl border p-4">
              {/* Imagen placeholder */}
              <div className="h-20 w-20 shrink-0 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-300">
                {line.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={line.imageUrl}
                    alt={line.productName}
                    className="h-full w-full rounded-lg object-cover"
                  />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                )}
              </div>

              {/* Info */}
              <div className="flex flex-1 flex-col gap-1">
                <Link
                  href={`/productos/${line.productSlug}`}
                  className="text-sm font-medium hover:underline"
                >
                  {line.productName}
                </Link>
                {line.variantName && (
                  <p className="text-xs text-zinc-500">{line.variantName}</p>
                )}
                <p className="text-sm font-semibold text-primary">
                  {formatMoney({ amount: line.unitPrice, currency: line.currency as CurrencyCode })}
                </p>
                <CartLineControls
                  lineId={line.id}
                  initialQty={line.qty}
                  maxStock={line.maxStock}
                />
              </div>

              {/* Subtotal */}
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold">
                  {formatMoney({
                    amount: line.unitPrice * line.qty,
                    currency: line.currency as CurrencyCode,
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Resumen */}
        <div className="lg:w-72 shrink-0">
          <div className="rounded-xl border p-5 space-y-4">
            <h2 className="font-semibold">Resumen del pedido</h2>
            <div className="space-y-2 text-sm">
              {lines.map((l) => (
                <div key={l.id} className="flex justify-between text-zinc-600">
                  <span className="truncate max-w-[160px]">
                    {l.productName} × {l.qty}
                  </span>
                  <span>
                    {formatMoney({
                      amount: l.unitPrice * l.qty,
                      currency: l.currency as CurrencyCode,
                    })}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t pt-3 flex justify-between font-semibold">
              <span>Total</span>
              <span>{formattedTotal}</span>
            </div>
            <Button asChild className="w-full">
              <Link href="/checkout">Continuar al checkout</Link>
            </Button>
            <Link
              href="/productos"
              className="block text-center text-xs text-zinc-500 hover:underline"
            >
              Seguir comprando
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
