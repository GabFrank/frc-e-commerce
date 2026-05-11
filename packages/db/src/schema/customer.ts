import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { tenant } from './tenant';

export const customer = pgTable(
  'customer',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** CI/RUC opcional. Único por tenant si está presente. */
    document: text('document'),
    phone: text('phone'),
    email: text('email'),
    notes: text('notes'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('idx_customer_tenant_id').on(t.tenantId),
    documentIdx: index('idx_customer_tenant_document').on(t.tenantId, t.document),
    phoneIdx: index('idx_customer_tenant_phone').on(t.tenantId, t.phone),
    nameIdx: index('idx_customer_tenant_name').on(t.tenantId, t.name),
  })
);

export type Customer = typeof customer.$inferSelect;
export type NewCustomer = typeof customer.$inferInsert;
