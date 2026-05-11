import { redirect } from 'next/navigation';
import { requireSession, getMembership } from '@/lib/auth/guards';
import { getCurrentTenant } from '@/lib/tenant';
import { hasCapability } from '@/lib/auth/permissions';
import { StubTab } from '../_components/StubTab';

export const dynamic = 'force-dynamic';

export default async function ComprasReportPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect('/mis-tiendas');
  const session = await requireSession();
  const membership = await getMembership(session.user.id, tenant.id);
  if (!membership || !hasCapability(membership.role, 'reports.financial')) {
    redirect('/admin');
  }
  return (
    <StubTab
      title="Reporte de compras"
      description="Gastos por proveedor, costos extras prorrateados, PO recientes."
    />
  );
}
