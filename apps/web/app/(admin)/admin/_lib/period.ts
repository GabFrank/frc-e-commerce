import type { DateRange } from '../reportes/_lib/date-range';

export type Period = 'today' | 'week' | 'month';

export const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hoy',
  week: 'Esta semana',
  month: 'Este mes',
};

export const PERIOD_VS_LABELS: Record<Period, string> = {
  today: 'vs ayer',
  week: 'vs semana pasada',
  month: 'vs mes pasado',
};

export function parsePeriod(value: string | undefined): Period {
  return value === 'week' || value === 'month' ? value : 'today';
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfWeek(d: Date): Date {
  // Semana arranca lunes
  const x = startOfDay(d);
  const dow = x.getDay(); // 0=dom, 1=lun, ..., 6=sáb
  const diff = (dow + 6) % 7; // lunes=0, dom=6
  x.setDate(x.getDate() - diff);
  return x;
}

function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

/**
 * Devuelve el rango actual del período + el rango espejo del período inmediato
 * anterior, ambos terminando al mismo offset relativo (para comparar mismo
 * tramo del día/semana/mes contra el anterior).
 */
export function rangesFor(period: Period, now: Date = new Date()): {
  current: DateRange;
  previous: DateRange;
} {
  if (period === 'today') {
    const from = startOfDay(now);
    const to = now;
    const prevFrom = addDays(from, -1);
    const prevTo = addDays(to, -1);
    return {
      current: { from, to, granularity: 'day' },
      previous: { from: prevFrom, to: prevTo, granularity: 'day' },
    };
  }
  if (period === 'week') {
    const from = startOfWeek(now);
    const to = now;
    const prevFrom = addDays(from, -7);
    const prevTo = addDays(to, -7);
    return {
      current: { from, to, granularity: 'day' },
      previous: { from: prevFrom, to: prevTo, granularity: 'day' },
    };
  }
  // month
  const from = startOfMonth(now);
  const to = now;
  const prevFrom = addMonths(from, -1);
  const prevTo = addMonths(to, -1);
  return {
    current: { from, to, granularity: 'day' },
    previous: { from: prevFrom, to: prevTo, granularity: 'day' },
  };
}

/** Rango fijo de últimos 14 días (independiente del toggle) para el trend chart. */
export function last14DaysRange(now: Date = new Date()): DateRange {
  const to = endOfDay(now);
  const from = startOfDay(addDays(now, -13));
  return { from, to, granularity: 'day' };
}

/** Helper de delta %. Si previous=0 y current>0 devuelve null (sin contexto). */
export function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null;
  }
  return ((current - previous) / previous) * 100;
}
