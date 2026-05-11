'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tenant, tenantMember, user } from '@frc-e-commerce/db/schema';
import { requireSuperAdmin, getSession } from '@/lib/auth/guards';
import { TENANT_OVERRIDE_COOKIE } from '@/lib/tenant';
import { createTenantSchema, type CreateTenantInput } from '@/lib/validators/tenant';

export type CreateTenantResult =
  | { ok: true; tenantId: string; slug: string }
  | { ok: false; error: string };

export async function createTenant(input: CreateTenantInput): Promise<CreateTenantResult> {
  const { session } = await requireSuperAdmin();
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

  // Auto-membership: el super admin que crea la tienda queda como owner
  await db.insert(tenantMember).values({
    tenantId: created.id,
    userId: session.user.id,
    role: 'owner',
  });

  revalidatePath('/super/tenants');
  return { ok: true, tenantId: created.id, slug: created.slug };
}

export type AddMemberResult =
  | { ok: true; membershipId: string }
  | { ok: false; error: string };

export async function addTenantMember(
  tenantId: string,
  email: string,
  role: 'owner' | 'admin' | 'manager' | 'cashier' | 'viewer'
): Promise<AddMemberResult> {
  const { session } = await requireSuperAdmin();

  const [tenantRow] = await db.select().from(tenant).where(eq(tenant.id, tenantId)).limit(1);
  if (!tenantRow) return { ok: false, error: 'Tienda no encontrada' };

  const [targetUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, email.toLowerCase().trim()))
    .limit(1);
  if (!targetUser) {
    return {
      ok: false,
      error: `No existe un usuario con email "${email}". Pediles que se registren en /register primero.`,
    };
  }

  const [existingMembership] = await db
    .select()
    .from(tenantMember)
    .where(and(eq(tenantMember.tenantId, tenantId), eq(tenantMember.userId, targetUser.id)))
    .limit(1);
  if (existingMembership) {
    return { ok: false, error: 'Ese usuario ya es miembro de esta tienda' };
  }

  const [created] = await db
    .insert(tenantMember)
    .values({
      tenantId,
      userId: targetUser.id,
      role,
      invitedBy: session.user.id,
    })
    .returning();

  if (!created) return { ok: false, error: 'No se pudo agregar el miembro' };

  revalidatePath(`/super/tenants/${tenantId}`);
  return { ok: true, membershipId: created.id };
}

/**
 * Switches the current dev session to a specific tenant by setting a cookie
 * that overrides DEV_TENANT_SLUG. Used from /super/tenants/[id] to "enter" a
 * tenant's admin without having to use subdomains in localhost.
 *
 * Security: only super admins can switch. The /admin layout still verifies
 * tenant_member separately, so super being able to set this cookie does NOT
 * grant admin access — it just changes which tenant is resolved.
 */
export async function switchToTenant(tenantId: string): Promise<void> {
  await requireSuperAdmin();
  const [t] = await db.select().from(tenant).where(eq(tenant.id, tenantId)).limit(1);
  if (!t) throw new Error('Tienda no encontrada');

  const c = await cookies();
  c.set(TENANT_OVERRIDE_COOKIE, t.slug, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
  redirect('/admin');
}

export async function clearTenantOverride(): Promise<void> {
  const c = await cookies();
  c.delete(TENANT_OVERRIDE_COOKIE);
}

/**
 * Sets the override cookie without redirecting. Used right before logging out
 * to "stage" the tenant the user wants to enter — when the next login happens,
 * the cookie persists and /admin resolves to that tenant.
 */
export async function stageTenantOverride(tenantId: string): Promise<void> {
  await requireSuperAdmin();
  const [t] = await db.select().from(tenant).where(eq(tenant.id, tenantId)).limit(1);
  if (!t) throw new Error('Tienda no encontrada');
  const c = await cookies();
  c.set(TENANT_OVERRIDE_COOKIE, t.slug, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
}

/**
 * Para usuarios normales (no super): permite entrar al admin de un tenant
 * del que son miembros. Setea cookie de override + redirige a /admin.
 */
export async function enterTenantAsMember(tenantId: string): Promise<void> {
  const session = await getSession();
  if (!session) redirect('/login');

  const [t] = await db.select().from(tenant).where(eq(tenant.id, tenantId)).limit(1);
  if (!t) throw new Error('Tienda no encontrada');

  const [m] = await db
    .select()
    .from(tenantMember)
    .where(and(eq(tenantMember.tenantId, tenantId), eq(tenantMember.userId, session.user.id)))
    .limit(1);
  if (!m) throw new Error('No sos miembro de esta tienda');

  const c = await cookies();
  c.set(TENANT_OVERRIDE_COOKIE, t.slug, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
  redirect('/admin');
}

/**
 * Adds the current logged-in super admin as `owner` of the tenant, in case
 * they want to operate the storefront/admin without going through the
 * invitation flow. Only super admins can call this.
 */
export async function selfAssignAsOwner(
  tenantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session } = await requireSuperAdmin();
  const [existing] = await db
    .select()
    .from(tenantMember)
    .where(and(eq(tenantMember.tenantId, tenantId), eq(tenantMember.userId, session.user.id)))
    .limit(1);
  if (existing) return { ok: false, error: 'Ya sos miembro de esta tienda' };
  await db.insert(tenantMember).values({
    tenantId,
    userId: session.user.id,
    role: 'owner',
  });
  revalidatePath(`/super/tenants/${tenantId}`);
  return { ok: true };
}

export async function searchUsersByEmail(
  query: string
): Promise<{ id: string; email: string; name: string }[]> {
  await requireSuperAdmin();
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const results = await db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(eq(user.email, q));
  if (results.length > 0) return results;
  // ilike search
  const { ilike } = await import('drizzle-orm');
  return db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(ilike(user.email, `%${q}%`))
    .limit(10);
}

export async function removeTenantMember(
  tenantId: string,
  membershipId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireSuperAdmin();

  await db
    .delete(tenantMember)
    .where(and(eq(tenantMember.id, membershipId), eq(tenantMember.tenantId, tenantId)));

  revalidatePath(`/super/tenants/${tenantId}`);
  return { ok: true };
}
