import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  numeric,
  timestamp,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { tenant } from './tenant';
import { user } from './user';

// ── Currency master (global, no por tenant) ────────────────────────────────────

export const currency = pgTable('currency', {
  /** ISO 4217 alphabetic code (PYG, USD, BRL, ...) */
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  /** Display symbol (₲, $, R$, ...) */
  symbol: text('symbol').notNull(),
  /** PYG=0, USD=2, BRL=2 */
  decimalPlaces: integer('decimal_places').notNull().default(2),
  /** ISO 4217 numeric code ('600', '840', '986') */
  numericCode: text('numeric_code'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Currency = typeof currency.$inferSelect;
export type NewCurrency = typeof currency.$inferInsert;

// ── tenant_currency (cuáles usa cada tenant + cuál es primary) ─────────────────

export const tenantCurrency = pgTable(
  'tenant_currency',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    currencyCode: text('currency_code')
      .notNull()
      .references(() => currency.code),
    isPrimary: boolean('is_primary').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    uniqueTenantCurrency: unique('uq_tenant_currency').on(t.tenantId, t.currencyCode),
    tenantIdx: index('idx_tenant_currency_tenant_id').on(t.tenantId),
  })
);

export type TenantCurrency = typeof tenantCurrency.$inferSelect;
export type NewTenantCurrency = typeof tenantCurrency.$inferInsert;

// ── exchange_rate (versionado por timestamp) ───────────────────────────────────

export const exchangeRate = pgTable(
  'exchange_rate',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    /** La moneda secundaria. La primary del tenant siempre es 1.0 implícita. */
    currencyCode: text('currency_code')
      .notNull()
      .references(() => currency.code),
    /** Cuántas unidades de la moneda primary del tenant pago por 1 unidad de la secundaria al COMPRAR esa moneda */
    buyRate: numeric('buy_rate', { precision: 18, scale: 8 }).notNull(),
    /** Cuánto cobro por 1 unidad de la secundaria al VENDER esa moneda */
    sellRate: numeric('sell_rate', { precision: 18, scale: 8 }).notNull(),
    effectiveFrom: timestamp('effective_from').notNull().defaultNow(),
    setBy: text('set_by').references(() => user.id, { onDelete: 'set null' }),
    note: text('note'),
  },
  (t) => ({
    tenantCurrencyEffectiveIdx: index('idx_exchange_rate_tenant_currency_effective').on(
      t.tenantId,
      t.currencyCode,
      t.effectiveFrom
    ),
  })
);

export type ExchangeRate = typeof exchangeRate.$inferSelect;
export type NewExchangeRate = typeof exchangeRate.$inferInsert;

// ── denomination (master por moneda; billetes y monedas reales) ────────────────

export const denomination = pgTable(
  'denomination',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    currencyCode: text('currency_code')
      .notNull()
      .references(() => currency.code, { onDelete: 'cascade' }),
    /** Valor en MINOR units de la moneda. Ejemplos:
     *   PYG (decimals=0): 1000 = ₲1.000, 100000 = ₲100.000
     *   USD (decimals=2): 100 = $1.00, 10000 = $100.00
     */
    value: bigint('value', { mode: 'number' }).notNull(),
    kind: text('kind').notNull(), // 'bill' | 'coin'
    isActive: boolean('is_active').notNull().default(true),
    position: integer('position').notNull().default(0),
  },
  (t) => ({
    uniqueCurrencyValue: unique('uq_denomination_currency_value_kind').on(
      t.currencyCode,
      t.value,
      t.kind
    ),
    currencyIdx: index('idx_denomination_currency_code').on(t.currencyCode),
  })
);

export type Denomination = typeof denomination.$inferSelect;
export type NewDenomination = typeof denomination.$inferInsert;
