import { pgTable, uuid, text, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { tenant } from './tenant';
import { user } from './user';

export const cart = pgTable('cart', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  // Nullable — can belong to an anonymous (unauthenticated) user
  userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
  // Cookie identifier for anonymous carts
  sessionId: text('session_id'),
  currency: text('currency').notNull().default('PYG'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
});

export const cartLine = pgTable(
  'cart_line',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => cart.id, { onDelete: 'cascade' }),
    // FK to product_variant.id added in product schema migration
    variantId: uuid('variant_id').notNull(),
    quantity: integer('quantity').notNull(),
    // Snapshot of unit price at time of adding to cart (in minor currency units)
    unitPrice: integer('unit_price').notNull(),
    /** Snapshot denormalizado de la variante para mostrar info estable aunque el catálogo cambie. */
    variantSnapshot: jsonb('variant_snapshot').$type<{
      color: string | null;
      size: string | null;
      sizeKind: string | null;
      sku: string;
      productName: string;
      variantName: string;
    } | null>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    cartIdIdx: index('cart_line_cart_id_idx').on(t.cartId),
  })
);

export type Cart = typeof cart.$inferSelect;
export type NewCart = typeof cart.$inferInsert;
export type CartLine = typeof cartLine.$inferSelect;
export type NewCartLine = typeof cartLine.$inferInsert;
