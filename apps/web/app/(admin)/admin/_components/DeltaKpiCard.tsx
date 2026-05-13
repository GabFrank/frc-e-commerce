import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

type DeltaUnit = 'pct' | 'pt';

export function DeltaKpiCard({
  title,
  value,
  current,
  previous,
  deltaUnit = 'pct',
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  current: number;
  previous: number;
  /** 'pct' → calcula % de variación. 'pt' → muestra diferencia absoluta + 'pt' (puntos). */
  deltaUnit?: DeltaUnit;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const { label, tone } = computeDelta(current, previous, deltaUnit);

  const toneClass =
    tone === 'positive'
      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
      : tone === 'negative'
        ? 'text-destructive bg-destructive/10'
        : 'text-muted-foreground bg-muted';

  const TrendIcon =
    tone === 'positive' ? TrendingUp : tone === 'negative' ? TrendingDown : Minus;

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          {Icon && (
            <div className="rounded-full bg-primary/10 p-1.5">
              <Icon className="h-3.5 w-3.5 text-primary" />
            </div>
          )}
        </div>
        <p className="font-mono text-2xl font-semibold tracking-tight">{value}</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${toneClass}`}
          >
            <TrendIcon className="h-3 w-3" />
            {label}
          </span>
          {description && (
            <span className="text-[11px] text-muted-foreground">{description}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function computeDelta(
  current: number,
  previous: number,
  unit: DeltaUnit
): { label: string; tone: 'positive' | 'negative' | 'muted' } {
  if (previous === 0 && current === 0) {
    return { label: 'Sin cambios', tone: 'muted' };
  }
  if (unit === 'pt') {
    const diff = current - previous;
    const sign = diff > 0 ? '+' : diff < 0 ? '−' : '±';
    const abs = Math.abs(diff).toFixed(1).replace('.', ',');
    if (diff === 0) return { label: '0 pt', tone: 'muted' };
    return {
      label: `${sign}${abs} pt`,
      tone: diff > 0 ? 'positive' : 'negative',
    };
  }
  if (previous === 0) {
    return { label: 'Nuevo', tone: 'positive' };
  }
  const pct = ((current - previous) / previous) * 100;
  const sign = pct > 0 ? '+' : pct < 0 ? '−' : '±';
  if (Math.abs(pct) < 0.05) return { label: '±0%', tone: 'muted' };
  return {
    label: `${sign}${Math.abs(pct).toFixed(1).replace('.', ',')}%`,
    tone: pct > 0 ? 'positive' : 'negative',
  };
}
