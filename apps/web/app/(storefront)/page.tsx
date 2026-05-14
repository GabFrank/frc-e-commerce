import Link from 'next/link';
import { and, asc, eq } from 'drizzle-orm';
import { getCurrentTenant } from '@/lib/tenant';
import { ProductCard } from '@/components/storefront/product-card';
import { db } from '@/lib/db';
import { product, productImage } from '@frc-e-commerce/db/schema';

export default async function StorefrontHomePage() {
  const tenant = await getCurrentTenant().catch(() => null);

  if (!tenant) {
    return <LandingGenerico />;
  }

  const featuredProductsRaw = await db
    .select()
    .from(product)
    .where(and(eq(product.tenantId, tenant.id), eq(product.status, 'active')))
    .orderBy(asc(product.createdAt))
    .limit(8);

  const images = featuredProductsRaw.length
    ? await db.select().from(productImage).where(eq(productImage.tenantId, tenant.id))
    : [];
  const firstImageByProduct = new Map<string, string>();
  for (const img of images.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
    if (!firstImageByProduct.has(img.productId)) firstImageByProduct.set(img.productId, img.url);
  }

  const featuredProducts = featuredProductsRaw.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    basePrice: p.basePrice,
    currency: p.currency,
    imageUrl: firstImageByProduct.get(p.id) ?? null,
  }));

  return (
    <div>
      {/* Hero */}
      <section className="border-b bg-muted/50 py-10 text-center sm:py-16">
        <div className="mx-auto max-w-3xl px-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            {tenant.name}
          </h1>
          {tenant.slogan && (
            <p className="mt-3 text-base text-muted-foreground sm:text-lg">{tenant.slogan}</p>
          )}
          {!tenant.slogan && tenant.description && (
            <p className="mt-3 text-base text-muted-foreground sm:text-lg">{tenant.description}</p>
          )}
          <div className="mt-6 flex items-center justify-center gap-4">
            <Link
              href="/productos"
              className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Ver productos
            </Link>
          </div>
        </div>
      </section>

      {/* Productos destacados */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold sm:text-2xl">Productos destacados</h2>
          <Link href="/productos" className="text-sm text-muted-foreground hover:underline">
            Ver todos
          </Link>
        </div>

        {featuredProducts.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed text-muted-foreground/80">
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
        <section className="border-t bg-muted/50 py-8">
          <div className="mx-auto max-w-6xl px-4 text-center">
            <h3 className="text-sm font-semibold text-foreground/80">Contacto</h3>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
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
    <div className="flex flex-col items-center justify-center gap-8 px-4 py-16 text-center sm:py-24">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">FRC E-commerce Platform</h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">
          Plataforma SaaS multi-tenant para tiendas online
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Para acceder a una tienda, ingresá al subdominio de tu tienda
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        <Link
          href="/login"
          className="rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
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
      <div className="mt-4 text-xs text-muted-foreground/80">
        <a href="/api/health" className="hover:underline">Estado del servicio</a>
      </div>
    </div>
  );
}
