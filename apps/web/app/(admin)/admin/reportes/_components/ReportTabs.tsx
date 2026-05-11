'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

type Tab = {
  href: string;
  label: string;
  enabled: boolean;
};

export function ReportTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname() ?? '';
  const sp = useSearchParams();
  const qs = sp?.toString();

  return (
    <div className="border-b">
      <nav className="-mb-px flex flex-wrap gap-1">
        {tabs.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + '/');
          const href = qs ? `${t.href}?${qs}` : t.href;
          if (!t.enabled) {
            return (
              <span
                key={t.href}
                className="cursor-not-allowed border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground/40"
                title="No tenés permiso para este reporte"
              >
                {t.label}
              </span>
            );
          }
          return (
            <Link
              key={t.href}
              href={href}
              className={`border-b-2 px-3 py-2 text-sm transition-colors ${
                active
                  ? 'border-primary font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
