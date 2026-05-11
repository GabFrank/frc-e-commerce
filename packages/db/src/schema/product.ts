import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { tenant } from './tenant';

// ── Enums ──────────────────────────────────────────────────────────────────────

export const productStatus = pgEnum('product_status', ['draft', 'active', 'archived']);

export const productGender = pgEnum('product_gender', [
  'masculino',
  'femenino',
  'unisex',
  'infantil',
]);

// ── Category ──────────────────────────────────────────────────────────────────

export const category = pgTable(
  'category',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    /** Self-referencing parent; null = root category */
    parentId: uuid('parent_id'),
    imageUrl: text('image_url'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    uniqueSlug: unique('uq_category_tenant_slug').on(t.tenantId, t.slug),
    tenantIdx: index('idx_category_tenant_id').on(t.tenantId),
  })
);

export type Category = typeof category.$inferSelect;
export type NewCategory = typeof category.$inferInsert;

// ── Product ───────────────────────────────────────────────────────────────────

export const product = pgTable(
  'product',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    status: productStatus('status').notNull().default('draft'),
    categoryId: uuid('category_id').references(() => category.id, { onDelete: 'set null' }),
    /** Género de la prenda. Default 'unisex' para no romper productos sin clasificación. */
    gender: productGender('gender').notNull().default('unisex'),
    /** Price in lowest denomination (centavos / céntimos) */
    basePrice: integer('base_price').notNull(),
    currency: text('currency').notNull().default('PYG'),
    taxIncluded: boolean('tax_included').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    uniqueSlug: unique('uq_product_tenant_slug').on(t.tenantId, t.slug),
    tenantIdx: index('idx_product_tenant_id').on(t.tenantId),
    genderIdx: index('idx_product_gender').on(t.tenantId, t.gender),
  })
);

export type Product = typeof product.$inferSelect;
export type NewProduct = typeof product.$inferInsert;

// ── ProductVariant ────────────────────────────────────────────────────────────

export const productVariant = pgTable(
  'product_variant',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    price: integer('price').notNull(),
    compareAtPrice: integer('compare_at_price'),
    stock: integer('stock').notNull().default(0),
    /** Color en texto libre (ej: "Rojo", "Azul Marino"). Null = producto sin variación de color. */
    color: text('color'),
    /** Talle canónico de la variante. Letras (XS..XXXL) para adultos; números (2..16) para infantil. */
    size: text('size'),
    /** Padrón del talle: 'letter_adult' | 'number_kids'. Null = sin talle (accesorios). */
    sizeKind: text('size_kind'),
    /** Atributos extra libres (material, fit, etc.) — color y talle viven en columnas dedicadas. */
    attributes: jsonb('attributes').$type<Record<string, string>>().notNull().default({}),
    active: boolean('active').notNull().default(true),
  },
  (t) => ({
    uniqueSku: unique('uq_variant_tenant_sku').on(t.tenantId, t.sku),
    /** Postgres trata NULL como distinto, así que dos variantes con (color=null, size=null) son válidas — usar solo cuando alguno tiene valor. */
    uniqueColorSize: unique('uq_variant_product_color_size').on(t.productId, t.color, t.size),
    tenantIdx: index('idx_variant_tenant_id').on(t.tenantId),
    productColorIdx: index('idx_variant_product_color').on(t.productId, t.color),
  })
);

export type ProductVariant = typeof productVariant.$inferSelect;
export type NewProductVariant = typeof productVariant.$inferInsert;

// ── ProductImage ──────────────────────────────────────────────────────────────

export const productImage = pgTable(
  'product_image',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    /**
     * Optional variant the image belongs to. NULL = default product image,
     * shown when no variant-specific images exist for the active selection.
     */
    variantId: uuid('variant_id').references(() => productVariant.id, {
      onDelete: 'set null',
    }),
    /** Object key in the R2 bucket */
    r2Key: text('r2_key').notNull(),
    url: text('url').notNull(),
    alt: text('alt'),
    position: integer('position').notNull().default(0),
  },
  (t) => ({
    tenantIdx: index('idx_product_image_tenant_id').on(t.tenantId),
    variantIdx: index('idx_product_image_variant_id').on(t.variantId),
  })
);

export type ProductImage = typeof productImage.$inferSelect;
export type NewProductImage = typeof productImage.$inferInsert;
