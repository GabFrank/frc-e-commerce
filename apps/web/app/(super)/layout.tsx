import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/auth/guards';

export default async function SuperLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSuperAdmin();

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r bg-zinc-950 text-zinc-100 p-4">
        <div className="mb-6">
          <Link href="/super" className="font-semibold">
            FRC SaaS
          </Link>
          <p className="mt-1 text-xs text-zinc-400">Super admin</p>
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          <Link href="/super/tenants" className="rounded px-2 py-1.5 hover:bg-zinc-800">
            Tiendas
          </Link>
          <Link href="/super/planes" className="rounded px-2 py-1.5 hover:bg-zinc-800">
            Planes
          </Link>
        </nav>
        <div className="mt-6 border-t border-zinc-800 pt-4 text-xs">
          <p className="text-zinc-400">{user.email}</p>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
