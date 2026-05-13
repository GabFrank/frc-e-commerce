import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { requireSession, getMembership } from '@/lib/auth/guards';
import { getCurrentTenant, TENANT_OVERRIDE_COOKIE } from '@/lib/tenant';
import { hasCapability } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { user as userTable } from '@frc-e-commerce/db/schema';
import { ExitTenantOverrideButton } from '@/components/admin/exit-tenant-override-button';
import { SidebarNavGroup } from '@/components/admin/SidebarNavGroup';
import { ThemeToggle } from '@/components/theme-toggle';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant().catch(() => null);
  if (!tenant) redirect('/mis-tiendas');

  const session = await requireSession();
  const membership = await getMembership(session.user.id, tenant.id);
  if (!membership) redirect('/mis-tiendas');

  const c = await cookies();
  const isOverrideActive = !!c.get(TENANT_OVERRIDE_COOKIE);

  // Detect if super to show "Volver al super" link
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
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r p-4 flex flex-col">
        <div className="mb-6">
          <Link href="/admin" className="font-semibold">
            {tenant.name}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">Admin</p>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            ↗ Ver tienda pública
          </a>
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          <Link href="/admin/productos" className="rounded px-2 py-1.5 hover:bg-muted">
            Productos
          </Link>
          {financieroItems.length > 0 && (
            <SidebarNavGroup label="Financiero" items={financieroItems} />
          )}
          {canSeeReportes && (
            <Link href="/admin/reportes" className="rounded px-2 py-1.5 hover:bg-muted">
              Reportes
            </Link>
          )}
          {canSeeConfig && (
            <Link href="/admin/configuracion" className="rounded px-2 py-1.5 hover:bg-muted">
              Configuración
            </Link>
          )}
          <Link
            href="/pos"
            className="mt-2 rounded bg-primary px-2 py-1.5 text-center font-medium text-primary-foreground hover:bg-primary/90"
          >
            Abrir POS →
          </Link>
        </nav>
        <div className="mt-auto pt-4 border-t text-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-muted-foreground truncate">{session.user.email}</p>
              <p className="mt-1 text-muted-foreground/80">Rol: {membership.role}</p>
            </div>
            <ThemeToggle />
          </div>
          <Link
            href="/mis-tiendas"
            className="block rounded px-2 py-1.5 text-muted-foreground hover:bg-muted"
          >
            ← Mis tiendas
          </Link>
          {isSuperAdmin && (
            <Link
              href="/super"
              className="block rounded px-2 py-1.5 text-muted-foreground hover:bg-muted"
            >
              Panel super
            </Link>
          )}
          {isOverrideActive && <ExitTenantOverrideButton />}
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
