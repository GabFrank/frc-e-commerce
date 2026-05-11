'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const RANGES = [
  { label: 'Hoy', days: 0 },
  { label: 'Últimos 7', days: 7 },
  { label: 'Últimos 30', days: 30 },
  { label: 'Últimos 90', days: 90 },
];

function toInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function DateRangeFilter({
  initialFrom,
  initialTo,
  initialGranularity,
}: {
  initialFrom: string;
  initialTo: string;
  initialGranularity: 'day' | 'week' | 'month';
}) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp?.toString() ?? '');
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  };

  const applyPreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    from.setHours(0, 0, 0, 0);
    update({ from: toInput(from), to: toInput(to) });
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs text-muted-foreground">Desde</label>
        <Input
          type="datetime-local"
          value={initialFrom}
          onChange={(e) => update({ from: e.target.value })}
          disabled={pending}
          className="h-9"
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground">Hasta</label>
        <Input
          type="datetime-local"
          value={initialTo}
          onChange={(e) => update({ to: e.target.value })}
          disabled={pending}
          className="h-9"
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground">Granularidad</label>
        <Select
          value={initialGranularity}
          onChange={(e) => update({ granularity: e.target.value })}
          disabled={pending}
          className="h-9"
        >
          <option value="day">Por día</option>
          <option value="week">Por semana</option>
          <option value="month">Por mes</option>
        </Select>
      </div>
      <div className="flex flex-wrap gap-1">
        {RANGES.map((r) => (
          <Button
            key={r.label}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => applyPreset(r.days)}
            disabled={pending}
            className="h-9"
          >
            {r.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
