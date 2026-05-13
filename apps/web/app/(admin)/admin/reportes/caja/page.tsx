import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireSession, getMembership } from '@/lib/auth/guards';
import { getCurrentTenant } from '@/lib/tenant';
import { hasCapability } from '@/lib/auth/permissions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { KpiCard } from '../_components/KpiCard';
import { DateRangeFilter } from '../_components/DateRangeFilter';
import { parseRange, rangeLabel, toLocalInput } from '../_lib/date-range';
import {
  formatNumber,
  formatAmount,
  getCurrencyDecimalPlaces,
} from '@frc-e-commerce/shared-utils';
import {
  getCashKpis,
  getCashierRanking,
  getClosuresInRange,
} from '../_lib/queries';

export const dynamic = 'force-dynamic';

type SP = { from?: string; to?: string; granularity?: string };

export default async function CajaReportPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect('/mis-tiendas');
  const session = await requireSession();
  const membership = await getMembership(session.user.id, tenant.id);
  if (!membership || !hasCapability(membership.role, 'reports.financial')) {
    redirect('/admin');
  }

  const sp = await searchParams;
  const range = parseRange(sp);

  const [kpis, ranking, closures] = await Promise.all([
    getCashKpis(tenant.id, range),
    getCashierRanking(tenant.id, range),
    getClosuresInRange(tenant.id, range, 50),
  ]);

  const fmt = (n: number) => formatNumber(n, 0);
  /** Diff en minor units → major formateado con su moneda nativa. */
  const fmtDiffCurrency = (n: number, currency: string) => {
    const dp = getCurrencyDecimalPlaces(currency);
    const major = n / Math.pow(10, dp);
    const signed = `${major > 0 ? '+' : ''}${formatAmount(major, currency)}`;
    return signed;
  };
  const hasAnyDiff = kpis.diffsByCurrency.some((d) => d.diff !== 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Período</CardTitle>
          <CardDescription>{rangeLabel(range)} · sesiones cerradas en este rango</CardDescription>
        </CardHeader>
        <CardContent>
          <DateRangeFilter
            initialFrom={toLocalInput(range.from)}
            initialTo={toLocalInput(range.to)}
            initialGranularity={range.granularity}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          title="Cierres de caja"
          value={fmt(kpis.totalClosures)}
          description={`${fmt(kpis.totalTransactions)} tickets totales`}
        />
        <KpiCard
          title="Ventas totales"
          value={fmt(kpis.totalSales)}
          description={`Devol: ${fmt(kpis.totalReturns)} · Cancel: ${fmt(kpis.totalCancellations)}`}
        />
        <KpiCard
          title="Diferencia de conteo"
          value={
            !hasAnyDiff
              ? 'Sin diferencias'
              : kpis.diffsByCurrency
                  .filter((d) => d.diff !== 0)
                  .map((d) => fmtDiffCurrency(d.diff, d.currencyCode))
                  .join(' · ')
          }
          description={
            kpis.diffsByCurrency.length > 1
              ? 'Agrupado por moneda (no se mezclan)'
              : 'Acumulado del período'
          }
          tone={!hasAnyDiff ? 'muted' : 'negative'}
        />
        <KpiCard
          title="Ticket promedio"
          value={fmt(
            kpis.totalTransactions > 0
              ? Math.round(kpis.totalSales / kpis.totalTransactions)
              : 0
          )}
          description="Sobre cierres del período"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking de cajeros</CardTitle>
          <CardDescription>Por ventas en el período</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Cajero</th>
                  <th className="px-3 py-2 text-right">Sesiones</th>
                  <th className="px-3 py-2 text-right">Tickets</th>
                  <th className="px-3 py-2 text-right">Ventas</th>
                  <th className="px-3 py-2 text-right">Ticket promedio</th>
                </tr>
              </thead>
              <tbody>
                {ranking.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      Sin cierres en el período.
                    </td>
                  </tr>
                )}
                {ranking.map((c, i) => (
                  <tr key={c.cashierId} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{c.cashierName ?? c.cashierEmail}</div>
                      {c.cashierName && (
                        <div className="text-xs text-muted-foreground">{c.cashierEmail}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(c.sessions)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(c.totalTickets)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(c.totalSales)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(c.avgTicket)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cierres del período</CardTitle>
          <CardDescription>Últimos 50, ordenados por cierre desc</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Cajero</th>
                  <th className="px-3 py-2 text-left">Apertura</th>
                  <th className="px-3 py-2 text-left">Cierre</th>
                  <th className="px-3 py-2 text-right">Tickets</th>
                  <th className="px-3 py-2 text-right">Ventas</th>
                  <th className="px-3 py-2 text-right">Devol.</th>
                  <th className="px-3 py-2 text-right">Diferencia</th>
                  <th className="px-3 py-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {closures.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      Sin cierres en el período.
                    </td>
                  </tr>
                )}
                {closures.map((c) => (
                  <tr key={c.sessionId} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">{c.cashierName ?? c.cashierEmail}</td>
                    <td className="px-3 py-2 text-xs">
                      {new Date(c.openedAt).toLocaleString('es-PY')}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {c.closedAt ? new Date(c.closedAt).toLocaleString('es-PY') : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(c.totalTransactions)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(c.totalSales)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(c.totalReturns)}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {(() => {
                        const nonZero = c.diffsByCurrency.filter((d) => d.diff !== 0);
                        if (nonZero.length === 0)
                          return <span className="text-muted-foreground">0</span>;
                        return (
                          <div className="flex flex-col items-end gap-0.5">
                            {nonZero.map((d) => (
                              <span
                                key={d.currencyCode}
                                className={
                                  d.diff > 0
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-destructive'
                                }
                              >
                                {fmtDiffCurrency(d.diff, d.currencyCode)}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/admin/financiero/cajas/${c.sessionId}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
