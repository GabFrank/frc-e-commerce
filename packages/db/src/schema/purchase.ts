import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  numeric,
  timestamp,
  boolean,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { tenant } from './tenant';
import { user } from './user';
import { productVariant } from './product';

// ── supplier ──────────────────────────────────────────────────────────────────

export const supplier = pgTable(
  'supplier',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    document: text('document'),
    contactName: text('contact_name'),
    phone: text('phone'),
    email: text('email'),
    notes: text('notes'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('idx_supplier_tenant_id').on(t.tenantId),
  })
);

export type Supplier = typeof supplier.$inferSelect;
export type NewSupplier = typeof supplier.$inferInsert;

// ── purchase_order ────────────────────────────────────────────────────────────

export const purchaseOrder = pgTable(
  'purchase_order',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => supplier.id, { onDelete: 'restrict' }),
    poNumber: text('po_number').notNull().unique(),
    /** draft | placed | received | partially_received | cancelled */
    status: text('status').notNull().default('draft'),
    /** Moneda en la que está expresada la PO (la del proveedor) */
    currencyCode: text('currency_code').notNull(),
    subtotalInCurrency: bigint('subtotal_in_currency', { mode: 'number' }).notNull().default(0),
    extrasTotalInCurrency: bigint('extras_total_in_currency', { mode: 'number' }).notNull().default(0),
    totalInCurrency: bigint('total_in_currency', { mode: 'number' }).notNull().default(0),
    /** Cotización snapshot al recibir (PO currency → tenant primary) */
    exchangeRateSnapshot: numeric('exchange_rate_snapshot', { precision: 18, scale: 8 }),
    totalInPrimary: bigint('total_in_primary', { mode: 'number' }),
    placedAt: timestamp('placed_at'),
    receivedAt: timestamp('received_at'),
    notes: text('notes'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    tenantStatusIdx: index('idx_purchase_order_tenant_status').on(t.tenantId, t.status),
    supplierIdx: index('idx_purchase_order_supplier').on(t.supplierId),
  })
);

export type PurchaseOrder = typeof purchaseOrder.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrder.$inferInsert;

// ── purchase_order_line ───────────────────────────────────────────────────────

export const purchaseOrderLine = pgTable(
  'purchase_order_line',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrder.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariant.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
    unitCostInCurrency: bigint('unit_cost_in_currency', { mode: 'number' }).notNull(),
    totalCostInCurrency: bigint('total_cost_in_currency', { mode: 'number' }).notNull(),
    /** Suma de prorrateos de extra costs aplicados a esta línea (en currency de la PO) */
    allocatedExtrasInCurrency: bigint('allocated_extras_in_currency', { mode: 'number' })
      .notNull()
      .default(0),
    /** unit_cost + allocated_extras/qty (en currency de la PO) */
    landedUnitCostInCurrency: bigint('landed_unit_cost_in_currency', { mode: 'number' }),
    /** En moneda primary del tenant (post-conversión) */
    landedUnitCostInPrimary: bigint('landed_unit_cost_in_primary', { mode: 'number' }),
    receivedQuantity: integer('received_quantity').notNull().default(0),
    returnedQuantity: integer('returned_quantity').notNull().default(0),
    cancelledQuantity: integer('cancelled_quantity').notNull().default(0),
    /** Nuevo precio de venta (en moneda primary del tenant) que se aplicará a
     *  productVariant.price cuando esta línea se reciba. Null = no cambiar precio. */
    sellPriceInPrimary: bigint('sell_price_in_primary', { mode: 'number' }),
  },
  (t) => ({
    poIdx: index('idx_po_line_po').on(t.purchaseOrderId),
  })
);

export type PurchaseOrderLine = typeof purchaseOrderLine.$inferSelect;
export type NewPurchaseOrderLine = typeof purchaseOrderLine.$inferInsert;

// ── purchase_extra_cost ───────────────────────────────────────────────────────

export const purchaseExtraCost = pgTable(
  'purchase_extra_cost',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrder.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    amountInCurrency: bigint('amount_in_currency', { mode: 'number' }).notNull(),
    /** cost (default) | equal | qty | manual */
    allocationStrategy: text('allocation_strategy').notNull().default('cost'),
  },
  (t) => ({
    poIdx: index('idx_extra_cost_po').on(t.purchaseOrderId),
  })
);

export type PurchaseExtraCost = typeof purchaseExtraCost.$inferSelect;
export type NewPurchaseExtraCost = typeof purchaseExtraCost.$inferInsert;

// ── purchase_extra_cost_manual_split (solo cuando strategy='manual') ───────────

export const purchaseExtraCostManualSplit = pgTable(
  'purchase_extra_cost_manual_split',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    extraCostId: uuid('extra_cost_id')
      .notNull()
      .references(() => purchaseExtraCost.id, { onDelete: 'cascade' }),
    purchaseOrderLineId: uuid('purchase_order_line_id')
      .notNull()
      .references(() => purchaseOrderLine.id, { onDelete: 'cascade' }),
    amountInCurrency: bigint('amount_in_currency', { mode: 'number' }).notNull(),
  },
  (t) => ({
    uniqueExtraLine: unique('uq_manual_split_extra_line').on(t.extraCostId, t.purchaseOrderLineId),
  })
);

export type PurchaseExtraCostManualSplit = typeof purchaseExtraCostManualSplit.$inferSelect;
export type NewPurchaseExtraCostManualSplit = typeof purchaseExtraCostManualSplit.$inferInsert;
