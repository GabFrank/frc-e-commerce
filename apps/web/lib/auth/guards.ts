import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { user as userTable, tenantMember } from '@frc-e-commerce/db/schema';

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export async function requireSuperAdmin() {
  const session = await requireSession();
  const [u] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);
  if (!u?.isSuperAdmin) redirect('/');
  return { session, user: u };
}

export async function getMembership(userId: string, tenantId: string) {
  const [m] = await db
    .select()
    .from(tenantMember)
    .where(and(eq(tenantMember.userId, userId), eq(tenantMember.tenantId, tenantId)))
    .limit(1);
  return m ?? null;
}

export async function requireTenantMembership(tenantId: string) {
  const session = await requireSession();
  const m = await getMembership(session.user.id, tenantId);
  if (!m) redirect('/');
  return { session, membership: m };
}
