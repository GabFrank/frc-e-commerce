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
  gender: z.enum(['masculino', 'femenino', 'unisex', 'infantil']).default('unisex'),
  /** Precio base en moneda primary (puede ser 0 — se define después en compra/variantes). */
  basePrice: z
    .number()
    .int('Debe ser un entero')
    .nonnegative('No puede ser negativo')
    .default(0),
  currency: z.string().min(1).max(10).default('PYG'),
  taxIncluded: z.boolean().default(false),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ── ProductVariant ────────────────────────────────────────────────────────────

const productVariantBaseSchema = z.object({
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
  color: z.string().max(50).nullable().optional(),
  size: z.string().max(10).nullable().optional(),
  sizeKind: z.enum(['letter_adult', 'number_kids']).nullable().optional(),
  attributes: z.record(z.string(), z.string()).default({}),
  active: z.boolean().default(true),
});

export const bulkCreateVariantsSchema = z.object({
  productId: z.string().uuid(),
  colors: z.array(z.string().min(1).max(50)).max(50),
  sizes: z.array(z.string().min(1).max(10)).max(50),
  sizeKind: z.enum(['letter_adult', 'number_kids']).nullable().optional(),
  basePrice: z.number().int().nonnegative(),
  baseStock: z.number().int().nonnegative().default(0),
  skuPrefix: z.string().max(20).optional(),
  /** Overrides puntuales por (color, size). Falta de match con la matriz se ignora silenciosamente. */
  overrides: z
    .array(
      z.object({
        color: z.string().max(50).nullable(),
        size: z.string().max(10).nullable(),
        price: z.number().int().nonnegative().optional(),
        stock: z.number().int().nonnegative().optional(),
      })
    )
    .max(500)
    .optional(),
  /** Combinaciones (color, size) que el usuario excluyó explícitamente — no se crean. */
  exclude: z
    .array(
      z.object({
        color: z.string().max(50).nullable(),
        size: z.string().max(10).nullable(),
      })
    )
    .max(500)
    .optional(),
});

export type BulkCreateVariantsInput = z.infer<typeof bulkCreateVariantsSchema>;

const sizePairCheck = (v: { size?: string | null; sizeKind?: 'letter_adult' | 'number_kids' | null }) => {
  // Si hay talle, debe venir con su tipo (adulto/infantil). El front lo deriva del género del producto.
  if (v.size && !v.sizeKind) return false;
  if (!v.size && v.sizeKind) return false;
  return true;
};

export const createProductVariantSchema = productVariantBaseSchema.refine(sizePairCheck, {
  message: 'Falta el tipo de talle (adulto / infantil)',
  path: ['size'],
});

export const updateProductVariantSchema = productVariantBaseSchema.partial().refine(sizePairCheck, {
  message: 'Falta el tipo de talle (adulto / infantil)',
  path: ['size'],
});

export type CreateProductVariantInput = z.infer<typeof createProductVariantSchema>;
export type UpdateProductVariantInput = z.infer<typeof updateProductVariantSchema>;
