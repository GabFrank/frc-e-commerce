'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SidebarNavGroup, type SidebarNavItem } from './SidebarNavGroup';
import { ExitTenantOverrideButton } from './exit-tenant-override-button';
import { ThemeToggle } from '@/components/theme-toggle';

export type AdminSidebarConfig = {
  tenantName: string;
  userEmail: string;
  role: string;
  financieroItems: SidebarNavItem[];
  canSeeConfig: boolean;
  canSeeReportes: boolean;
  isSuperAdmin: boolean;
  isOverrideActive: boolean;
};

export function AdminSidebarContent({
  config,
  onNavigate,
}: {
  config: AdminSidebarConfig;
  /** Called when a nav link is clicked — used to close the mobile drawer */
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? '';

  const linkClass = (href: string) => {
    const active = pathname === href || pathname.startsWith(href + '/');
    return `rounded px-2 py-1.5 hover:bg-muted ${active ? 'bg-muted font-medium' : ''}`;
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-6">
        <Link href="/admin" className="font-semibold" onClick={onNavigate}>
          {config.tenantName}
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
      <nav className="flex flex-1 min-h-0 flex-col gap-1 overflow-y-auto text-sm">
        <Link href="/admin/productos" className={linkClass('/admin/productos')} onClick={onNavigate}>
          Productos
        </Link>
        {config.financieroItems.length > 0 && (
          <SidebarNavGroup
            label="Financiero"
            items={config.financieroItems}
            onNavigate={onNavigate}
          />
        )}
        {config.canSeeReportes && (
          <Link href="/admin/reportes" className={linkClass('/admin/reportes')} onClick={onNavigate}>
            Reportes
          </Link>
        )}
        {config.canSeeConfig && (
          <Link
            href="/admin/configuracion"
            className={linkClass('/admin/configuracion')}
            onClick={onNavigate}
          >
            Configuración
          </Link>
        )}
        <Link
          href="/pos"
          className="mt-2 rounded bg-primary px-2 py-1.5 text-center font-medium text-primary-foreground hover:bg-primary/90"
          onClick={onNavigate}
        >
          Abrir POS →
        </Link>
      </nav>
      <div className="mt-4 border-t pt-4 text-xs space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-muted-foreground truncate">{config.userEmail}</p>
            <p className="mt-1 text-muted-foreground/80">Rol: {config.role}</p>
          </div>
          <ThemeToggle />
        </div>
        <Link
          href="/mis-tiendas"
          className="block rounded px-2 py-1.5 text-muted-foreground hover:bg-muted"
          onClick={onNavigate}
        >
          ← Mis tiendas
        </Link>
        {config.isSuperAdmin && (
          <Link
            href="/super"
            className="block rounded px-2 py-1.5 text-muted-foreground hover:bg-muted"
            onClick={onNavigate}
          >
            Panel super
          </Link>
        )}
        {config.isOverrideActive && <ExitTenantOverrideButton />}
      </div>
    </div>
  );
}
