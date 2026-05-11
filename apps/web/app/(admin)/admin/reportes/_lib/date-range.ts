/** Helpers de rango de fechas + granularidad para el módulo de reportes. */

export type Granularity = 'day' | 'week' | 'month';

export type DateRange = {
  from: Date;
  to: Date;
  granularity: Granularity;
};

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

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

function parseISODateLocal(s: string | undefined): Date | null {
  if (!s) return null;
  // datetime-local style "YYYY-MM-DDTHH:MM" o solo fecha "YYYY-MM-DD"
  const d = new Date(s.includes('T') ? s : s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

/** Lee `from`, `to` y `granularity` de URL searchParams con defaults seguros. */
export function parseRange(sp: {
  from?: string;
  to?: string;
  granularity?: string;
}): DateRange {
  const now = new Date();
  const defaultFrom = startOfDay(new Date(now.getTime() - DEFAULT_DAYS * 86400000));
  const defaultTo = endOfDay(now);

  let from = parseISODateLocal(sp.from) ?? defaultFrom;
  let to = parseISODateLocal(sp.to) ?? defaultTo;
  if (from > to) [from, to] = [to, from];

  // Clamp para no pegarle a la DB con rangos absurdos
  const maxFrom = new Date(to.getTime() - MAX_DAYS * 86400000);
  if (from < maxFrom) from = maxFrom;

  const g: Granularity =
    sp.granularity === 'week' || sp.granularity === 'month' ? sp.granularity : 'day';

  return { from, to, granularity: g };
}

/** Formatea para el input type="datetime-local" (es-PY no aplica acá). */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** Para usar en SQL `date_trunc(...)` — devuelve el literal correcto. */
export function granularityTruncUnit(g: Granularity): 'day' | 'week' | 'month' {
  return g;
}

/** Label legible del rango (para títulos de cards). */
export function rangeLabel(r: DateRange): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${fmt(r.from)} – ${fmt(r.to)}`;
}
