'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { AdminSidebarContent, type AdminSidebarConfig } from './AdminSidebarContent';

export function AdminShell({
  config,
  children,
}: {
  config: AdminSidebarConfig;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background px-4 md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menú"
          className="inline-flex h-11 w-11 items-center justify-center rounded hover:bg-muted"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="truncate text-base font-semibold">{config.tenantName}</div>
        <div className="w-11" aria-hidden />
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:sticky md:top-0 md:border-r md:p-4">
        <AdminSidebarContent config={config} />
      </aside>

      {/* Mobile drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="flex w-72 max-w-[85vw] flex-col p-4 sm:max-w-[85vw]">
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <AdminSidebarContent config={config} onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
