import { pgTable, pgEnum, uuid, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { tenant } from './tenant';
import { user } from './user';

export const orderStatus = pgEnum('order_status', [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

export const paymentStatus = pgEnum('payment_status', [
  'pending',
  'authorized',
  'captured',
  'failed',
  'refunded',
  'cancelled',
]);

export const order = pgTable(
  'order',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    // Nullable — guest checkout allowed
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    orderNumber: text('order_number').notNull().unique(),
    status: orderStatus('status').notNull().default('pending'),
    // Customer snapshot (denormalized — user may delete account)
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email').notNull(),
    customerPhone: text('customer_phone'),
    // Financials (amounts in minor currency units, e.g. guaraníes or centavos)
    subtotal: integer('subtotal').notNull(),
    shippingCost: integer('shipping_cost').notNull().default(0),
    tax: integer('tax').notNull().default(0),
    total: integer('total').notNull(),
    currency: text('currency').notNull(),
    // Shipping address stored as JSON snapshot
    shippingAddressJson: jsonb('shipping_address_json').notNull(),
    notes: text('notes'),
    // Sales channel: web storefront or POS terminal
    channel: text('channel').notNull().default('web'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    tenantIdIdx: index('order_tenant_id_idx').on(t.tenantId),
    statusIdx: index('order_status_idx').on(t.status),
  })
);

export const orderLine = pgTable(
  'order_line',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    // FK to product_variant.id added in product schema migration
    variantId: uuid('variant_id').notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: integer('unit_price').notNull(),
    totalPrice: integer('total_price').notNull(),
    // Optional cost snapshot for margin tracking
    costSnapshot: integer('cost_snapshot'),
  },
  (t) => ({
    orderIdIdx: index('order_line_order_id_idx').on(t.orderId),
  })
);

export const payment = pgTable(
  'payment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    method: text('method').notNull(),
    status: paymentStatus('status').notNull().default('pending'),
    // Amounts in minor currency units
    amount: integer('amount').notNull(),
    currency: text('currency').notNull(),
    // Reference from payment gateway (e.g. Stripe payment intent id)
    externalId: text('external_id'),
    // Arbitrary gateway metadata (e.g. webhook payloads, redirect URLs)
    metadataJson: jsonb('metadata_json'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    orderIdIdx: index('payment_order_id_idx').on(t.orderId),
  })
);

export const shipment = pgTable(
  'shipment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    method: text('method').notNull(),
    addressJson: jsonb('address_json').notNull(),
    tracking: text('tracking'),
    status: text('status').notNull().default('pending'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    orderIdIdx: index('shipment_order_id_idx').on(t.orderId),
  })
);

export type Order = typeof order.$inferSelect;
export type NewOrder = typeof order.$inferInsert;
export type OrderLine = typeof orderLine.$inferSelect;
export type NewOrderLine = typeof orderLine.$inferInsert;
export type Payment = typeof payment.$inferSelect;
export type NewPayment = typeof payment.$inferInsert;
export type Shipment = typeof shipment.$inferSelect;
export type NewShipment = typeof shipment.$inferInsert;
export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
