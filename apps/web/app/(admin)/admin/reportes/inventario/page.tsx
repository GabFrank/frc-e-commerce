import { redirect } from 'next/navigation';
import { requireSession, getMembership } from '@/lib/auth/guards';
import { getCurrentTenant } from '@/lib/tenant';
import { hasCapability } from '@/lib/auth/permissions';
import { StubTab } from '../_components/StubTab';

export const dynamic = 'force-dynamic';

export default async function InventarioReportPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect('/mis-tiendas');
  const session = await requireSession();
  const membership = await getMembership(session.user.id, tenant.id);
  if (!membership || !hasCapability(membership.role, 'reports.operational')) {
    redirect('/admin');
  }
  return (
    <StubTab
      title="Reporte de inventario"
      description="Valor total al avg_cost + audit log de movimientos del período."
    />
  );
}
