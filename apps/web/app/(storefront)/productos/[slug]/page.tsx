import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { and, asc, eq } from 'drizzle-orm';
import { getCurrentTenant } from '@/lib/tenant';
import { ProductPurchasePanel } from '@/components/storefront/product-purchase-panel';
import { ProductGallery } from '@/components/storefront/product-gallery';
import type { VariantOption } from '@/components/storefront/variant-selector';
import { db } from '@/lib/db';
import { product, productVariant, productImage } from '@frc-e-commerce/db/schema';

async function loadProduct(tenantId: string, slug: string) {
  const [productRow] = await db
    .select()
    .from(product)
    .where(and(eq(product.tenantId, tenantId), eq(product.slug, slug)))
    .limit(1);
  if (!productRow) return null;
  const variants = await db
    .select()
    .from(productVariant)
    .where(eq(productVariant.productId, productRow.id));
  const images = await db
    .select()
    .from(productImage)
    .where(eq(productImage.productId, productRow.id))
    .orderBy(asc(productImage.position));
  return { product: productRow, variants, images };
}

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getCurrentTenant().catch(() => null);
  if (!tenant) return { title: 'Producto no encontrado' };

  const data = await loadProduct(tenant.id, slug);
  if (!data) return { title: 'Producto no encontrado' };
  const { product: p, images } = data;

  const tenantName = tenant.name;
  return {
    title: `${p.name} | ${tenantName}`,
    description: p.description ?? `${p.name} en ${tenantName}`,
    openGraph: {
      title: `${p.name} | ${tenantName}`,
      description: p.description ?? undefined,
      images: images.length > 0 ? [{ url: images[0].url }] : [],
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const tenant = await getCurrentTenant().catch(() => null);
  if (!tenant) notFound();

  const data = await loadProduct(tenant.id, slug);
  if (!data || data.product.status !== 'active') notFound();
  const productData = {
    ...data.product,
    variants: data.variants,
    images: data.images.map((img) => ({ id: img.id, url: img.url, alt: img.alt })),
  };

  const variantOptions: VariantOption[] = productData.variants
    .filter((v) => v.active !== false)
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      stock: v.stock,
      price: v.price,
      attributes: (v.attributes ?? {}) as Record<string, string>,
    }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">Inicio</Link>
        <span>/</span>
        <Link href="/productos" className="hover:underline">Productos</Link>
        <span>/</span>
        <span className="text-foreground">{productData.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Galería de imágenes */}
        <ProductGallery images={productData.images} productName={productData.name} />

        {/* Info del producto */}
        <div className="flex flex-col gap-5">
          <h1 className="text-2xl font-bold">{productData.name}</h1>

          {productData.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">{productData.description}</p>
          )}

          <ProductPurchasePanel
            variants={variantOptions}
            basePrice={productData.basePrice}
            currency={productData.currency}
          />

          {/* Link al carrito */}
          <div className="pt-2">
            <Link
              href="/carrito"
              className="text-sm text-muted-foreground hover:underline"
            >
              Ver carrito
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
