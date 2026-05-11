import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  numeric,
  timestamp,
  index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { tenant } from './tenant';
import { user } from './user';
import { productVariant } from './product';
import { order } from './order';

/**
 * Movimientos de stock: cada fila representa un cambio en el stock de una variante.
 * El signo lo da el `kind`: purchase/+, sale/-, etc.
 */
export const stockMovement = pgTable(
  'stock_movement',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariant.id, { onDelete: 'cascade' }),
    /**
     * purchase | purchase_return | purchase_cancel
     * sale | sale_return | sale_cancel
     * adjustment
     */
    kind: text('kind').notNull(),
    /** Cantidad siempre positiva. El signo conceptual lo da el kind. */
    quantity: integer('quantity').notNull(),
    /** Costo unit en moneda primary del tenant al momento (avg cost para sales, landed cost para purchases) */
    unitCostSnapshot: bigint('unit_cost_snapshot', { mode: 'number' }),
    totalCostInPrimary: bigint('total_cost_in_primary', { mode: 'number' }),
    reason: text('reason'),
    /** Para *_return y *_cancel: FK a el movement original que se está revirtiendo */
    originalMovementId: uuid('original_movement_id').references(
      (): AnyPgColumn => stockMovement.id,
      { onDelete: 'set null' }
    ),
    orderId: uuid('order_id').references(() => order.id, { onDelete: 'set null' }),
    purchaseOrderId: uuid('purchase_order_id'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('idx_stock_movement_tenant').on(t.tenantId),
    variantIdx: index('idx_stock_movement_variant').on(t.variantId),
    orderIdx: index('idx_stock_movement_order').on(t.orderId),
    poIdx: index('idx_stock_movement_po').on(t.purchaseOrderId),
    kindIdx: index('idx_stock_movement_tenant_kind').on(t.tenantId, t.kind),
  })
);

export type StockMovement = typeof stockMovement.$inferSelect;
export type NewStockMovement = typeof stockMovement.$inferInsert;

/**
 * Cache denormalizado del costo promedio ponderado por variante.
 * Se actualiza con cada stockMovement de tipo `purchase` o `purchase_return`/`purchase_cancel`.
 * Las ventas leen este valor para snapshotear cost_snapshot en orderLine y stockMovement.
 */
export const productVariantAvgCost = pgTable('product_variant_avg_cost', {
  variantId: uuid('variant_id')
    .primaryKey()
    .references(() => productVariant.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  avgCostInPrimary: bigint('avg_cost_in_primary', { mode: 'number' }).notNull().default(0),
  stockValueInPrimary: bigint('stock_value_in_primary', { mode: 'number' }).notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type ProductVariantAvgCost = typeof productVariantAvgCost.$inferSelect;
export type NewProductVariantAvgCost = typeof productVariantAvgCost.$inferInsert;

// Numeric type used by purchase orders prorrateo logic, exposed for FK constraints later.
// (purchase tables se definen en M6 en archivo separado)
export const _numericMarker = numeric;
