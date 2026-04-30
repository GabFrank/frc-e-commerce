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

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/productos" className="text-sm text-zinc-500 hover:underline">
          ← Volver a productos
        </Link>
      </div>

      {/* Product data form */}
      <ProductForm product={productData} categories={categories} />

      {/* Variants */}
      <VariantForm productId={id} variants={variants} />

      {/* Images */}
      <Card>
        <CardHeader>
          <CardTitle>Imágenes</CardTitle>
        </CardHeader>
        <CardContent>
          <ImageUploader
            productId={id}
            tenantSlug={tenant?.slug ?? 'tenant'}
            images={images}
          />
        </CardContent>
      </Card>
    </div>
  );
}
