'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tenant } from '@frc-e-commerce/db/schema';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { createTenantSchema, type CreateTenantInput } from '@/lib/validators/tenant';

export type CreateTenantResult =
  | { ok: true; tenantId: string; slug: string }
  | { ok: false; error: string };

export async function createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
  await requireSuperAdmin();
  const parsed = createTenantSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }

  const [exists] = await db.select().from(tenant).where(eq(tenant.slug, parsed.data.slug)).limit(1);
  if (exists) return { ok: false, error: `Slug "${parsed.data.slug}" ya está en uso` };

  const [created] = await db
    .insert(tenant)
    .values({
      name: parsed.data.name,
      slug: parsed.data.slug,
      plan: parsed.data.plan,
    })
    .returning();

  if (!created) return { ok: false, error: 'No se pudo crear la tienda' };

  revalidatePath('/super/tenants');
  return { ok: true, tenantId: created.id, slug: created.slug };
}
