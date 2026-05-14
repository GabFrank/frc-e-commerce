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
    return `flex items-center rounded px-2 py-2.5 md:py-1.5 hover:bg-muted ${active ? 'bg-muted font-medium' : ''}`;
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-6">
        <Link href="/admin" className="text-base font-semibold md:text-sm" onClick={onNavigate}>
          {config.tenantName}
        </Link>
        <p className="mt-1 text-sm text-muted-foreground md:text-xs">Admin</p>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline md:text-xs"
        >
          ↗ Ver tienda pública
        </a>
      </div>
      <nav className="flex flex-1 min-h-0 flex-col gap-1 overflow-y-auto text-base md:text-sm">
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
          className="mt-2 rounded bg-primary px-2 py-2.5 text-center font-medium text-primary-foreground hover:bg-primary/90 md:py-1.5"
          onClick={onNavigate}
        >
          Abrir POS →
        </Link>
      </nav>
      <div className="mt-4 space-y-2 border-t pt-4 text-sm md:text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-muted-foreground">{config.userEmail}</p>
            <p className="mt-1 text-muted-foreground/80">Rol: {config.role}</p>
          </div>
          <ThemeToggle />
        </div>
        <Link
          href="/mis-tiendas"
          className="flex items-center rounded px-2 py-2 text-muted-foreground hover:bg-muted md:py-1.5"
          onClick={onNavigate}
        >
          ← Mis tiendas
        </Link>
        {config.isSuperAdmin && (
          <Link
            href="/super"
            className="flex items-center rounded px-2 py-2 text-muted-foreground hover:bg-muted md:py-1.5"
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
