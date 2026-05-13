import Link from 'next/link';
import { Wallet, Package, ShoppingCart, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  formatAmount,
  formatNumber,
  getCurrencyDecimalPlaces,
} from '@frc-e-commerce/shared-utils';
import type { LastClosedSession, OpenCashSession, ProductStats } from '../reportes/_lib/queries';

type Props = {
  primaryCurrency: string;
  openSessions: OpenCashSession[];
  lastClosed: LastClosedSession | null;
  productStats: ProductStats;
  pendingPOsCount: number;
  pendingPOsTotalsByCurrency: Array<{ currencyCode: string; total: number }>;
  showCash: boolean;
  showInventory: boolean;
  showPurchases: boolean;
};

export function OperativeSummaryCards({
  primaryCurrency,
  openSessions,
  lastClosed,
  productStats,
  pendingPOsCount,
  pendingPOsTotalsByCurrency,
  showCash,
  showInventory,
  showPurchases,
}: Props) {
  const visibleCount = [showCash, showInventory, showPurchases].filter(Boolean).length;
  if (visibleCount === 0) return null;

  const dpPrimary = getCurrencyDecimalPlaces(primaryCurrency);
  const fmtPrimary = (minor: number) =>
    formatAmount(minor / Math.pow(10, dpPrimary), primaryCurrency);

  return (
    <div
      className={`grid gap-3 ${
        visibleCount === 1
          ? 'grid-cols-1'
          : visibleCount === 2
            ? 'grid-cols-1 md:grid-cols-2'
            : 'grid-cols-1 md:grid-cols-3'
      }`}
    >
      {showCash && (
        <SummaryCard
          title="Caja"
          icon={Wallet}
          iconColor="text-emerald-600 dark:text-emerald-400"
          iconBg="bg-emerald-500/10"
          primary={
            <>
              <span className="font-mono">{openSessions.length}</span>{' '}
              <span className="text-base font-normal text-muted-foreground">
                {openSessions.length === 1 ? 'sesión abierta' : 'sesiones abiertas'}
              </span>
            </>
          }
          rows={[
            openSessions.length > 0 && {
              label: 'Cajero/a',
              value: openSessions
                .slice(0, 2)
                .map((s) => s.cashierName ?? 'sin nombre')
                .join(', ') + (openSessions.length > 2 ? ` +${openSessions.length - 2}` : ''),
            },
            lastClosed && {
              label: 'Último cierre',
              value: formatDiffsList(lastClosed.diffsByCurrency) || 'sin diferencias',
              tone: hasNonZeroDiff(lastClosed.diffsByCurrency) ? 'warning' : 'muted',
            },
            !lastClosed && openSessions.length === 0 && {
              label: '',
              value: 'Sin actividad de caja todavía',
              tone: 'muted',
            },
          ]}
          href="/admin/financiero/cajas"
          linkLabel="Ver cajas"
        />
      )}

      {showInventory && (
        <SummaryCard
          title="Inventario"
          icon={Package}
          iconColor="text-blue-600 dark:text-blue-400"
          iconBg="bg-blue-500/10"
          primary={
            <>
              <span className="font-mono">{fmtPrimary(productStats.inventoryValue)}</span>
              <span className="ml-1 text-xs font-normal text-muted-foreground">en stock</span>
            </>
          }
          rows={[
            {
              label: 'Variantes activas',
              value: formatNumber(productStats.totalActiveVariants, 0),
            },
            productStats.lowStock > 0 && {
              label: 'Stock bajo',
              value: `${productStats.lowStock}`,
              tone: 'warning',
            },
            productStats.zeroStock > 0 && {
              label: 'Sin stock',
              value: `${productStats.zeroStock}`,
              tone: 'destructive',
            },
          ]}
          href="/admin/productos"
          linkLabel="Ver productos"
        />
      )}

      {showPurchases && (
        <SummaryCard
          title="Compras"
          icon={ShoppingCart}
          iconColor="text-amber-600 dark:text-amber-400"
          iconBg="bg-amber-500/10"
          primary={
            <>
              <span className="font-mono">{pendingPOsCount}</span>{' '}
              <span className="text-base font-normal text-muted-foreground">
                {pendingPOsCount === 1 ? 'pedido sin recibir' : 'pedidos sin recibir'}
              </span>
            </>
          }
          rows={[
            ...pendingPOsTotalsByCurrency
              .filter((p) => p.total > 0)
              .map((p) => ({
                label: 'Pendiente',
                value: formatAmount(
                  p.total / Math.pow(10, getCurrencyDecimalPlaces(p.currencyCode)),
                  p.currencyCode
                ),
              })),
            pendingPOsCount === 0 && {
              label: '',
              value: 'Todo al día',
              tone: 'muted',
            },
          ]}
          href="/admin/compras"
          linkLabel="Ver compras"
        />
      )}
    </div>
  );
}

type Row =
  | false
  | null
  | undefined
  | {
      label: string;
      value: string;
      tone?: 'muted' | 'warning' | 'destructive';
    };

function SummaryCard({
  title,
  icon: Icon,
  iconColor,
  iconBg,
  primary,
  rows,
  href,
  linkLabel,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  primary: React.ReactNode;
  rows: Row[];
  href: string;
  linkLabel: string;
}) {
  return (
    <Card className="group flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 pt-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </span>
          <div className={`rounded-full p-2 ${iconBg}`}>
            <Icon className={`h-4 w-4 ${iconColor}`} />
          </div>
        </div>
        <div className="text-2xl font-semibold leading-none">{primary}</div>
        <div className="space-y-1 text-xs">
          {rows.filter(Boolean).map((r, i) => {
            const row = r as Exclude<Row, false | null | undefined>;
            const toneClass =
              row.tone === 'warning'
                ? 'text-amber-700 dark:text-amber-400'
                : row.tone === 'destructive'
                  ? 'text-destructive'
                  : 'text-muted-foreground';
            return (
              <div key={i} className="flex items-center justify-between gap-2">
                {row.label && <span className="text-muted-foreground">{row.label}</span>}
                <span className={`font-mono ${toneClass} ${row.label ? '' : 'flex-1'}`}>
                  {row.value}
                </span>
              </div>
            );
          })}
        </div>
        <Link
          href={href}
          className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {linkLabel}
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </CardContent>
    </Card>
  );
}

function hasNonZeroDiff(list: Array<{ diff: number }>): boolean {
  return list.some((d) => d.diff !== 0);
}

function formatDiffsList(diffs: Array<{ currencyCode: string; diff: number }>): string {
  const nonZero = diffs.filter((d) => d.diff !== 0);
  if (nonZero.length === 0) return '';
  return nonZero
    .map((d) => {
      const dp = getCurrencyDecimalPlaces(d.currencyCode);
      const major = d.diff / Math.pow(10, dp);
      const sign = major > 0 ? '+' : '';
      return `${sign}${formatAmount(major, d.currencyCode)}`;
    })
    .join(' · ');
}
