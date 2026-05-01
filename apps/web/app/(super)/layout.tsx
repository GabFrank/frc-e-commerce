import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/auth/guards';

export default async function SuperLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSuperAdmin();

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r bg-card text-card-foreground p-4">
        <div className="mb-6">
          <Link href="/super" className="font-semibold">
            FRC SaaS
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">Super admin</p>
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          <Link href="/super/tenants" className="rounded px-2 py-1.5 hover:bg-accent">
            Tiendas
          </Link>
          <Link href="/super/planes" className="rounded px-2 py-1.5 hover:bg-accent">
            Planes
          </Link>
        </nav>
        <div className="mt-6 border-t pt-4 text-xs">
          <p className="text-muted-foreground">{user.email}</p>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
