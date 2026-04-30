import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getCurrentTenant } from '@/lib/tenant';
import { formatMoney } from '@frc-e-commerce/shared-utils';
import type { CurrencyCode } from '@frc-e-commerce/shared-utils';
import { AddToCartButton } from '@/components/storefront/add-to-cart-button';
import type { VariantOption } from '@/components/storefront/variant-selector';

// TODO: enable when product/variant/image schemas are added (Agent A)
// import { db } from '@/lib/db';
// import { product, productVariant, productImage } from '@frc-e-commerce/db/schema';
// import { and, eq } from 'drizzle-orm';

// ---- Stub types (replace with schema types when Agent A delivers) ----
interface StubProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  basePrice: number;
  currency: string;
  status: string;
  tenantId: string;
}

interface StubVariant {
  id: string;
  sku: string;
  name: string;
  stock: number;
  attributes: Record<string, string>;
}

interface StubImage {
  id: string;
  url: string;
  alt: string | null;
}

// ---- Demo stub data so the route renders visually without schema ----
const STUB_PRODUCTS: (StubProduct & { variants: StubVariant[]; images: StubImage[] })[] = [
  {
    id: 'prod-1',
    slug: 'remera-basica',
    name: 'Remera básica',
    description: 'Remera de algodón 100% de alta calidad. Disponible en múltiples colores y talles.',
    basePrice: 150000,
    currency: 'PYG',
    status: 'active',
    tenantId: '',
    variants: [
      { id: 'v-1', sku: 'RB-S', name: 'Talle S', stock: 5, attributes: { talla: 'S' } },
      { id: 'v-2', sku: 'RB-M', name: 'Talle M', stock: 10, attributes: { talla: 'M' } },
      { id: 'v-3', sku: 'RB-L', name: 'Talle L', stock: 3, attributes: { talla: 'L' } },
      { id: 'v-4', sku: 'RB-XL', name: 'Talle XL', stock: 0, attributes: { talla: 'XL' } },
    ],
    images: [],
  },
  {
    id: 'prod-2',
    slug: 'pantalon-jean',
    name: 'Pantalón jean',
    description: 'Jean clásico de corte recto. Confeccionado con denim de alta resistencia.',
    basePrice: 280000,
    currency: 'PYG',
    status: 'active',
    tenantId: '',
    variants: [
      { id: 'v-5', sku: 'PJ-32', name: 'Talle 32', stock: 4, attributes: { talla: '32' } },
      { id: 'v-6', sku: 'PJ-34', name: 'Talle 34', stock: 7, attributes: { talla: '34' } },
    ],
    images: [],
  },
];

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getCurrentTenant().catch(() => null);

  // TODO: query real product when Agent A schema is ready
  const product = STUB_PRODUCTS.find((p) => p.slug === slug);
  if (!product) return { title: 'Producto no encontrado' };

  const tenantName = tenant?.name ?? 'Tienda';
  return {
    title: `${product.name} | ${tenantName}`,
    description: product.description ?? `${product.name} en ${tenantName}`,
    openGraph: {
      title: `${product.name} | ${tenantName}`,
      description: product.description ?? undefined,
      images: product.images.length > 0 ? [{ url: product.images[0].url }] : [],
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const tenant = await getCurrentTenant().catch(() => null);
  if (!tenant) notFound();

  // TODO: replace with real DB query when Agent A schema is ready
  // const [productRow] = await db
  //   .select()
  //   .from(product)
  //   .where(and(eq(product.tenantId, tenant.id), eq(product.slug, slug)))
  //   .limit(1);
  // if (!productRow || productRow.status !== 'active') notFound();
  //
  // const variants = await db
  //   .select()
  //   .from(productVariant)
  //   .where(eq(productVariant.productId, productRow.id));
  //
  // const images = await db
  //   .select()
  //   .from(productImage)
  //   .where(eq(productImage.productId, productRow.id))
  //   .orderBy(asc(productImage.position));

  const productData = STUB_PRODUCTS.find((p) => p.slug === slug);
  if (!productData) notFound();

  const variantOptions: VariantOption[] = productData.variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    name: v.name,
    stock: v.stock,
    attributes: v.attributes,
  }));

  const formattedPrice = formatMoney({
    amount: productData.basePrice,
    currency: productData.currency as CurrencyCode,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/" className="hover:underline">Inicio</Link>
        <span>/</span>
        <Link href="/productos" className="hover:underline">Productos</Link>
        <span>/</span>
        <span className="text-zinc-800">{productData.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Galería de imágenes */}
        <div className="space-y-3">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-zinc-100">
            {productData.images.length > 0 ? (
              <Image
                src={productData.images[0].url}
                alt={productData.images[0].alt ?? productData.name}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-200">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="96"
                  height="96"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {productData.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {productData.images.map((img) => (
                <div
                  key={img.id}
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-zinc-100"
                >
                  <Image
                    src={img.url}
                    alt={img.alt ?? productData.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info del producto */}
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-bold">{productData.name}</h1>
            <p className="mt-2 text-2xl font-semibold text-primary">{formattedPrice}</p>
          </div>

          {productData.description && (
            <p className="text-sm leading-relaxed text-zinc-600">{productData.description}</p>
          )}

          {/* Selector de variante + botón agregar al carrito */}
          {variantOptions.length > 0 ? (
            <AddToCartButton variants={variantOptions} unitPrice={productData.basePrice} />
          ) : (
            <p className="text-sm text-zinc-500">Sin variantes disponibles.</p>
          )}

          {/* Link al carrito */}
          <div className="pt-2">
            <Link
              href="/carrito"
              className="text-sm text-zinc-500 hover:underline"
            >
              Ver carrito
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
