'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/theme-toggle';

const NAV_ITEMS = [
  { href: '/productos', label: 'Productos' },
  { href: '/carrito', label: 'Carrito' },
  { href: '/cuenta', label: 'Cuenta' },
];

export function StorefrontHeader({ tenantName }: { tenantName: string }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link href="/" className="truncate text-base font-semibold sm:text-lg">
          {tenantName}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-4 text-sm sm:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="hover:underline">
              {item.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>

        {/* Mobile trigger */}
        <div className="flex items-center gap-1 sm:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
            className="inline-flex h-9 w-9 items-center justify-center rounded hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="flex w-72 max-w-[85vw] flex-col gap-6 p-6 sm:max-w-[85vw]">
          <SheetTitle>{tenantName}</SheetTitle>
          <nav className="flex flex-col gap-1 text-base">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className="rounded px-3 py-2 hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}
