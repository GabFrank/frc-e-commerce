import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { product, productVariant, productImage, category } from '@frc-e-commerce/db/schema';
import { requireTenantId, getCurrentTenant } from '@/lib/tenant';
import { ProductForm } from '@/components/admin/products/ProductForm';
import { VariantForm } from '@/components/admin/products/VariantForm';
import { ImageUploader } from '@/components/admin/products/ImageUploader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const tenantId = await requireTenantId();
  const tenant = await getCurrentTenant();

  const [productData] = await db
    .select()
    .from(product)
    .where(and(eq(product.id, id), eq(product.tenantId, tenantId)))
    .limit(1);

  if (!productData) notFound();

  const [categories, variants, images] = await Promise.all([
    db
      .select()
      .from(category)
      .where(eq(category.tenantId, tenantId))
      .orderBy(category.position, category.name),
    db
      .select()
      .from(productVariant)
      .where(
        and(eq(productVariant.productId, id), eq(productVariant.tenantId, tenantId))
      )
      .orderBy(productVariant.sku),
    db
      .select()
      .from(productImage)
      .where(
        and(eq(productImage.productId, id), eq(productImage.tenantId, tenantId))
      )
      .orderBy(productImage.position),
  ]);

  const defaultImages = images.filter((img) => img.variantId === null);
  const variantImagesByVariant = new Map<string, typeof images>();
  for (const img of images) {
    if (img.variantId) {
      const existing = variantImagesByVariant.get(img.variantId) ?? [];
      existing.push(img);
      variantImagesByVariant.set(img.variantId, existing);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/productos" className="text-sm text-muted-foreground hover:underline">
          ← Volver a productos
        </Link>
      </div>

      {/* Product data form */}
      <ProductForm product={productData} categories={categories} />

      {/* Variants — image management is nested per variant */}
      <VariantForm
        productId={id}
        productGender={productData.gender}
        variants={variants}
        tenantSlug={tenant?.slug ?? 'tenant'}
        imagesByVariant={Object.fromEntries(variantImagesByVariant)}
      />

      {/* Default product images (shown when selected variant has none) */}
      <Card>
        <CardHeader>
          <CardTitle>Imágenes por defecto</CardTitle>
          <p className="text-xs text-muted-foreground">
            Se usan cuando la variante seleccionada no tiene imágenes propias.
          </p>
        </CardHeader>
        <CardContent>
          <ImageUploader
            productId={id}
            tenantSlug={tenant?.slug ?? 'tenant'}
            images={defaultImages}
          />
        </CardContent>
      </Card>
    </div>
  );
}
