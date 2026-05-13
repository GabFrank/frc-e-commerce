'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Sparkles } from 'lucide-react';
import type { Period } from '../_lib/period';
import { PERIOD_LABELS } from '../_lib/period';

const PERIODS: Period[] = ['today', 'week', 'month'];

export function DashboardHero({
  greeting,
  subtitle,
  period,
}: {
  greeting: string;
  subtitle: string;
  period: Period;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startNav] = useTransition();

  const setPeriod = (next: Period) => {
    const sp = new URLSearchParams(searchParams?.toString() ?? '');
    if (next === 'today') sp.delete('p');
    else sp.set('p', next);
    startNav(() => router.push(sp.toString() ? `?${sp.toString()}` : '?'));
  };

  return (
    <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-card to-card p-5">
      <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Resumen del negocio
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="inline-flex items-center rounded-full border bg-card p-0.5 shadow-sm">
          {PERIODS.map((p) => {
            const active = p === period;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                disabled={pending}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
