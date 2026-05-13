import Link from 'next/link';
import { AlertTriangle, Clock, Coins, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatAmount, getCurrencyDecimalPlaces } from '@frc-e-commerce/shared-utils';
import type { LastClosedSession } from '../reportes/_lib/queries';

type Alert = {
  icon: React.ComponentType<{ className?: string }>;
  text: React.ReactNode;
  href: string;
  cta: string;
};

export function DashboardAlerts({
  lowStockCount,
  zeroStockCount,
  stalePOsCount,
  lastClosed,
}: {
  lowStockCount: number;
  zeroStockCount: number;
  stalePOsCount: number;
  lastClosed: LastClosedSession | null;
}) {
  const alerts: Alert[] = [];

  if (zeroStockCount > 0) {
    alerts.push({
      icon: AlertTriangle,
      text: (
        <>
          <strong>{zeroStockCount}</strong>{' '}
          {zeroStockCount === 1 ? 'variante' : 'variantes'} sin stock
        </>
      ),
      href: '/admin/productos?stock=zero',
      cta: 'Ver productos',
    });
  }

  if (lowStockCount > 0) {
    alerts.push({
      icon: AlertTriangle,
      text: (
        <>
          <strong>{lowStockCount}</strong>{' '}
          {lowStockCount === 1 ? 'variante' : 'variantes'} con stock bajo (&lt;5)
        </>
      ),
      href: '/admin/productos?stock=low',
      cta: 'Reponer',
    });
  }

  if (stalePOsCount > 0) {
    alerts.push({
      icon: Clock,
      text: (
        <>
          <strong>{stalePOsCount}</strong> {stalePOsCount === 1 ? 'PO pedida' : 'POs pedidas'} sin
          recibir hace +7 días
        </>
      ),
      href: '/admin/compras?status=placed',
      cta: 'Revisar',
    });
  }

  if (lastClosed) {
    const nonZero = lastClosed.diffsByCurrency.filter((d) => d.diff !== 0);
    if (nonZero.length > 0) {
      const summary = nonZero
        .map((d) => {
          const dp = getCurrencyDecimalPlaces(d.currencyCode);
          const major = d.diff / Math.pow(10, dp);
          const sign = major > 0 ? '+' : '';
          return `${sign}${formatAmount(major, d.currencyCode)}`;
        })
        .join(' · ');
      alerts.push({
        icon: Coins,
        text: (
          <>
            Último cierre con diferencia: <strong>{summary}</strong>
          </>
        ),
        href: `/admin/financiero/cajas/${lastClosed.sessionId}`,
        cta: 'Inspeccionar',
      });
    }
  }

  if (alerts.length === 0) return null;

  return (
    <Card className="border-amber-300/60 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20">
      <CardContent className="space-y-2 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Alertas ({alerts.length})
        </p>
        <ul className="divide-y divide-amber-200/40 dark:divide-amber-900/40">
          {alerts.map((a, i) => {
            const Icon = a.icon;
            return (
              <li key={i} className="flex items-center gap-3 py-2 text-sm">
                <Icon className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="flex-1">{a.text}</span>
                <Link
                  href={a.href}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
                >
                  {a.cta}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
