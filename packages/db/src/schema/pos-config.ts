import { pgTable, uuid, text, boolean, bigint, timestamp } from 'drizzle-orm/pg-core';
import { tenant } from './tenant';

/**
 * Configuración del POS por tenant. Una sola fila por tenant (PK = tenantId).
 */
export const posConfig = pgTable('pos_config', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  /** Subset de tenant_currency activas que se usan en POS. Array de currency codes. */
  enabledCurrencies: text('enabled_currencies').array().notNull().default([]),
  /** Monedas en las que se muestra el precio de cada item en POS (incluye primary). */
  pricingDisplayCurrencies: text('pricing_display_currencies').array().notNull().default([]),
  /** Métodos de pago aceptados: 'efectivo', 'transferencia', 'tarjeta_pos', 'cheque'. */
  paymentMethods: text('payment_methods').array().notNull().default([]),
  /** Método de pago precargado al abrir el diálogo de cobro; debe estar en paymentMethods. */
  primaryPaymentMethod: text('primary_payment_method'),
  /** Mostrar imágenes en el diálogo de búsqueda. */
  searchShowImages: boolean('search_show_images').notNull().default(true),
  /** Mostrar costo del producto a usuarios admin/manager. */
  showCostToAdmin: boolean('show_cost_to_admin').notNull().default(true),
  /** Bloquear ventas si stock insuficiente; false = warning permite igual. */
  strictStock: boolean('strict_stock').notNull().default(false),
  /**
   * Fórmula para calcular el margen sobre costo/precio.
   * - 'markup'  (default): margen = (precio − costo) / costo × 100
   *   → costo 35, venta 70 → margen 100%
   * - 'gross'  (sobre venta): margen = (precio − costo) / precio × 100
   *   → costo 35, venta 70 → margen 50%
   */
  marginFormula: text('margin_formula').notNull().default('markup'),
  ticketPrefix: text('ticket_prefix').notNull().default('POS'),
  /** Contador atómico de tickets POS por tenant. */
  ticketCorrelative: bigint('ticket_correlative', { mode: 'number' }).notNull().default(0),
  receiptHeader: text('receipt_header'),
  receiptFooter: text('receipt_footer'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type PosConfig = typeof posConfig.$inferSelect;
export type NewPosConfig = typeof posConfig.$inferInsert;
