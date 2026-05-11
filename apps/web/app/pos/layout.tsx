import { redirect } from 'next/navigation';
import { requireSession, getMembership } from '@/lib/auth/guards';
import { getCurrentTenant } from '@/lib/tenant';
import { hasCapability } from '@/lib/auth/permissions';

export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant().catch(() => null);
  if (!tenant) redirect('/mis-tiendas');

  const session = await requireSession();
  const membership = await getMembership(session.user.id, tenant.id);
  if (!membership) redirect('/mis-tiendas');

  if (!hasCapability(membership.role, 'pos.sell')) {
    redirect('/admin');
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground overflow-hidden">
      {children}
    </div>
  );
}
