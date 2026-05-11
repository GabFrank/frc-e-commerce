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
import { isRedirectError } from '@/lib/actions/_redirect-helper';
import { deleteR2Object } from '@/lib/r2';
import {
  createProductSchema,
  updateProductSchema,
  createCategorySchema,
  updateCategorySchema,
  createProductVariantSchema,
  updateProductVariantSchema,
  bulkCreateVariantsSchema,
  type CreateProductInput,
  type UpdateProductInput,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type CreateProductVariantInput,
  type UpdateProductVariantInput,
  type BulkCreateVariantsInput,
} from '@/lib/validators/product';
import { slugify } from '@frc-e-commerce/shared-utils';

type Ok<T> = { ok: true } & T;
type Fail = { ok: false; error: string };
type Result<T = object> = Ok<T> | Fail;

// ── helpers ───────────────────────────────────────────────────────────────────

async function guardTenant() {
  const tenantId = await requireTenantId();
  await requireTenantMembership(tenantId);
  return tenantId;
}

function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const e = err as { code?: string; constraint_name?: string; constraint?: string } | null;
  if (!e || e.code !== '23505') return false;
  if (!constraint) return true;
  const name = e.constraint_name ?? e.constraint;
  return typeof name === 'string' && name.includes(constraint);
}

function uniqueViolationMessage(err: unknown): string {
  if (isUniqueViolation(err, 'uq_variant_product_color_size')) {
    return 'Ya existe una variante con ese color y talle';
  }
  if (isUniqueViolation(err, 'uq_variant_tenant_sku')) {
    return 'Ese SKU ya existe en otra variante';
  }
  return err instanceof Error ? err.message : 'Error inesperado';
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
    if (isRedirectError(err)) throw err;
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
    if (isRedirectError(err)) throw err;
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
    if (isRedirectError(err)) throw err;
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
      .returning({ productId: product.id, slug: product.slug, basePrice: product.basePrice });

    if (!created) return { ok: false, error: 'No se pudo crear el producto' };

    // Crear variante default automáticamente — el stock siempre vive en una variante.
    await ensureDefaultVariantInternal(tenantId, created.productId, created.slug, created.basePrice);

    revalidatePath('/admin/productos');
    return { ok: true, productId: created.productId };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    return { ok: false, error: msg };
  }
}

/** Crea una variante "default" (sin color ni talle) si el producto no tiene ninguna.
 *  Garantiza que stock siempre exista en `product_variant`, no en `product`. */
async function ensureDefaultVariantInternal(
  tenantId: string,
  productId: string,
  slug: string,
  basePrice: number
): Promise<void> {
  const existing = await db
    .select({ id: productVariant.id })
    .from(productVariant)
    .where(
      and(eq(productVariant.productId, productId), eq(productVariant.tenantId, tenantId))
    )
    .limit(1);
  if (existing.length > 0) return;

  const baseSku = `${slug.toUpperCase().slice(0, 12)}-DEFAULT`;
  let sku = baseSku;
  let attempt = 0;
  while (attempt < 10) {
    try {
      await db.insert(productVariant).values({
        tenantId,
        productId,
        sku,
        name: 'Default',
        price: basePrice,
        stock: 0,
        color: null,
        size: null,
        sizeKind: null,
        attributes: {},
        active: true,
      });
      return;
    } catch (err) {
      if (isUniqueViolation(err, 'uq_variant_tenant_sku')) {
        attempt += 1;
        sku = `${baseSku}-${attempt}`;
        continue;
      }
      throw err;
    }
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
    if (isRedirectError(err)) throw err;
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
    if (isRedirectError(err)) throw err;
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
    if (isRedirectError(err)) throw err;
    return { ok: false, error: uniqueViolationMessage(err) };
  }
}

/** Genera N×M variantes (colores × tallas) en una transacción. Skip silencioso de duplicados. */
export async function bulkCreateVariantsByMatrix(
  input: BulkCreateVariantsInput
): Promise<Result<{ created: number; skipped: number }>> {
  try {
    const tenantId = await guardTenant();
    const parsed = bulkCreateVariantsSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
    }
    const { productId, colors, sizes, sizeKind, basePrice, baseStock, skuPrefix, overrides, exclude } =
      parsed.data;

    if (colors.length === 0 && sizes.length === 0) {
      return { ok: false, error: 'Indicá al menos un color o un talle' };
    }

    const [p] = await db
      .select({ slug: product.slug })
      .from(product)
      .where(and(eq(product.id, productId), eq(product.tenantId, tenantId)))
      .limit(1);
    if (!p) return { ok: false, error: 'Producto no encontrado' };

    const colorList = colors.length > 0 ? colors : [null];
    const sizeList = sizes.length > 0 ? sizes : [null];
    const prefix = (skuPrefix?.trim() || p.slug.toUpperCase().slice(0, 12)).replace(/\s+/g, '-');

    // Indexa overrides por clave "color||size" para lookup O(1) en el loop.
    const overrideMap = new Map<string, { price?: number; stock?: number }>();
    for (const o of overrides ?? []) {
      overrideMap.set(`${o.color ?? ''}||${o.size ?? ''}`, { price: o.price, stock: o.stock });
    }
    const excludeSet = new Set<string>(
      (exclude ?? []).map((e) => `${e.color ?? ''}||${e.size ?? ''}`)
    );

    let created = 0;
    let skipped = 0;
    for (const color of colorList) {
      for (const size of sizeList) {
        if (excludeSet.has(`${color ?? ''}||${size ?? ''}`)) {
          skipped += 1;
          continue;
        }
        const skuSegments = [prefix];
        if (color) skuSegments.push(slugify(color).toUpperCase());
        if (size) skuSegments.push(size.toUpperCase());
        const sku = skuSegments.join('-');
        const nameParts: string[] = [];
        if (color) nameParts.push(color);
        if (size) nameParts.push(`Talle ${size}`);
        const name = nameParts.join(' · ') || 'Default';
        const ov = overrideMap.get(`${color ?? ''}||${size ?? ''}`);
        const variantPrice = ov?.price ?? basePrice;
        const variantStock = ov?.stock ?? baseStock;
        try {
          await db.insert(productVariant).values({
            tenantId,
            productId,
            sku,
            name,
            price: variantPrice,
            stock: variantStock,
            color,
            size,
            sizeKind: size ? (sizeKind ?? null) : null,
            attributes: {},
            active: true,
          });
          created += 1;
        } catch (err) {
          if (
            isUniqueViolation(err, 'uq_variant_product_color_size') ||
            isUniqueViolation(err, 'uq_variant_tenant_sku')
          ) {
            skipped += 1;
            continue;
          }
          throw err;
        }
      }
    }

    revalidatePath(`/admin/productos/${productId}`);
    return { ok: true, created, skipped };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: uniqueViolationMessage(err) };
  }
}

