import { redirect } from 'next/navigation';
import { requireSession, getMembership } from '@/lib/auth/guards';
import { getCurrentTenant } from '@/lib/tenant';
import { hasCapability } from '@/lib/auth/permissions';
import { ReportTabs } from './_components/ReportTabs';

export const dynamic = 'force-dynamic';

export default async function ReportesLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect('/mis-tiendas');
  const session = await requireSession();
  const membership = await getMembership(session.user.id, tenant.id);
  if (!membership) redirect('/admin');

  const role = membership.role;
  const canFinancial = hasCapability(role, 'reports.financial');
  const canOperational = hasCapability(role, 'reports.operational');

  if (!canFinancial && !canOperational) redirect('/admin');

  const tabs = [
    { href: '/admin/reportes/ventas', label: 'Ventas', enabled: canFinancial },
    { href: '/admin/reportes/productos', label: 'Productos', enabled: canOperational },
    { href: '/admin/reportes/inventario', label: 'Inventario', enabled: canOperational },
    { href: '/admin/reportes/caja', label: 'Caja', enabled: canFinancial },
    { href: '/admin/reportes/compras', label: 'Compras', enabled: canFinancial },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Métricas del negocio. Los filtros aplican a la pestaña activa.
        </p>
      </div>
      <ReportTabs tabs={tabs} />
      {children}
    </div>
  );
}
