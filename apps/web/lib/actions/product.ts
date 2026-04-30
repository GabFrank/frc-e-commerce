'use server';

import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  product,
  productVariant,
  productImage,
  category,
} from '@frc-e-commerce/db/schema';
import { requireTenantMembership } from '@/lib/auth/guards';
import { requireTenantId } from '@/lib/tenant';
import {
  createProductSchema,
  updateProductSchema,
  createCategorySchema,
  updateCategorySchema,
  createProductVariantSchema,
  type CreateProductInput,
  type UpdateProductInput,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type CreateProductVariantInput,
} from '@/lib/validators/product';

type Ok<T> = { ok: true } & T;
type Fail = { ok: false; error: string };
type Result<T = object> = Ok<T> | Fail;

// ── helpers ───────────────────────────────────────────────────────────────────

async function guardTenant() {
  const tenantId = await requireTenantId();
  await requireTenantMembership(tenantId);
  return tenantId;
}

// ── Category actions ──────────────────────────────────────────────────────────

export async function createCategory(
  input: CreateCategoryInput
): Promise<Result<{ categoryId: string }>> {
  try {
    const tenantId = await guardTenant();
    const parsed = createCategorySchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
    }

    const [created] = await db
      .insert(category)
      .values({ ...parsed.data, tenantId })
      .returning({ categoryId: category.id });

    if (!created) return { ok: false, error: 'No se pudo crear la categoría' };

    revalidatePath('/admin/productos');
    return { ok: true, categoryId: created.categoryId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    return { ok: false, error: msg };
  }
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput
): Promise<Result> {
  try {
    const tenantId = await guardTenant();
    const parsed = updateCategorySchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
    }

    await db
      .update(category)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(category.id, id), eq(category.tenantId, tenantId)));

    revalidatePath('/admin/productos');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    return { ok: false, error: msg };
  }
}

export async function deleteCategory(id: string): Promise<Result> {
  try {
    const tenantId = await guardTenant();

    await db
      .delete(category)
      .where(and(eq(category.id, id), eq(category.tenantId, tenantId)));

    revalidatePath('/admin/productos');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    return { ok: false, error: msg };
  }
}

// ── Product actions ───────────────────────────────────────────────────────────

export async function createProduct(
  input: CreateProductInput
): Promise<Result<{ productId: string }>> {
  try {
    const tenantId = await guardTenant();
    const parsed = createProductSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
    }

    const [created] = await db
      .insert(product)
      .values({ ...parsed.data, tenantId })
      .returning({ productId: product.id });

    if (!created) return { ok: false, error: 'No se pudo crear el producto' };

    revalidatePath('/admin/productos');
    return { ok: true, productId: created.productId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    return { ok: false, error: msg };
  }
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput
): Promise<Result> {
  try {
    const tenantId = await guardTenant();
    const parsed = updateProductSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
    }

    await db
      .update(product)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(product.id, id), eq(product.tenantId, tenantId)));

    revalidatePath('/admin/productos');
    revalidatePath(`/admin/productos/${id}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    return { ok: false, error: msg };
  }
}

/** Soft-delete: marks product as archived */
export async function deleteProduct(id: string): Promise<Result> {
  try {
    const tenantId = await guardTenant();

    await db
      .update(product)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(and(eq(product.id, id), eq(product.tenantId, tenantId)));

    revalidatePath('/admin/productos');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    return { ok: false, error: msg };
  }
}

// ── ProductVariant actions ────────────────────────────────────────────────────

export async function createProductVariant(
  productId: string,
  input: CreateProductVariantInput
): Promise<Result<{ variantId: string }>> {
  try {
    const tenantId = await guardTenant();
    const parsed = createProductVariantSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
    }

    const [created] = await db
      .insert(productVariant)
      .values({
        ...parsed.data,
        attributes: (parsed.data.attributes ?? {}) as Record<string, string>,
        productId,
        tenantId,
      })
      .returning({ variantId: productVariant.id });

    if (!created) return { ok: false, error: 'No se pudo crear la variante' };

    revalidatePath(`/admin/productos/${productId}`);
    return { ok: true, variantId: created.variantId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    return { ok: false, error: msg };
  }
}

// ── ProductImage actions ──────────────────────────────────────────────────────

export async function addProductImage(
  productId: string,
  data: { r2Key: string; url: string; alt?: string; position?: number }
): Promise<Result<{ imageId: string }>> {
  try {
    const tenantId = await guardTenant();

    const [created] = await db
      .insert(productImage)
      .values({
        productId,
        tenantId,
        r2Key: data.r2Key,
        url: data.url,
        alt: data.alt,
        position: data.position ?? 0,
      })
      .returning({ imageId: productImage.id });

    if (!created) return { ok: false, error: 'No se pudo guardar la imagen' };

    revalidatePath(`/admin/productos/${productId}`);
    return { ok: true, imageId: created.imageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    return { ok: false, error: msg };
  }
}

export async function deleteProductImage(
  productId: string,
  imageId: string
): Promise<Result> {
  try {
    const tenantId = await guardTenant();

    await db
      .delete(productImage)
      .where(
        and(
          eq(productImage.id, imageId),
          eq(productImage.tenantId, tenantId),
          eq(productImage.productId, productId)
        )
      );

    revalidatePath(`/admin/productos/${productId}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    return { ok: false, error: msg };
  }
}
