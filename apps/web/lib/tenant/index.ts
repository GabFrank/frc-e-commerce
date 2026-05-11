import { cookies, headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/lib/db';
import { tenant, type Tenant } from '@frc-e-commerce/db/schema';

export const TENANT_OVERRIDE_COOKIE = 'frc-dev-tenant-slug';

export const getCurrentTenant = cache(async (): Promise<Tenant | null> => {
  // Precedence: subdomain header (proxy.ts) → dev override cookie → env fallback
  const h = await headers();
  const headerSlug = h.get('x-frc-tenant-slug');
  let slug: string | null = headerSlug ?? null;
  if (!slug) {
    const c = await cookies();
    slug = c.get(TENANT_OVERRIDE_COOKIE)?.value ?? null;
  }
  if (!slug) {
    slug = process.env.DEV_TENANT_SLUG ?? null;
  }
  if (!slug) return null;
  const [t] = await db.select().from(tenant).where(eq(tenant.slug, slug)).limit(1);
  return t ?? null;
});

export async function requireTenantId(): Promise<string> {
  const t = await getCurrentTenant();
  if (!t) throw new Error('No tenant context — request outside tenant scope');
  return t.id;
}

export async function requireTenant(): Promise<Tenant> {
  const t = await getCurrentTenant();
  if (!t) throw new Error('No tenant context — request outside tenant scope');
  return t;
}
