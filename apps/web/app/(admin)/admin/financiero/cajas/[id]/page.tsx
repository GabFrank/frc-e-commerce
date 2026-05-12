import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, asc, desc, eq, exists, gte, ilike, lte, or, sql, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { requireSession, getMembership } from '@/lib/auth/guards';
import { getCurrentTenant } from '@/lib/tenant';
import { hasCapability } from '@/lib/auth/permissions';
import {
  cashSession,
  cashSessionBalance,
  cashClosure,
  cashClosureMetric,
  order,
  orderLine,
  payment,
  paymentDetail,
  productVariant,
  product,
  user,
} from '@frc-e-commerce/db/schema';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CajaSalesFilters } from '@/components/admin/financiero/CajaSalesFilters';
import { formatAmount, formatNumber } from '@frc-e-commerce/shared-utils';

export const dynamic = 'force-dynamic';

const PAGE_SIZES = [15, 25, 50] as const;
const DEFAULT_PAGE_SIZE = 25;

type SearchParams = {
  page?: string;
  pageSize?: string;
  from?: string;
  to?: string;
  method?: string;
  currency?: string;
  product?: string;
  status?: string;
};

function parseDate(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function formatHours(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export default async function CajaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const tenant = await getCurrentTenant();
  if (!tenant) redirect('/mis-tiendas');
  const session = await requireSession();
  const membership = await getMembership(session.user.id, tenant.id);
  if (!membership || !hasCapability(membership.role, 'reports.financial')) {
    redirect('/admin');
  }

  // ── Cash session header ──
  const [s] = await db
    .select({
      id: cashSession.id,
      tenantId: cashSession.tenantId,
      status: cashSession.status,
      openedAt: cashSession.openedAt,
      closedAt: cashSession.closedAt,
      notes: cashSession.notes,
      cashierId: cashSession.cashierId,
      cashierName: user.name,
      cashierEmail: user.email,
    })
    .from(cashSession)
    .innerJoin(user, eq(user.id, cashSession.cashierId))
    .where(and(eq(cashSession.id, id), eq(cashSession.tenantId, tenant.id)))
    .limit(1);

  if (!s) notFound();

  // ── Closure header (if any) ──
  const [closure] = await db
    .select()
    .from(cashClosure)
    .where(eq(cashClosure.cashSessionId, s.id))
    .limit(1);

  // ── Balances per currency ──
  const balances = await db
    .select()
    .from(cashSessionBalance)
    .where(eq(cashSessionBalance.cashSessionId, s.id))
    .orderBy(asc(cashSessionBalance.currencyCode));

  // ── Closure metrics for breakdowns (sales/discounts/etc) ──
  const metrics = closure
    ? await db
        .select()
        .from(cashClosureMetric)
        .where(eq(cashClosureMetric.cashClosureId, closure.id))
    : [];

  // ── Ad-hoc aggregates from order/orderLine for this session (works even when session still open) ──
  const allSessionOrders = db
    .select({
      id: order.id,
      status: order.status,
      total: order.total,
      discountAmount: order.discountAmount,
      surchargeAmount: order.surchargeAmount,
    })
    .from(order)
    .where(and(eq(order.tenantId, tenant.id), eq(order.cashSessionId, s.id)))
    .as('all_session_orders');

  const [aggOrders] = await db
    .select({
      totalCount: sql<number>`count(*)`.mapWith(Number),
      activeCount: sql<number>`count(*) filter (where ${allSessionOrders.status} <> 'cancelled')`.mapWith(Number),
      cancelledCount: sql<number>`count(*) filter (where ${allSessionOrders.status} = 'cancelled')`.mapWith(Number),
      sumTotalActive: sql<number>`coalesce(sum(${allSessionOrders.total}) filter (where ${allSessionOrders.status} <> 'cancelled'), 0)`.mapWith(Number),
      sumDiscountActive: sql<number>`coalesce(sum(${allSessionOrders.discountAmount}) filter (where ${allSessionOrders.status} <> 'cancelled'), 0)`.mapWith(Number),
      sumSurchargeActive: sql<number>`coalesce(sum(${allSessionOrders.surchargeAmount}) filter (where ${allSessionOrders.status} <> 'cancelled'), 0)`.mapWith(Number),
    })
    .from(allSessionOrders);

  const [aggLines] = await db
    .select({
      activeUnits: sql<number>`coalesce(sum(${orderLine.quantity} - ${orderLine.returnedQuantity} - ${orderLine.cancelledQuantity}), 0)`.mapWith(Number),
      lineDiscountActive: sql<number>`coalesce(sum(${orderLine.discountAmount}), 0)`.mapWith(Number),
      costActive: sql<number>`coalesce(sum(coalesce(${orderLine.costSnapshot}, 0) * (${orderLine.quantity} - ${orderLine.returnedQuantity} - ${orderLine.cancelledQuantity})), 0)`.mapWith(Number),
    })
    .from(orderLine)
    .innerJoin(order, eq(order.id, orderLine.orderId))
    .where(
      and(
        eq(order.tenantId, tenant.id),
        eq(order.cashSessionId, s.id),
        sql`${order.status} <> 'cancelled'`
      )
    );

  const totalActive = aggOrders?.sumTotalActive ?? 0;
  const totalCost = aggLines?.costActive ?? 0;
  const profit = totalActive - totalCost;
  const profitPct = totalActive > 0 ? (profit / totalActive) * 100 : 0;
  const avgTicket =
    (aggOrders?.activeCount ?? 0) > 0
      ? Math.round(totalActive / (aggOrders!.activeCount))
      : 0;
  const elapsed = (s.closedAt ?? new Date()).getTime() - new Date(s.openedAt).getTime();

  // ── Sales list (filters + pagination) ──
  const pageSizeParam = Number(sp.pageSize ?? DEFAULT_PAGE_SIZE);
  const pageSize = (PAGE_SIZES as readonly number[]).includes(pageSizeParam)
    ? pageSizeParam
    : DEFAULT_PAGE_SIZE;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const offset = (page - 1) * pageSize;

  const filters = [eq(order.tenantId, tenant.id), eq(order.cashSessionId, s.id)];
  const fromDate = parseDate(sp.from);
  const toDate = parseDate(sp.to);
  if (fromDate) filters.push(gte(order.createdAt, fromDate));
  if (toDate) filters.push(lte(order.createdAt, toDate));
  if (sp.status === 'cancelled') filters.push(eq(order.status, 'cancelled'));
  else if (sp.status === 'active') filters.push(sql`${order.status} <> 'cancelled'`);

  if (sp.method) {
    filters.push(
      exists(
        db
          .select({ x: sql`1` })
          .from(payment)
          .innerJoin(paymentDetail, eq(paymentDetail.paymentId, payment.id))
          .where(
            and(
              eq(payment.orderId, order.id),
              eq(paymentDetail.kind, 'payment'),
              eq(paymentDetail.paymentMethod, sp.method)
            )
          )
      )
    );
  }
  if (sp.currency) {
    filters.push(
      exists(
        db
          .select({ x: sql`1` })
          .from(payment)
          .innerJoin(paymentDetail, eq(paymentDetail.paymentId, payment.id))
          .where(
            and(
              eq(payment.orderId, order.id),
              eq(paymentDetail.kind, 'payment'),
              eq(paymentDetail.currencyCode, sp.currency)
            )
          )
      )
    );
  }
  if (sp.product) {
    const term = `%${sp.product}%`;
    filters.push(
      exists(
        db
          .select({ x: sql`1` })
          .from(orderLine)
          .innerJoin(productVariant, eq(productVariant.id, orderLine.variantId))
          .innerJoin(product, eq(product.id, productVariant.productId))
          .where(
            and(
              eq(orderLine.orderId, order.id),
              or(
                ilike(productVariant.sku, term),
                ilike(productVariant.name, term),
                ilike(product.name, term)
              )
            )
          )
      )
    );
  }

  const [{ count: totalRows }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(order)
    .where(and(...filters));
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  const sales = await db
    .select({
      id: order.id,
      orderNumber: order.orderNumber,
      ticketCorrelative: order.ticketCorrelative,
      status: order.status,
      total: order.total,
      currency: order.currency,
      createdAt: order.createdAt,
      customerName: order.customerName,
      lineCount: sql<number>`(select count(*) from ${orderLine} where ${orderLine.orderId} = ${order.id})`.mapWith(Number),
    })
    .from(order)
    .where(and(...filters))
    .orderBy(desc(order.createdAt))
    .limit(pageSize)
    .offset(offset);

  // Methods used in those orders for display
  const orderIds = sales.map((o) => o.id);
  const methodsByOrder = new Map<string, { method: string; currency: string }[]>();
  if (orderIds.length > 0) {
    const rows = await db
      .select({
        orderId: payment.orderId,
        method: paymentDetail.paymentMethod,
        currency: paymentDetail.currencyCode,
      })
      .from(paymentDetail)
      .innerJoin(payment, eq(payment.id, paymentDetail.paymentId))
      .where(and(inArray(payment.orderId, orderIds), eq(paymentDetail.kind, 'payment')));
    for (const r of rows) {
      if (!r.method) continue;
      const arr = methodsByOrder.get(r.orderId) ?? [];
      const exists = arr.find((x) => x.method === r.method && x.currency === r.currency);
      if (!exists) arr.push({ method: r.method, currency: r.currency ?? '' });
      methodsByOrder.set(r.orderId, arr);
    }
  }

  // Build available filter options
  const methodOpts = [
    { value: 'efectivo', label: 'Efectivo' },
    { value: 'transferencia', label: 'Transferencia' },
    { value: 'tarjeta_pos', label: 'Tarjeta POS' },
    { value: 'cheque', label: 'Cheque' },
  ];
  const currencyOpts = balances.map((b) => ({ value: b.currencyCode, label: b.currencyCode }));

  const buildPageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v) next.set(k, String(v));
    next.set('page', String(p));
    return `?${next.toString()}`;
  };

  const totalDiscount = (aggOrders?.sumDiscountActive ?? 0) + (aggLines?.lineDiscountActive ?? 0);

  return (
    <div className="grid gap-4 lg:h-[calc(100vh-3rem)] lg:grid-cols-[280px_1fr] xl:grid-cols-[25%_1fr]">
      {/* Left: caja details */}
      <aside className="lg:overflow-y-auto lg:pr-2">
        <div className="mb-3 text-xs">
          <Link href="/admin/financiero/cajas" className="text-muted-foreground hover:underline">
            ← Volver a cajas
          </Link>
        </div>
        <div className="mb-3 flex items-center gap-2">
          <h1 className="text-xl font-semibold">Detalle de caja</h1>
          {s.status === 'open' ? (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-900">
              Abierta
            </span>
          ) : (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              Cerrada
            </span>
          )}
        </div>

        <Card className="mb-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Responsable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div>{s.cashierName ?? s.cashierEmail}</div>
            {s.cashierName && <div className="text-xs text-muted-foreground">{s.cashierEmail}</div>}
          </CardContent>
        </Card>

        <Card className="mb-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Operación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Apertura</span>
              <span>{new Date(s.openedAt).toLocaleString('es-PY')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cierre</span>
              <span>{s.closedAt ? new Date(s.closedAt).toLocaleString('es-PY') : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tiempo abierta</span>
              <span>{formatHours(elapsed)}</span>
            </div>
            {s.notes && (
              <div className="pt-1">
                <div className="text-muted-foreground">Notas</div>
                <div>{s.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ventas</CardTitle>
            <CardDescription className="text-xs">
              En moneda primary del tenant
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cantidad activas</span>
              <span className="font-mono">{aggOrders?.activeCount ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Canceladas</span>
              <span className="font-mono">{aggOrders?.cancelledCount ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Unidades vendidas</span>
              <span className="font-mono">{aggLines?.activeUnits ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total vendido</span>
              <span className="font-mono">{formatNumber(totalActive, 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ticket promedio</span>
              <span className="font-mono">{formatNumber(avgTicket, 0)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Ganancia</CardTitle>
            <CardDescription className="text-xs">Venta - costo de productos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Costo</span>
              <span className="font-mono">{formatNumber(totalCost, 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ganancia</span>
              <span
                className={`font-mono ${
                  profit > 0 ? 'text-emerald-700' : profit < 0 ? 'text-destructive' : ''
                }`}
              >
                {formatNumber(profit, 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Margen</span>
              <span className="font-mono">{profitPct.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Descuentos / Aumentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descuentos aplicados</span>
              <span className="font-mono">{formatNumber(totalDiscount, 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Aumentos / redondeos</span>
              <span className="font-mono">
                {formatNumber(aggOrders?.sumSurchargeActive ?? 0, 0)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Conteo de caja</CardTitle>
            <CardDescription className="text-xs">
              Apertura, esperado, contado y diferencia por moneda
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1 text-left">Moneda</th>
                  <th className="px-2 py-1 text-right">Apertura</th>
                  <th className="px-2 py-1 text-right">Esperado</th>
                  <th className="px-2 py-1 text-right">Contado</th>
                  <th className="px-2 py-1 text-right">Diff</th>
                </tr>
              </thead>
              <tbody>
                {balances.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-3 text-center text-muted-foreground">
                      Sin balances
                    </td>
                  </tr>
                )}
                {balances.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="px-2 py-1 font-mono">{b.currencyCode}</td>
                    <td className="px-2 py-1 text-right font-mono">
                      {formatAmount(Number(b.openingDeclared), b.currencyCode)}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">
                      {b.expected != null ? formatAmount(Number(b.expected), b.currencyCode) : '—'}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">
                      {b.countedDeclared != null
                        ? formatAmount(Number(b.countedDeclared), b.currencyCode)
                        : '—'}
                    </td>
                    <td
                      className={`px-2 py-1 text-right font-mono ${
                        (Number(b.diff ?? 0)) === 0
                          ? 'text-muted-foreground'
                          : (Number(b.diff ?? 0)) > 0
                            ? 'text-emerald-700'
                            : 'text-destructive'
                      }`}
                    >
                      {b.diff != null
                        ? `${Number(b.diff) > 0 ? '+' : ''}${formatAmount(Number(b.diff), b.currencyCode)}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {metrics.filter((m) => m.metric === 'sales').length > 0 && (
          <Card className="mb-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Ventas por método</CardTitle>
              <CardDescription className="text-xs">Del cierre</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <tbody>
                  {metrics
                    .filter((m) => m.metric === 'sales')
                    .map((m) => (
                      <tr key={m.id} className="border-t">
                        <td className="px-2 py-1">
                          {m.paymentMethod} / {m.currencyCode}
                        </td>
                        <td className="px-2 py-1 text-right font-mono">
                          {formatAmount(Number(m.valueNumeric ?? 0), m.currencyCode ?? 'PYG')}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </aside>

      {/* Right: sales list */}
      <section className="flex flex-col lg:min-h-0 lg:overflow-hidden">
        <Card className="flex flex-col lg:flex-1 lg:overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-baseline justify-between">
              <div>
                <CardTitle>Ventas de la caja</CardTitle>
                <CardDescription>
                  {totalRows} resultado{totalRows === 1 ? '' : 's'} · página {page} de {totalPages}
                </CardDescription>
              </div>
            </div>
            <div className="mt-3">
              <CajaSalesFilters paymentMethods={methodOpts} currencies={currencyOpts} />
            </div>
          </CardHeader>
          <CardContent className="overflow-auto p-0 lg:flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Ticket</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-right">Items</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-left">Método</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      Sin ventas para los filtros aplicados.
                    </td>
                  </tr>
                )}
                {sales.map((o) => {
                  const methods = methodsByOrder.get(o.id) ?? [];
                  return (
                    <tr key={o.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono">
                        {o.ticketCorrelative ?? o.orderNumber}
                      </td>
                      <td className="px-3 py-2">
                        {new Date(o.createdAt).toLocaleString('es-PY')}
                      </td>
                      <td className="px-3 py-2">{o.customerName}</td>
                      <td className="px-3 py-2 text-right font-mono">{o.lineCount}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatAmount(o.total, o.currency)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {methods.length === 0 && <span className="text-muted-foreground">—</span>}
                        {methods.map((m, i) => (
                          <span key={i} className="mr-1 rounded bg-muted px-1.5 py-0.5">
                            {m.method}
                            {m.currency && <span className="text-muted-foreground"> · {m.currency}</span>}
                          </span>
                        ))}
                      </td>
                      <td className="px-3 py-2">
                        {o.status === 'cancelled' ? (
                          <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive">
                            Cancelada
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-900">
                            Activa
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/admin/pedidos/${o.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
          <div className="flex items-center justify-between border-t px-4 py-2 text-xs">
            <span className="text-muted-foreground">
              Mostrando {sales.length === 0 ? 0 : offset + 1}–{offset + sales.length} de {totalRows}
            </span>
            <div className="flex items-center gap-1">
              <Link
                href={buildPageHref(Math.max(1, page - 1))}
                aria-disabled={page <= 1}
                className={`rounded border px-2 py-1 ${
                  page <= 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'
                }`}
              >
                ← Anterior
              </Link>
              <Link
                href={buildPageHref(Math.min(totalPages, page + 1))}
                aria-disabled={page >= totalPages}
                className={`rounded border px-2 py-1 ${
                  page >= totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'
                }`}
              >
                Siguiente →
              </Link>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
