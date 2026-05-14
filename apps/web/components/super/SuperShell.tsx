'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? '';
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const linkCls = (href: string) =>
    `flex items-center rounded px-2 py-2.5 hover:bg-accent md:py-1.5 ${isActive(href) ? 'bg-accent font-medium' : ''}`;

  return (
    <nav className="flex flex-col gap-1 text-base md:text-sm">
      <Link href="/super/tenants" className={linkCls('/super/tenants')} onClick={onNavigate}>
        Tiendas
      </Link>
      <Link href="/super/planes" className={linkCls('/super/planes')} onClick={onNavigate}>
        Planes
      </Link>
    </nav>
  );
}

function SidebarContent({
  email,
  onNavigate,
}: {
  email: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-6">
        <Link href="/super" className="text-base font-semibold md:text-sm" onClick={onNavigate}>
          FRC SaaS
        </Link>
        <p className="mt-1 text-sm text-muted-foreground md:text-xs">Super admin</p>
      </div>
      <NavLinks onNavigate={onNavigate} />
      <div className="mt-auto border-t pt-4 text-sm md:text-xs">
        <p className="truncate text-muted-foreground">{email}</p>
      </div>
    </div>
  );
}

export function SuperShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b bg-background px-4 md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menú"
          className="inline-flex h-11 w-11 items-center justify-center rounded hover:bg-muted"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="text-base font-semibold">FRC SaaS · Super</div>
        <div className="w-11" aria-hidden />
      </header>

      <aside className="hidden md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:sticky md:top-0 md:border-r md:bg-card md:p-4 md:text-card-foreground">
        <SidebarContent email={email} />
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="flex w-72 max-w-[85vw] flex-col p-4 sm:max-w-[85vw]">
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <SidebarContent email={email} onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
