import { notFound } from 'next/navigation';
import Link from 'next/link';
import { inArray } from 'drizzle-orm';
import { getCurrentTenant } from '@/lib/tenant';
import { formatMoney } from '@frc-e-commerce/shared-utils';
import type { CurrencyCode } from '@frc-e-commerce/shared-utils';
import { CheckoutForm } from '@/components/storefront/checkout-form';
import { getCartWithLines } from '@/lib/actions/cart';
import { db } from '@/lib/db';
import { product, productVariant } from '@frc-e-commerce/db/schema';

interface CheckoutLine {
  id: string;
  productName: string;
  variantName: string;
  qty: number;
  unitPrice: number;
  currency: string;
}

export default async function CheckoutPage() {
  const tenant = await getCurrentTenant().catch(() => null);
  if (!tenant) notFound();

  const cartData = await getCartWithLines();
  const currency = tenant.defaultCurrency ?? 'PYG';

  let lines: CheckoutLine[] = [];
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
          productName: p.name,
          variantName: v.name,
          qty: line.quantity,
          unitPrice: line.unitPrice,
          currency: cartData.cart.currency,
        };
      })
      .filter((l): l is CheckoutLine => l !== null);
  }

  const cart = { lines };
  const total = cart.lines.reduce((acc, l) => acc + l.unitPrice * l.qty, 0);
  const formattedTotal = formatMoney({ amount: total, currency: currency as CurrencyCode });

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold">Checkout</h1>
        <p className="mb-6 text-muted-foreground">Tu carrito está vacío. Agregá productos antes de continuar.</p>
        <Link
          href="/productos"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Ver productos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">Inicio</Link>
        <span>/</span>
        <Link href="/carrito" className="hover:underline">Carrito</Link>
        <span>/</span>
        <span className="text-foreground">Checkout</span>
      </nav>

      <h1 className="mb-8 text-2xl font-bold">Finalizar compra</h1>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Formulario principal */}
        <div className="flex-1">
          <CheckoutForm tenantName={tenant.name} />
        </div>

        {/* Resumen lateral */}
        <aside className="lg:w-72 shrink-0">
          <div className="rounded-xl border p-5 space-y-4">
            <h2 className="font-semibold">Tu pedido</h2>
            <ul className="space-y-2 text-sm">
              {cart.lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span className="truncate text-muted-foreground">
                    {l.productName}
                    {l.variantName && ` (${l.variantName})`}
                    {' '}× {l.qty}
                  </span>
                  <span className="shrink-0 font-medium">
                    {formatMoney({
                      amount: l.unitPrice * l.qty,
                      currency: l.currency as CurrencyCode,
                    })}
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-t pt-3 flex justify-between font-semibold">
              <span>Total</span>
              <span>{formattedTotal}</span>
            </div>
            <Link
              href="/carrito"
              className="block text-center text-xs text-muted-foreground hover:underline"
            >
              Modificar carrito
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
