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
import { HorizontalBarChart } from '../_components/HorizontalBarChart';
import { parseRange, rangeLabel, toLocalInput } from '../_lib/date-range';
import {
  getPurchaseKpis,
  getSpendBySupplier,
  getRecentPurchaseOrders,
} from '../_lib/queries';

export const dynamic = 'force-dynamic';

type SP = { from?: string; to?: string; granularity?: string };

const PO_STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  placed: 'Pedida',
  received: 'Recibida',
  partially_received: 'Parcial',
  cancelled: 'Cancelada',
};

const PO_STATUS_COLOR: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  placed: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  received: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
  partially_received: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200',
  cancelled: 'bg-destructive/10 text-destructive',
};

export default async function ComprasReportPage({
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

  const [kpis, bySupplier, recent] = await Promise.all([
    getPurchaseKpis(tenant.id, range),
    getSpendBySupplier(tenant.id, range, 10),
    getRecentPurchaseOrders(tenant.id, range, 30),
  ]);

  const fmt = (n: number) => n.toLocaleString('es-PY');

  const chartData = bySupplier.map((s) => ({
    label: s.supplierName.slice(0, 28),
    value: s.totalSpent,
  }));

  const extrasPct = kpis.totalSpent > 0 ? (kpis.totalExtras / kpis.totalSpent) * 100 : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Período</CardTitle>
          <CardDescription>
            {rangeLabel(range)} · órdenes de compra creadas (excluye canceladas)
          </CardDescription>
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
          title="Órdenes de compra"
          value={fmt(kpis.totalOrders)}
          description="No incluye canceladas"
        />
        <KpiCard
          title="Gasto total"
          value={fmt(kpis.totalSpent)}
          description="En moneda primary del tenant"
        />
        <KpiCard
          title="Tamaño promedio"
          value={fmt(kpis.avgPoSize)}
          description="Por orden de compra"
        />
        <KpiCard
          title="Costos extras"
          value={fmt(kpis.totalExtras)}
          description={`${extrasPct.toFixed(1)}% del gasto`}
          tone="muted"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top 10 proveedores</CardTitle>
          <CardDescription>Por gasto total en el período</CardDescription>
        </CardHeader>
        <CardContent>
          <HorizontalBarChart data={chartData} valueLabel="Gasto" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proveedores · detalle</CardTitle>
          <CardDescription>Tabla completa con nº de POs y gasto</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Proveedor</th>
                  <th className="px-3 py-2 text-right">Órdenes</th>
                  <th className="px-3 py-2 text-right">Gasto total</th>
                </tr>
              </thead>
              <tbody>
                {bySupplier.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                      Sin compras en el período.
                    </td>
                  </tr>
                )}
                {bySupplier.map((s) => (
                  <tr key={s.supplierId} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{s.supplierName}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(s.orderCount)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(s.totalSpent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Órdenes recientes</CardTitle>
          <CardDescription>Últimas 30 del período</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">PO</th>
                  <th className="px-3 py-2 text-left">Proveedor</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-left">Creada</th>
                  <th className="px-3 py-2 text-left">Recibida</th>
                  <th className="px-3 py-2 text-right">Total (moneda)</th>
                  <th className="px-3 py-2 text-right">Total (primary)</th>
                  <th className="px-3 py-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      Sin POs en el período.
                    </td>
                  </tr>
                )}
                {recent.map((po) => (
                  <tr key={po.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{po.poNumber}</td>
                    <td className="px-3 py-2">{po.supplierName}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          PO_STATUS_COLOR[po.status] ?? 'bg-muted'
                        }`}
                      >
                        {PO_STATUS_LABEL[po.status] ?? po.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {new Date(po.createdAt).toLocaleDateString('es-PY')}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {po.receivedAt
                        ? new Date(po.receivedAt).toLocaleDateString('es-PY')
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {fmt(Number(po.totalInCurrency))} {po.currencyCode}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {po.totalInPrimary != null ? fmt(Number(po.totalInPrimary)) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/admin/compras`}
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
