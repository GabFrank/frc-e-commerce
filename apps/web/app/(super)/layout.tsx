import { requireSuperAdmin } from '@/lib/auth/guards';
import { SuperShell } from '@/components/super/SuperShell';

export default async function SuperLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSuperAdmin();
  return <SuperShell email={user.email}>{children}</SuperShell>;
}