/** Lista colores ya usados en un producto (para autocomplete del input "color"). */
export async function listProductColors(productId: string): Promise<string[]> {
  try {
    const tenantId = await guardTenant();
    const rows = await db
      .selectDistinct({ color: productVariant.color })
      .from(productVariant)
      .where(
        and(eq(productVariant.productId, productId), eq(productVariant.tenantId, tenantId))
      );
    return rows.map((r) => r.color).filter((c): c is string => !!c);
  } catch {
    return [];
  }
}

export async function updateProductVariant(
  variantId: string,
  input: UpdateProductVariantInput
): Promise<Result> {
  try {
    const tenantId = await guardTenant();
    const parsed = updateProductVariantSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
    }

    const [existing] = await db
      .select({ productId: productVariant.productId })
      .from(productVariant)
      .where(and(eq(productVariant.id, variantId), eq(productVariant.tenantId, tenantId)))
      .limit(1);

    if (!existing) return { ok: false, error: 'Variante no encontrada' };

    const data = parsed.data;
    await db
      .update(productVariant)
      .set({
        ...(data.sku !== undefined && { sku: data.sku }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.compareAtPrice !== undefined && { compareAtPrice: data.compareAtPrice ?? null }),
        ...(data.stock !== undefined && { stock: data.stock }),
        ...(data.color !== undefined && { color: data.color ?? null }),
        ...(data.size !== undefined && { size: data.size ?? null }),
        ...(data.sizeKind !== undefined && { sizeKind: data.sizeKind ?? null }),
        ...(data.attributes !== undefined && { attributes: data.attributes as Record<string, string> }),
        ...(data.active !== undefined && { active: data.active }),
      })
      .where(and(eq(productVariant.id, variantId), eq(productVariant.tenantId, tenantId)));

    revalidatePath(`/admin/productos/${existing.productId}`);
    return { ok: true };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: uniqueViolationMessage(err) };
  }
}

/** Soft delete / restore: marca la variante como inactiva (archivada) o activa. */
export async function setVariantActive(variantId: string, active: boolean): Promise<Result> {
  try {
    const tenantId = await guardTenant();
    const [existing] = await db
      .select({ productId: productVariant.productId })
      .from(productVariant)
      .where(and(eq(productVariant.id, variantId), eq(productVariant.tenantId, tenantId)))
      .limit(1);
    if (!existing) return { ok: false, error: 'Variante no encontrada' };

    await db
      .update(productVariant)
      .set({ active })
      .where(and(eq(productVariant.id, variantId), eq(productVariant.tenantId, tenantId)));

    revalidatePath(`/admin/productos/${existing.productId}`);
    return { ok: true };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { ok: false, error: err instanceof Error ? err.message : 'Error inesperado' };
  }
}

// ── ProductImage actions ──────────────────────────────────────────────────────

export async function addProductImage(
  productId: string,
  data: {
    r2Key: string;
    url: string;
    alt?: string;
    position?: number;
    variantId?: string | null;
  }
): Promise<Result<{ imageId: string }>> {
  try {
    const tenantId = await guardTenant();

    if (data.variantId) {
      const [variant] = await db
        .select({ id: productVariant.id })
        .from(productVariant)
        .where(
          and(
            eq(productVariant.id, data.variantId),
            eq(productVariant.tenantId, tenantId),
            eq(productVariant.productId, productId)
          )
        )
        .limit(1);
      if (!variant) return { ok: false, error: 'Variante inválida' };
    }

    const [created] = await db
      .insert(productImage)
      .values({
        productId,
        tenantId,
        variantId: data.variantId ?? null,
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
    if (isRedirectError(err)) throw err;
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

    // Lookup primero para obtener la r2Key
    const [img] = await db
      .select()
      .from(productImage)
      .where(
        and(
          eq(productImage.id, imageId),
          eq(productImage.tenantId, tenantId),
          eq(productImage.productId, productId)
        )
      )
      .limit(1);

    if (!img) return { ok: false, error: 'Imagen no encontrada' };

    await db
      .delete(productImage)
      .where(
        and(
          eq(productImage.id, imageId),
          eq(productImage.tenantId, tenantId),
          eq(productImage.productId, productId)
        )
      );

    // Borrar de R2 (best-effort — si falla, ya borramos de DB)
    if (img.r2Key && !img.r2Key.startsWith('stub/')) {
      try {
        await deleteR2Object(img.r2Key);
      } catch (e) {
        console.warn('[deleteProductImage] R2 delete failed (continuing):', e);
      }
    }

    revalidatePath(`/admin/productos/${productId}`);
    return { ok: true };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    return { ok: false, error: msg };
  }
}
