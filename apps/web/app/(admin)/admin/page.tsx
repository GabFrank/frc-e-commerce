import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import {
  formatAmount,
  formatNumber,
  getCurrencyDecimalPlaces,
} from '@frc-e-commerce/shared-utils';
import { Coins, Receipt, TrendingUp, Boxes } from 'lucide-react';
import { requireSession, getMembership } from '@/lib/auth/guards';
import { getCurrentTenant } from '@/lib/tenant';
import { hasCapability } from '@/lib/auth/permissions';
import {
  getCashKpis,
  getLastClosedSession,
  getOpenCashSessions,
  getPrimaryCurrencyCode,
  getProductStats,
  getRecentPurchaseOrders,
  getRecentTickets,
  getSalesKpis,
  getSalesSeries,
  getStalePendingPOs,
  getTopProducts,
} from './reportes/_lib/queries';
import {
  last14DaysRange,
  parsePeriod,
  rangesFor,
  PERIOD_VS_LABELS,
} from './_lib/period';
import { DashboardHero } from './_components/DashboardHero';
import { DeltaKpiCard } from './_components/DeltaKpiCard';
import { TrendAreaChart } from './_components/TrendAreaChart';
import { OperativeSummaryCards } from './_components/OperativeSummaryCards';
import { DashboardAlerts } from './_components/DashboardAlerts';
import { QuickActions } from './_components/QuickActions';
import { TopProductsMini } from './_components/TopProductsMini';
import { RecentActivity } from './_components/RecentActivity';

export const dynamic = 'force-dynamic';

type SP = { p?: string };

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect('/mis-tiendas');
  const session = await requireSession();
  const membership = await getMembership(session.user.id, tenant.id);
  if (!membership) redirect('/mis-tiendas');

  const sp = await searchParams;
  const period = parsePeriod(sp.p);
  const { current, previous } = rangesFor(period);
  const trendRange = last14DaysRange();

  const role = membership.role;
  const canFinancial = hasCapability(role, 'reports.financial');
  const canOperational = hasCapability(role, 'reports.operational');
  const canPurchaseView = hasCapability(role, 'purchase.view');
  const canSell = hasCapability(role, 'pos.sell');
  const canPurchaseWrite = hasCapability(role, 'purchase.write');
  const canProductWrite = hasCapability(role, 'product.write');
  const canReports = canFinancial || canOperational;

  const [
    primaryCurrency,
    salesCurrent,
    salesPrevious,
    salesSeries,
    productStats,
    cashKpis,
    openSessions,
    lastClosed,
    stalePOs,
    topProducts,
    recentTickets,
    recentPOs,
  ] = await Promise.all([
    getPrimaryCurrencyCode(tenant.id),
    canFinancial
      ? getSalesKpis(tenant.id, current)
      : Promise.resolve(emptySalesKpis()),
    canFinancial
      ? getSalesKpis(tenant.id, previous)
      : Promise.resolve(emptySalesKpis()),
    canFinancial
      ? getSalesSeries(tenant.id, trendRange)
      : Promise.resolve([]),
    canOperational || canFinancial
      ? getProductStats(tenant.id, 5)
      : Promise.resolve(emptyProductStats()),
    canFinancial
      ? getCashKpis(tenant.id, current)
      : Promise.resolve(emptyCashKpis()),
    canFinancial ? getOpenCashSessions(tenant.id) : Promise.resolve([]),
    canFinancial ? getLastClosedSession(tenant.id) : Promise.resolve(null),
    canPurchaseView
      ? getStalePendingPOs(tenant.id, 7)
      : Promise.resolve({ count: 0, totalInCurrencyByCode: [] }),
    canFinancial
      ? getTopProducts(tenant.id, current, 5)
      : Promise.resolve([]),
    canFinancial
      ? getRecentTickets(tenant.id, current, 5)
      : Promise.resolve([]),
    canPurchaseView
      ? getRecentPurchaseOrders(tenant.id, current, 5)
      : Promise.resolve([]),
  ]);

  const dpPrimary = getCurrencyDecimalPlaces(primaryCurrency);
  const fmtPrimary = (minor: number) =>
    formatAmount(minor / Math.pow(10, dpPrimary), primaryCurrency);

  const greetingName =
    session.user.name?.split(' ')[0] ?? session.user.email.split('@')[0];
  const greeting = `Hola, ${greetingName}`;
  const subtitle = `${tenant.name} · ${role}`;

  // Trend data: fill missing days con 0 para que el chart no quede entrecortado
  const trendData = buildTrendSeries(trendRange.from, trendRange.to, salesSeries, dpPrimary);

  return (
    <div className="space-y-4">
      <DashboardHero greeting={greeting} subtitle={subtitle} period={period} />

      {canFinancial && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <DeltaKpiCard
            title="Ventas"
            value={fmtPrimary(salesCurrent.netSales)}
            current={salesCurrent.netSales}
            previous={salesPrevious.netSales}
            description={PERIOD_VS_LABELS[period]}
            icon={Coins}
          />
          <DeltaKpiCard
            title="Tickets"
            value={String(salesCurrent.ticketCount)}
            current={salesCurrent.ticketCount}
            previous={salesPrevious.ticketCount}
            description={PERIOD_VS_LABELS[period]}
            icon={Receipt}
          />
          <DeltaKpiCard
            title="Margen"
            value={`${salesCurrent.marginPct.toFixed(1).replace('.', ',')}%`}
            current={salesCurrent.marginPct}
            previous={salesPrevious.marginPct}
            deltaUnit="pt"
            description={PERIOD_VS_LABELS[period]}
            icon={TrendingUp}
          />
          <DeltaKpiCard
            title="Unidades"
            value={formatNumber(salesCurrent.totalUnits, 0)}
            current={salesCurrent.totalUnits}
            previous={salesPrevious.totalUnits}
            description={PERIOD_VS_LABELS[period]}
            icon={Boxes}
          />
        </div>
      )}

      {canFinancial && (
        <Card>
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tendencia · últimos 14 días
              </p>
              <p className="text-xs text-muted-foreground">
                {dailyAverage(trendData) > 0 && (
                  <>
                    Promedio diario:{' '}
                    <span className="font-mono text-foreground">
                      {formatAmount(dailyAverage(trendData), primaryCurrency)}
                    </span>
                  </>
                )}
              </p>
            </div>
            <TrendAreaChart data={trendData} currency={primaryCurrency} />
          </CardContent>
        </Card>
      )}

      <DashboardAlerts
        lowStockCount={canOperational || canFinancial ? productStats.lowStock : 0}
        zeroStockCount={canOperational || canFinancial ? productStats.zeroStock : 0}
        stalePOsCount={canPurchaseView ? stalePOs.count : 0}
        lastClosed={canFinancial ? lastClosed : null}
      />

      <OperativeSummaryCards
        primaryCurrency={primaryCurrency}
        openSessions={openSessions}
        lastClosed={lastClosed}
        productStats={productStats}
        pendingPOsCount={stalePOs.count}
        pendingPOsTotalsByCurrency={stalePOs.totalInCurrencyByCode}
        showCash={canFinancial}
        showInventory={canOperational || canFinancial}
        showPurchases={canPurchaseView}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {canFinancial && (
          <TopProductsMini rows={topProducts} primaryCurrency={primaryCurrency} />
        )}
        <QuickActions
          canSell={canSell}
          canPurchaseWrite={canPurchaseWrite}
          canProductWrite={canProductWrite}
          canReports={canReports}
        />
      </div>

      {(canFinancial || canPurchaseView) && (
        <RecentActivity tickets={canFinancial ? recentTickets : []} pos={canPurchaseView ? recentPOs : []} />
      )}

      <p className="text-center text-[10px] text-muted-foreground">
        Actualizado al{' '}
        {new Date().toLocaleString('es-PY', {
          dateStyle: 'short',
          timeStyle: 'short',
        })}{' '}
        · refrescá para ver los últimos datos
      </p>
    </div>
  );
}

