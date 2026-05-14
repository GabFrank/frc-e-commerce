'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export type SidebarNavItem = {
  href: string;
  label: string;
};

export function SidebarNavGroup({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: SidebarNavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? '';
  const containsActive = items.some((it) => pathname.startsWith(it.href));
  const [open, setOpen] = useState(containsActive);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded px-2 py-2.5 text-left hover:bg-muted md:py-1.5"
      >
        <span>{label}</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="ml-2 mt-0.5 flex flex-col border-l pl-2">
          {items.map((it) => {
            const active = pathname === it.href || pathname.startsWith(it.href + '/');
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={onNavigate}
                className={`flex items-center rounded px-2 py-2 text-base md:py-1 md:text-sm ${
                  active ? 'bg-muted font-medium' : 'hover:bg-muted'
                }`}
              >
                {it.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
