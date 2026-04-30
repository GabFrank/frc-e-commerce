import { pgTable, pgEnum, uuid, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core';

export const tenantPlan = pgEnum('tenant_plan', ['free', 'starter', 'pro', 'enterprise']);
export const tenantStatus = pgEnum('tenant_status', ['active', 'suspended', 'archived']);

export const tenant = pgTable('tenant', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  plan: tenantPlan('plan').notNull().default('free'),
  status: tenantStatus('status').notNull().default('active'),
  // Branding
  logoUrl: text('logo_url'),
  faviconUrl: text('favicon_url'),
  primaryColor: text('primary_color').default('#1f2937'),
  secondaryColor: text('secondary_color').default('#6b7280'),
  accentColor: text('accent_color').default('#3b82f6'),
  slogan: text('slogan'),
  description: text('description'),
  // Contact
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  contactWhatsapp: text('contact_whatsapp'),
  // Settings
  defaultCurrency: text('default_currency').notNull().default('PYG'),
  defaultLanguage: text('default_language').notNull().default('es'),
  // Onboarding
  onboardingStep: integer('onboarding_step').notNull().default(0),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  // Custom domain (post-MVP)
  customDomain: text('custom_domain').unique(),
  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type Tenant = typeof tenant.$inferSelect;
export type NewTenant = typeof tenant.$inferInsert;
