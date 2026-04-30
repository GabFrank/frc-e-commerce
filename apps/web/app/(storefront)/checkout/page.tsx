import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCurrentTenant } from '@/lib/tenant';
import { formatMoney } from '@frc-e-commerce/shared-utils';
import type { CurrencyCode } from '@frc-e-commerce/shared-utils';
import { CheckoutForm } from '@/components/storefront/checkout-form';

// TODO: enable when cart schema is added (Agent B)
// import { getOrCreateCart } from '@/lib/actions/cart';

// Stub cart summary until Agent B delivers
const STUB_CART_SUMMARY = {
  lines: [
    { id: 'line-1', productName: 'Remera básica', variantName: 'Talle M', qty: 2, unitPrice: 150000, currency: 'PYG' },
    { id: 'line-2', productName: 'Pantalón jean', variantName: 'Talle 34', qty: 1, unitPrice: 280000, currency: 'PYG' },
  ],
};

export default async function CheckoutPage() {
  const tenant = await getCurrentTenant().catch(() => null);
  if (!tenant) notFound();

  // TODO: replace with real cart
  // const cart = await getOrCreateCart();
  const cart = STUB_CART_SUMMARY;
  const currency = tenant.defaultCurrency ?? 'PYG';
  const total = cart.lines.reduce((acc, l) => acc + l.unitPrice * l.qty, 0);
  const formattedTotal = formatMoney({ amount: total, currency: currency as CurrencyCode });

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold">Checkout</h1>
        <p className="mb-6 text-zinc-500">Tu carrito está vacío. Agregá productos antes de continuar.</p>
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
      <nav className="mb-6 flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/" className="hover:underline">Inicio</Link>
        <span>/</span>
        <Link href="/carrito" className="hover:underline">Carrito</Link>
        <span>/</span>
        <span className="text-zinc-800">Checkout</span>
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
                  <span className="truncate text-zinc-600">
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
              className="block text-center text-xs text-zinc-500 hover:underline"
            >
              Modificar carrito
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
