import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  numeric,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { tenant } from './tenant';
import { user } from './user';
import { customer } from './customer';

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
    /** Para canal POS: opcional; web checkout siempre denormaliza customer en columnas */
    customerId: uuid('customer_id').references(() => customer.id, { onDelete: 'set null' }),
    orderNumber: text('order_number').notNull().unique(),
    /** Correlativo POS por tenant (para canal pos). Asignado atómicamente al crear. */
    ticketCorrelative: bigint('ticket_correlative', { mode: 'number' }),
    status: orderStatus('status').notNull().default('pending'),
    // Customer snapshot (denormalized — user may delete account, customer record may change)
    customerName: text('customer_name').notNull(),
    customerEmail: text('customer_email').notNull(),
    customerPhone: text('customer_phone'),
    // Financials (amounts in minor currency units, e.g. guaraníes o centavos)
    subtotal: integer('subtotal').notNull(),
    /** Descuento general aplicado al subtotal (positivo = descuenta) */
    discountAmount: integer('discount_amount').notNull().default(0),
    discountReason: text('discount_reason'),
    /** Aumento general (positivo = suma); útil para redondeo */
    surchargeAmount: integer('surcharge_amount').notNull().default(0),
    surchargeReason: text('surcharge_reason'),
    shippingCost: integer('shipping_cost').notNull().default(0),
    tax: integer('tax').notNull().default(0),
    total: integer('total').notNull(),
    currency: text('currency').notNull(),
    /** Moneda primary efectiva al momento de la venta (puede diferir del default del tenant si fue override en POS) */
    primaryCurrencyAtTime: text('primary_currency_at_time'),
    // Shipping address stored as JSON snapshot
    shippingAddressJson: jsonb('shipping_address_json').notNull(),
    notes: text('notes'),
    // Sales channel: web storefront or POS terminal
    channel: text('channel').notNull().default('web'),
    /** FK a cash_session (definida en otro archivo) — populada solo para channel='pos' */
    cashSessionId: uuid('cash_session_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    tenantIdIdx: index('order_tenant_id_idx').on(t.tenantId),
    statusIdx: index('order_status_idx').on(t.status),
    customerIdx: index('order_customer_id_idx').on(t.customerId),
    cashSessionIdx: index('order_cash_session_idx').on(t.cashSessionId),
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
    /** Descuento aplicado a la línea (positivo = descuenta del totalPrice) */
    discountAmount: integer('discount_amount').notNull().default(0),
    discountReason: text('discount_reason'),
    totalPrice: integer('total_price').notNull(),
    /** True si esta línea fue marcada como brindis (no cobrada) */
    isComplimentary: boolean('is_complimentary').notNull().default(false),
    /** UserId del admin/manager que autorizó marcar brindis si el producto no era brindis por default */
    complimentaryAuthorizedBy: text('complimentary_authorized_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    complimentaryAuthorizedAt: timestamp('complimentary_authorized_at'),
    /** Cantidad ya devuelta por sale_return (acumulado) */
    returnedQuantity: integer('returned_quantity').notNull().default(0),
    /** Cantidad cancelada por sale_cancel */
    cancelledQuantity: integer('cancelled_quantity').notNull().default(0),
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
    /** Tasa aplicada si la moneda del payment != primary del tenant. Snapshot al confirmar. */
    exchangeRateSnapshot: numeric('exchange_rate_snapshot', { precision: 18, scale: 8 }),
    /** Monto convertido a la moneda primary; precalculado para reportes. */
    amountInPrimary: integer('amount_in_primary'),
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

/**
 * Detalle row-based del cobro POS. Cada fila representa un evento de cobro:
 *  - 'payment'   = entra plata (positivo)
 *  - 'change'    = sale plata como vuelto (positivo, conceptualmente "negativo" para el total cobrado)
 *  - 'discount'  = descuento aplicado al cobro (no entra plata)
 *  - 'surcharge' = aumento (suele ser ajuste por redondeo)
 *
 * El header `payment.amount` es el total final cobrado en moneda primary, calculado por la action.
 */
export const paymentDetail = pgTable(
  'payment_detail',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payment.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // 'payment' | 'change' | 'discount' | 'surcharge'
    /** efectivo | transferencia | tarjeta_pos | cheque — null si discount/surcharge sin método */
    paymentMethod: text('payment_method'),
    currencyCode: text('currency_code'),
    /** Monto positivo en la moneda especificada (en MINOR units). El signo lo da el `kind`. */
    amount: bigint('amount', { mode: 'number' }).notNull(),
    exchangeRateSnapshot: numeric('exchange_rate_snapshot', { precision: 18, scale: 8 }),
    /** Monto en moneda primary del tenant, precalculado. */
    amountInPrimary: bigint('amount_in_primary', { mode: 'number' }).notNull(),
    position: integer('position').notNull().default(0),
  },
  (t) => ({
    paymentIdx: index('payment_detail_payment_id_idx').on(t.paymentId),
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
export type PaymentDetail = typeof paymentDetail.$inferSelect;
export type NewPaymentDetail = typeof paymentDetail.$inferInsert;
export type Shipment = typeof shipment.$inferSelect;
export type NewShipment = typeof shipment.$inferInsert;
export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
