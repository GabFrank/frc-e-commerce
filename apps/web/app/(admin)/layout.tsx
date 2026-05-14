import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { requireSession, getMembership } from '@/lib/auth/guards';
import { getCurrentTenant, TENANT_OVERRIDE_COOKIE } from '@/lib/tenant';
import { hasCapability } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { user as userTable } from '@frc-e-commerce/db/schema';
import { AdminShell } from '@/components/admin/AdminShell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant().catch(() => null);
  if (!tenant) redirect('/mis-tiendas');

  const session = await requireSession();
  const membership = await getMembership(session.user.id, tenant.id);
  if (!membership) redirect('/mis-tiendas');

  const c = await cookies();
  const isOverrideActive = !!c.get(TENANT_OVERRIDE_COOKIE);

  const [u] = await db
    .select({ isSuperAdmin: userTable.isSuperAdmin })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);
  const isSuperAdmin = !!u?.isSuperAdmin;

  const role = membership.role;
  const financieroItems = (
    [
      { href: '/admin/financiero/cajas', label: 'Cajas', cap: 'reports.financial' as const },
      { href: '/admin/pedidos', label: 'Pedidos / Ventas', cap: 'order.view' as const },
      { href: '/admin/compras', label: 'Compras', cap: 'purchase.view' as const },
      { href: '/admin/proveedores', label: 'Proveedores', cap: 'supplier.write' as const },
      { href: '/admin/configuracion/monedas', label: 'Cotizaciones', cap: 'currency.view' as const },
    ]
      .filter((i) => hasCapability(role, i.cap))
      .map(({ href, label }) => ({ href, label }))
  );
  const canSeeConfig = hasCapability(role, 'tenant.settings');
  const canSeeReportes =
    hasCapability(role, 'reports.financial') || hasCapability(role, 'reports.operational');

  return (
    <AdminShell
      config={{
        tenantName: tenant.name,
        userEmail: session.user.email,
        role: membership.role,
        financieroItems,
        canSeeConfig,
        canSeeReportes,
        isSuperAdmin,
        isOverrideActive,
      }}
    >
      {children}
    </AdminShell>
  );
}