function emptySalesKpis() {
  return {
    grossSales: 0,
    netSales: 0,
    totalDiscount: 0,
    totalSurcharge: 0,
    ticketCount: 0,
    avgTicket: 0,
    totalUnits: 0,
    totalCost: 0,
    grossProfit: 0,
    marginPct: 0,
  };
}

function emptyProductStats() {
  return {
    totalActiveVariants: 0,
    totalArchivedVariants: 0,
    totalUnits: 0,
    zeroStock: 0,
    lowStock: 0,
    inventoryValue: 0,
  };
}

function emptyCashKpis() {
  return {
    totalClosures: 0,
    totalSales: 0,
    totalReturns: 0,
    totalCancellations: 0,
    totalTransactions: 0,
    diffsByCurrency: [] as Array<{ currencyCode: string; diff: number }>,
  };
}

type SeriesRow = { bucket: string; bucketLabel: string; total: number; count: number };

function buildTrendSeries(
  from: Date,
  to: Date,
  series: SeriesRow[],
  dpPrimary: number
): Array<{ date: string; label: string; total: number }> {
  const totalsByDay = new Map<string, number>();
  for (const r of series) {
    const day = new Date(r.bucket).toISOString().slice(0, 10);
    totalsByDay.set(day, (totalsByDay.get(day) ?? 0) + r.total);
  }
  const out: Array<{ date: string; label: string; total: number }> = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  const factor = Math.pow(10, dpPrimary);
  while (cursor <= end) {
    const dayKey = cursor.toISOString().slice(0, 10);
    const minor = totalsByDay.get(dayKey) ?? 0;
    out.push({
      date: dayKey,
      label: cursor.toLocaleDateString('es-PY', { day: '2-digit', month: 'short' }),
      total: minor / factor,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function dailyAverage(rows: Array<{ total: number }>): number {
  if (rows.length === 0) return 0;
  const sum = rows.reduce((a, b) => a + b.total, 0);
  return Math.round(sum / rows.length);
}
