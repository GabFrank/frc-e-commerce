import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { category } from '@frc-e-commerce/db/schema';
import { requireTenantId } from '@/lib/tenant';
import { ProductForm } from '@/components/admin/products/ProductForm';

export default async function NewProductPage() {
  const tenantId = await requireTenantId();

  const categories = await db
    .select()
    .from(category)
    .where(eq(category.tenantId, tenantId))
    .orderBy(category.position, category.name);

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/admin/productos" className="text-sm text-muted-foreground hover:underline">
        ← Volver a productos
      </Link>
      <ProductForm categories={categories} />
    </div>
  );
}
