export const dynamic = 'force-dynamic';

export default function CartPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold" style={{ color: 'var(--color-primary)' }}>
        Carrito
      </h1>
      <p className="mt-4 text-zinc-500">
        Carrito vacío. Implementación de checkout pendiente — usa Vendure Order API.
      </p>
    </div>
  );
}
