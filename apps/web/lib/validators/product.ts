import { z } from 'zod';

const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** UUID opcional. La conversión "" → undefined se hace en el cliente
 *  (setValueAs en register o limpieza explícita en onSubmit). */
const optionalUuid = z.string().uuid('UUID inválido').optional();
const optionalString = z.string().optional();

// ── Category ──────────────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(200, 'Máximo 200 caracteres'),
  slug: z
    .string()
    .min(2)
    .max(200)
    .regex(slugRegex, 'Solo a-z, 0-9 y guiones (no al inicio/fin)'),
  parentId: optionalUuid,
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ── Product ───────────────────────────────────────────────────────────────────

export const createProductSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(200, 'Máximo 200 caracteres'),
  slug: z
    .string()
    .min(2)
    .max(200)
    .regex(slugRegex, 'Solo a-z, 0-9 y guiones (no al inicio/fin)'),
  description: optionalString,
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  categoryId: optionalUuid,
  /** Price in lowest denomination (centavos / céntimos) */
  basePrice: z
    .number()
    .int('Debe ser un entero')
    .positive('Debe ser mayor a 0'),
  currency: z.string().min(1).max(10).default('PYG'),
  taxIncluded: z.boolean().default(false),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ── ProductVariant ────────────────────────────────────────────────────────────

export const createProductVariantSchema = z.object({
  sku: z.string().min(1, 'SKU requerido').max(100),
  name: z.string().min(1, 'Nombre requerido').max(200),
  price: z
    .number()
    .int('Debe ser un entero')
    .nonnegative('Debe ser 0 o mayor'),
  compareAtPrice: z
    .number()
    .int('Debe ser un entero')
    .nonnegative()
    .nullish(),
  stock: z.number().int().nonnegative().default(0),
  attributes: z.record(z.string(), z.string()).default({}),
  active: z.boolean().default(true),
});

export const updateProductVariantSchema = createProductVariantSchema.partial();

export type CreateProductVariantInput = z.infer<typeof createProductVariantSchema>;
export type UpdateProductVariantInput = z.infer<typeof updateProductVariantSchema>;
