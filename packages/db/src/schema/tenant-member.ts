import { pgTable, pgEnum, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { tenant } from './tenant';
import { user } from './user';

export const tenantMemberRole = pgEnum('tenant_member_role', [
  'owner',
  'admin',
  'manager',
  'cashier',
  'viewer',
]);

export const tenantMember = pgTable(
  'tenant_member',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenant.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: tenantMemberRole('role').notNull().default('viewer'),
    invitedBy: text('invited_by').references(() => user.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    uniqueMembership: unique('uq_tenant_member').on(t.tenantId, t.userId),
  })
);

export type TenantMember = typeof tenantMember.$inferSelect;
export type TenantMemberRole = (typeof tenantMemberRole.enumValues)[number];
