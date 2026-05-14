import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireSession, getMembership } from '@/lib/auth/guards';
import { getCurrentTenant } from '@/lib/tenant';
import { hasCapability } from '@/lib/auth/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '../_components/KpiCard';
import { SalesChart } from '../_components/SalesChart';
import { DateRangeFilter } from '../_components/DateRangeFilter';
import {
  parseRange,
  rangeLabel,
  toLocalInput,
} from '../_lib/date-range';
import {
  getSalesKpis,
  getSalesSeries,
  getRecentTickets,
} from '../_lib/queries';
import { formatNumber } from '@frc-e-commerce/shared-utils';

export const dynamic = 'force-dynamic';

type SP = { from?: string; to?: string; granularity?: string };

export default async function VentasReportPage({
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

  const [kpis, series, tickets] = await Promise.all([
    getSalesKpis(tenant.id, range),
    getSalesSeries(tenant.id, range),
    getRecentTickets(tenant.id, range, 20),
  ]);

  const fmt = (n: number) => formatNumber(n, 0);

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
          title="Ventas netas"
          value={fmt(kpis.netSales)}
          description={`${fmt(kpis.ticketCount)} ticket${kpis.ticketCount === 1 ? '' : 's'}`}
        />
        <KpiCard
          title="Ticket promedio"
          value={fmt(kpis.avgTicket)}
          description={`${fmt(kpis.totalUnits)} unidades vendidas`}
        />
        <KpiCard
          title="Ganancia bruta"
          value={fmt(kpis.grossProfit)}
          description={`Margen ${kpis.marginPct.toFixed(1)}%`}
          tone={kpis.grossProfit > 0 ? 'positive' : kpis.grossProfit < 0 ? 'negative' : 'muted'}
        />
        <KpiCard
          title="Descuentos aplicados"
          value={fmt(kpis.totalDiscount)}
          description={`Aumentos: ${fmt(kpis.totalSurcharge)}`}
          tone="muted"
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <SalesChart data={series} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos tickets</CardTitle>
          <CardDescription>20 más recientes del período</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Ticket</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Canal</th>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Método</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      Sin tickets en el período.
                    </td>
                  </tr>
                )}
                {tickets.map((t) => (
                  <tr key={t.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">
                      {t.ticketCorrelative ?? t.orderNumber}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {new Date(t.createdAt).toLocaleString('es-PY')}
                    </td>
                    <td className="px-3 py-2 text-xs uppercase text-muted-foreground">
                      {t.channel}
                    </td>
                    <td className="px-3 py-2">{t.customerName}</td>
                    <td className="px-3 py-2 text-xs">
                      {t.methods.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        t.methods.map((m) => (
                          <span key={m} className="mr-1 rounded bg-muted px-1.5 py-0.5">
                            {m}
                          </span>
                        ))
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {fmt(t.total)} {t.currency}
                    </td>
                    <td className="px-3 py-2">
                      {t.status === 'cancelled' ? (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                          Cancelada
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-900">
                          {t.status}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/admin/pedidos/${t.id}`}
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
