import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { requireSession, getMembership } from '@/lib/auth/guards';
import { getCurrentTenant, TENANT_OVERRIDE_COOKIE } from '@/lib/tenant';
import { db } from '@/lib/db';
import { user as userTable } from '@frc-e-commerce/db/schema';
import { ExitTenantOverrideButton } from '@/components/admin/exit-tenant-override-button';

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

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r p-4 flex flex-col">
        <div className="mb-6">
          <Link href="/admin" className="font-semibold">
            {tenant.name}
          </Link>
          <p className="mt-1 text-xs text-zinc-500">Admin</p>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            ↗ Ver tienda pública
          </a>
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
        <div className="mt-auto pt-4 border-t text-xs space-y-2">
          <div>
            <p className="text-zinc-500 truncate">{session.user.email}</p>
            <p className="mt-1 text-zinc-400">Rol: {membership.role}</p>
          </div>
          <Link
            href="/mis-tiendas"
            className="block rounded px-2 py-1.5 text-zinc-600 hover:bg-zinc-100"
          >
            ← Mis tiendas
          </Link>
          {isSuperAdmin && (
            <Link
              href="/super"
              className="block rounded px-2 py-1.5 text-zinc-600 hover:bg-zinc-100"
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
