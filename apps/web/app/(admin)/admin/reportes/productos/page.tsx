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
import { VerticalBarChart } from '../_components/VerticalBarChart';
import { parseRange, rangeLabel, toLocalInput } from '../_lib/date-range';
import {
  getProductStats,
  getTopProducts,
  getLowStockVariants,
} from '../_lib/queries';
import { formatNumber } from '@frc-e-commerce/shared-utils';

export const dynamic = 'force-dynamic';

const LOW_STOCK_THRESHOLD = 5;

type SP = { from?: string; to?: string; granularity?: string };

export default async function ProductosReportPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect('/mis-tiendas');
  const session = await requireSession();
  const membership = await getMembership(session.user.id, tenant.id);
  if (!membership || !hasCapability(membership.role, 'reports.operational')) {
    redirect('/admin');
  }

  const sp = await searchParams;
  const range = parseRange(sp);

  const [stats, topProducts, lowStock] = await Promise.all([
    getProductStats(tenant.id, LOW_STOCK_THRESHOLD),
    getTopProducts(tenant.id, range, 20),
    getLowStockVariants(tenant.id, LOW_STOCK_THRESHOLD, 50),
  ]);

  const fmt = (n: number) => formatNumber(n, 0);

  const topChartData = topProducts.slice(0, 10).map((p) => ({
    label: [p.productName, p.color, p.size].filter(Boolean).join(' · ').slice(0, 32),
    value: p.units,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Período</CardTitle>
          <CardDescription>{rangeLabel(range)}</CardDescription>
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
          title="Variantes activas"
          value={fmt(stats.totalActiveVariants)}
          description={`${fmt(stats.totalArchivedVariants)} archivadas`}
        />
        <KpiCard
          title="Unidades en stock"
          value={fmt(stats.totalUnits)}
          description={`Valor inventario: ${fmt(stats.inventoryValue)}`}
        />
        <KpiCard
          title={`Stock bajo (< ${LOW_STOCK_THRESHOLD})`}
          value={fmt(stats.lowStock)}
          tone={stats.lowStock > 0 ? 'negative' : 'muted'}
        />
        <KpiCard
          title="Sin stock"
          value={fmt(stats.zeroStock)}
          tone={stats.zeroStock > 0 ? 'negative' : 'muted'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 por unidades vendidas</CardTitle>
          <CardDescription>Del período seleccionado</CardDescription>
        </CardHeader>
        <CardContent>
          <VerticalBarChart data={topChartData} valueLabel="Unidades" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 20 productos · ranking completo</CardTitle>
          <CardDescription>Unidades, ingresos y margen</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-left">SKU</th>
                  <th className="px-3 py-2 text-right">Unidades</th>
                  <th className="px-3 py-2 text-right">Ingresos</th>
                  <th className="px-3 py-2 text-right">Margen</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                      Sin ventas en el período.
                    </td>
                  </tr>
                )}
                {topProducts.map((p, i) => (
                  <tr key={p.variantId} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {i + 1}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{p.productName}</div>
                      {(p.color || p.size) && (
                        <div className="text-xs text-muted-foreground">
                          {[p.color, p.size && `Talle ${p.size}`].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{p.sku}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(p.units)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(p.revenue)}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      <span
                        className={
                          p.profit > 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : p.profit < 0
                              ? 'text-destructive'
                              : ''
                        }
                      >
                        {p.marginPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stock bajo</CardTitle>
          <CardDescription>
            Variantes activas con menos de {LOW_STOCK_THRESHOLD} unidades (incluye 0). Hasta 50.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-left">SKU</th>
                  <th className="px-3 py-2 text-right">Stock</th>
                  <th className="px-3 py-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {lowStock.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                      Ningún producto con stock bajo. 🎉
                    </td>
                  </tr>
                )}
                {lowStock.map((v) => (
                  <tr key={v.variantId} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="font-medium">{v.productName}</div>
                      {(v.color || v.size) && (
                        <div className="text-xs text-muted-foreground">
                          {[v.color, v.size && `Talle ${v.size}`].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{v.sku}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      <span className={v.stock === 0 ? 'text-destructive' : ''}>
                        {v.stock}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/admin/productos`}
                        className="text-xs text-primary hover:underline"
                      >
                        Catálogo
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
