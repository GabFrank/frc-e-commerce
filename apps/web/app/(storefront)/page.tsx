import Link from 'next/link';
import { getCurrentTenant } from '@/lib/tenant';
import { ProductCard } from '@/components/storefront/product-card';

// TODO: enable when product schema is added (Agent A)
// import { db } from '@/lib/db';
// import { product } from '@frc-e-commerce/db/schema';
// import { and, eq } from 'drizzle-orm';

// Placeholder products for development until Agent A delivers schema
const PLACEHOLDER_PRODUCTS = [
  { id: '1', slug: 'remera-basica', name: 'Remera básica', basePrice: 150000, currency: 'PYG', imageUrl: null },
  { id: '2', slug: 'pantalon-jean', name: 'Pantalón jean', basePrice: 280000, currency: 'PYG', imageUrl: null },
  { id: '3', slug: 'zapatillas-urban', name: 'Zapatillas urban', basePrice: 420000, currency: 'PYG', imageUrl: null },
  { id: '4', slug: 'buzo-hoodie', name: 'Buzo hoodie', basePrice: 320000, currency: 'PYG', imageUrl: null },
];

export default async function StorefrontHomePage() {
  const tenant = await getCurrentTenant().catch(() => null);

  if (!tenant) {
    return <LandingGenerico />;
  }

  // TODO: enable when product schema is added (Agent A)
  // const featuredProducts = await db
  //   .select()
  //   .from(product)
  //   .where(and(eq(product.tenantId, tenant.id), eq(product.status, 'active')))
  //   .limit(8);
  const featuredProducts = PLACEHOLDER_PRODUCTS;

  return (
    <div>
      {/* Hero */}
      <section className="border-b bg-zinc-50 py-16 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
            {tenant.name}
          </h1>
          {tenant.slogan && (
            <p className="mt-3 text-lg text-zinc-600">{tenant.slogan}</p>
          )}
          {!tenant.slogan && tenant.description && (
            <p className="mt-3 text-lg text-zinc-600">{tenant.description}</p>
          )}
          <div className="mt-6 flex items-center justify-center gap-4">
            <Link
              href="/productos"
              className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Ver productos
            </Link>
          </div>
        </div>
      </section>

      {/* Productos destacados */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Productos destacados</h2>
          <Link href="/productos" className="text-sm text-zinc-500 hover:underline">
            Ver todos
          </Link>
        </div>

        {featuredProducts.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed text-zinc-400">
            <p className="text-sm">Aún no hay productos disponibles.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {featuredProducts.map((p) => (
              <ProductCard
                key={p.id}
                slug={p.slug}
                name={p.name}
                basePrice={p.basePrice}
                currency={p.currency}
                imageUrl={p.imageUrl}
              />
            ))}
          </div>
        )}
      </section>

      {/* Contacto rápido */}
      {(tenant.contactEmail || tenant.contactPhone || tenant.contactWhatsapp) && (
        <section className="border-t bg-zinc-50 py-8">
          <div className="mx-auto max-w-6xl px-4 text-center">
            <h3 className="text-sm font-semibold text-zinc-700">Contacto</h3>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-sm text-zinc-600">
              {tenant.contactEmail && (
                <a href={`mailto:${tenant.contactEmail}`} className="hover:underline">
                  {tenant.contactEmail}
                </a>
              )}
              {tenant.contactPhone && (
                <a href={`tel:${tenant.contactPhone}`} className="hover:underline">
                  {tenant.contactPhone}
                </a>
              )}
              {tenant.contactWhatsapp && (
                <a
                  href={`https://wa.me/${tenant.contactWhatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  WhatsApp: {tenant.contactWhatsapp}
                </a>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function LandingGenerico() {
  return (
    <div className="flex flex-col items-center justify-center gap-8 py-24 px-4 text-center">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">FRC E-commerce Platform</h1>
        <p className="mt-3 text-lg text-zinc-600">
          Plataforma SaaS multi-tenant para tiendas online
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Para acceder a una tienda, ingresá al subdominio de tu tienda
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-zinc-50 transition-colors"
        >
          Ingresar
        </Link>
        <Link
          href="/register"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Crear tienda
        </Link>
      </div>
      <div className="mt-4 text-xs text-zinc-400">
        <a href="/api/health" className="hover:underline">Estado del servicio</a>
      </div>
    </div>
  );
}
