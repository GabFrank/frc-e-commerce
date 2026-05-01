import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  numeric,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { tenant } from './tenant';
import { user } from './user';
import { order } from './order';
import { denomination } from './currency';

// ── cash_session ──────────────────────────────────────────────────────────────

export const cashSession = pgTable(
  'cash_session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    cashierId: text('cashier_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    status: text('status').notNull().default('open'), // 'open' | 'closed'
    openedAt: timestamp('opened_at').notNull().defaultNow(),
    closedAt: timestamp('closed_at'),
    notes: text('notes'),
  },
  (t) => ({
    tenantStatusIdx: index('idx_cash_session_tenant_status').on(t.tenantId, t.status),
    cashierIdx: index('idx_cash_session_cashier').on(t.cashierId),
  })
);

export type CashSession = typeof cashSession.$inferSelect;
export type NewCashSession = typeof cashSession.$inferInsert;

// ── cash_session_balance: 1 fila por moneda al abrir caja ─────────────────────

export const cashSessionBalance = pgTable(
  'cash_session_balance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cashSessionId: uuid('cash_session_id')
      .notNull()
      .references(() => cashSession.id, { onDelete: 'cascade' }),
    currencyCode: text('currency_code').notNull(),
    /** Monto inicial declarado al abrir, en MINOR units */
    openingDeclared: bigint('opening_declared', { mode: 'number' }).notNull().default(0),
    /** Saldo teórico calculado al cerrar (opening + sum cash_movement de esa moneda) */
    expected: bigint('expected', { mode: 'number' }),
    /** Contado físico declarado al cerrar */
    countedDeclared: bigint('counted_declared', { mode: 'number' }),
    /** counted - expected (puede ser negativo) */
    diff: bigint('diff', { mode: 'number' }),
  },
  (t) => ({
    uniqueSessionCurrency: unique('uq_cash_session_balance_currency').on(
      t.cashSessionId,
      t.currencyCode
    ),
  })
);

export type CashSessionBalance = typeof cashSessionBalance.$inferSelect;
export type NewCashSessionBalance = typeof cashSessionBalance.$inferInsert;

// ── cash_count_detail: filas por denominación contada (open o close) ──────────

export const cashCountDetail = pgTable(
  'cash_count_detail',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cashSessionId: uuid('cash_session_id')
      .notNull()
      .references(() => cashSession.id, { onDelete: 'cascade' }),
    moment: text('moment').notNull(), // 'open' | 'close'
    currencyCode: text('currency_code').notNull(),
    denominationId: uuid('denomination_id')
      .notNull()
      .references(() => denomination.id, { onDelete: 'restrict' }),
    qty: integer('qty').notNull(),
  },
  (t) => ({
    sessionMomentIdx: index('idx_cash_count_session_moment').on(t.cashSessionId, t.moment),
  })
);

export type CashCountDetail = typeof cashCountDetail.$inferSelect;
export type NewCashCountDetail = typeof cashCountDetail.$inferInsert;

// ── cash_movement: cada entrada/salida de caja ────────────────────────────────

export const cashMovement = pgTable(
  'cash_movement',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cashSessionId: uuid('cash_session_id')
      .notNull()
      .references(() => cashSession.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    /** sale_in | sale_return_out | sale_cancel_out | manual_in | manual_out */
    kind: text('kind').notNull(),
    /** efectivo | transferencia | tarjeta_pos | cheque | otro */
    paymentMethod: text('payment_method').notNull(),
    currencyCode: text('currency_code').notNull(),
    /** Monto positivo en MINOR units; el signo conceptual lo da el `kind`. */
    amount: bigint('amount', { mode: 'number' }).notNull(),
    exchangeRateSnapshot: numeric('exchange_rate_snapshot', { precision: 18, scale: 8 }),
    amountInPrimary: bigint('amount_in_primary', { mode: 'number' }).notNull(),
    orderId: uuid('order_id').references(() => order.id, { onDelete: 'set null' }),
    reason: text('reason'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index('idx_cash_movement_session').on(t.cashSessionId),
    tenantKindIdx: index('idx_cash_movement_tenant_kind').on(t.tenantId, t.kind),
  })
);

export type CashMovement = typeof cashMovement.$inferSelect;
export type NewCashMovement = typeof cashMovement.$inferInsert;

// ── cash_closure: resumen header del cierre ────────────────────────────────────

export const cashClosure = pgTable('cash_closure', {
  id: uuid('id').primaryKey().defaultRandom(),
  cashSessionId: uuid('cash_session_id')
    .notNull()
    .unique()
    .references(() => cashSession.id, { onDelete: 'cascade' }),
  totalTransactions: integer('total_transactions').notNull().default(0),
  /** En moneda primary del tenant al momento del cierre */
  avgTicketInPrimary: bigint('avg_ticket_in_primary', { mode: 'number' }).notNull().default(0),
  totalSalesInPrimary: bigint('total_sales_in_primary', { mode: 'number' }).notNull().default(0),
  totalReturnsInPrimary: bigint('total_returns_in_primary', { mode: 'number' }).notNull().default(0),
  totalCancellationsInPrimary: bigint('total_cancellations_in_primary', { mode: 'number' })
    .notNull()
    .default(0),
  generatedAt: timestamp('generated_at').notNull().defaultNow(),
});

export type CashClosure = typeof cashClosure.$inferSelect;
export type NewCashClosure = typeof cashClosure.$inferInsert;

// ── cash_closure_metric: filas con desgloses ──────────────────────────────────

export const cashClosureMetric = pgTable(
  'cash_closure_metric',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cashClosureId: uuid('cash_closure_id')
      .notNull()
      .references(() => cashClosure.id, { onDelete: 'cascade' }),
    /** sales | returns | cancellations | discounts | surcharges | avg_ticket | tx_count | otros */
    metric: text('metric').notNull(),
    paymentMethod: text('payment_method'),
    currencyCode: text('currency_code'),
    valueNumeric: bigint('value_numeric', { mode: 'number' }),
    valueText: text('value_text'),
  },
  (t) => ({
    closureIdx: index('idx_cash_closure_metric_closure').on(t.cashClosureId),
    metricIdx: index('idx_cash_closure_metric_metric').on(t.cashClosureId, t.metric),
  })
);

export type CashClosureMetric = typeof cashClosureMetric.$inferSelect;
export type NewCashClosureMetric = typeof cashClosureMetric.$inferInsert;
