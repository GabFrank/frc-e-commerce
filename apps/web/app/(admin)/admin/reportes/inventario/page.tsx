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
import { MovementsFilters } from '../_components/MovementsFilters';
import { parseRange, rangeLabel, toLocalInput } from '../_lib/date-range';
import {
  getProductStats,
  getMovementsByKind,
  getRecentStockMovements,
} from '../_lib/queries';
import { formatNumber } from '@frc-e-commerce/shared-utils';

export const dynamic = 'force-dynamic';

type SP = {
  from?: string;
  to?: string;
  granularity?: string;
  mvQ?: string;
  mvKind?: string;
  mvPage?: string;
  mvPageSize?: string;
};

const KIND_LABEL: Record<string, string> = {
  purchase: 'Compra',
  purchase_return: 'Devolución a proveedor',
  purchase_cancel: 'Cancelación de compra',
  sale: 'Venta',
  sale_return: 'Devolución de venta',
  sale_cancel: 'Cancelación de venta',
  adjustment: 'Ajuste manual',
};

const KIND_SIGN: Record<string, 1 | -1> = {
  purchase: 1,
  purchase_return: -1,
  purchase_cancel: -1,
  sale: -1,
  sale_return: 1,
  sale_cancel: 1,
  adjustment: 1,
};

export default async function InventarioReportPage({
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
  const mvFilters = {
    q: sp.mvQ ?? '',
    kind: sp.mvKind ?? 'all',
    page: Number(sp.mvPage ?? '1'),
    pageSize: Number(sp.mvPageSize ?? '25'),
  };

  const [stats, byKind, movementsRes] = await Promise.all([
    getProductStats(tenant.id, 5),
    getMovementsByKind(tenant.id, range),
    getRecentStockMovements(tenant.id, range, {
      kind: mvFilters.kind,
      q: mvFilters.q,
      page: mvFilters.page,
      pageSize: mvFilters.pageSize,
    }),
  ]);
  const movements = movementsRes.rows;

  const fmt = (n: number) => formatNumber(n, 0);

  const inflowKinds = byKind.filter((k) => (KIND_SIGN[k.kind] ?? 1) > 0);
  const outflowKinds = byKind.filter((k) => (KIND_SIGN[k.kind] ?? 1) < 0);
  const inflow = inflowKinds.reduce((a, b) => a + b.totalQty, 0);
  const outflow = outflowKinds.reduce((a, b) => a + b.totalQty, 0);

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
          title="Valor inventario"
          value={fmt(stats.inventoryValue)}
          description="Al costo promedio ponderado"
        />
        <KpiCard
          title="Unidades en stock"
          value={fmt(stats.totalUnits)}
          description={`${fmt(stats.totalActiveVariants)} variantes activas`}
        />
        <KpiCard
          title="Ingresos del período"
          value={`+${fmt(inflow)}`}
          description="Compras + devoluciones de venta + ajustes"
          tone="positive"
        />
        <KpiCard
          title="Egresos del período"
          value={`-${fmt(outflow)}`}
          description="Ventas + devol. a proveedor + cancel."
          tone="negative"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimientos por tipo</CardTitle>
          <CardDescription>Resumen del período por kind de stock_movement</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-right">Eventos</th>
                  <th className="px-3 py-2 text-right">Unidades</th>
                  <th className="px-3 py-2 text-right">Valor (al costo)</th>
                </tr>
              </thead>
              <tbody>
                {byKind.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                      Sin movimientos en el período.
                    </td>
                  </tr>
                )}
                {byKind.map((k) => {
                  const sign = KIND_SIGN[k.kind] ?? 1;
                  return (
                    <tr key={k.kind} className="border-t">
                      <td className="px-3 py-2">
                        <span className="font-medium">{KIND_LABEL[k.kind] ?? k.kind}</span>
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {k.kind}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(k.count)}</td>
                      <td
                        className={`px-3 py-2 text-right font-mono ${
                          sign > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'
                        }`}
                      >
                        {sign > 0 ? '+' : '−'}
                        {fmt(k.totalQty)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {k.totalCost > 0 ? fmt(k.totalCost) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit log de movimientos</CardTitle>
          <CardDescription>
            {movementsRes.total} {movementsRes.total === 1 ? 'movimiento' : 'movimientos'} en el
            período
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <MovementsFilters initial={mvFilters} total={movementsRes.total} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-left">SKU</th>
                  <th className="px-3 py-2 text-right">Cant.</th>
                  <th className="px-3 py-2 text-right">Costo unit.</th>
                  <th className="px-3 py-2 text-left">Origen</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      Sin movimientos en el período.
                    </td>
                  </tr>
                )}
                {movements.map((m) => {
                  const sign = KIND_SIGN[m.kind] ?? 1;
                  return (
                    <tr key={m.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 text-xs">
                        {new Date(m.createdAt).toLocaleString('es-PY')}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs">{KIND_LABEL[m.kind] ?? m.kind}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{m.productName}</div>
                        {(m.color || m.size) && (
                          <div className="text-xs text-muted-foreground">
                            {[m.color, m.size && `Talle ${m.size}`].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{m.variantSku}</td>
                      <td
                        className={`px-3 py-2 text-right font-mono ${
                          sign > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'
                        }`}
                      >
                        {sign > 0 ? '+' : '−'}
                        {fmt(m.quantity)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {m.unitCost != null ? fmt(m.unitCost) : '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {m.createdByName ?? m.reason ?? '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
