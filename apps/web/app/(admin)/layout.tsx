import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireSession, getMembership } from '@/lib/auth/guards';
import { getCurrentTenant } from '@/lib/tenant';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant().catch(() => null);
  if (!tenant) redirect('/');

  const session = await requireSession();
  const membership = await getMembership(session.user.id, tenant.id);
  if (!membership) redirect('/');

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r p-4">
        <div className="mb-6">
          <Link href="/admin" className="font-semibold">
            {tenant.name}
          </Link>
          <p className="mt-1 text-xs text-zinc-500">Admin</p>
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          <Link href="/admin/productos" className="rounded px-2 py-1.5 hover:bg-zinc-100">
            Productos
          </Link>
          <Link href="/admin/pedidos" className="rounded px-2 py-1.5 hover:bg-zinc-100">
            Pedidos
          </Link>
          <Link href="/admin/configuracion" className="rounded px-2 py-1.5 hover:bg-zinc-100">
            Configuración
          </Link>
        </nav>
        <div className="mt-6 border-t pt-4 text-xs">
          <p className="text-zinc-500">{session.user.email}</p>
          <p className="mt-1 text-zinc-400">Rol: {membership.role}</p>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
