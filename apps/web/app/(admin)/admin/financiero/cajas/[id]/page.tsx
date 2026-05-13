import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, asc, desc, eq, exists, gt, gte, ilike, lte, or, sql, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { requireSession, getMembership } from '@/lib/auth/guards';
import { getCurrentTenant } from '@/lib/tenant';
import { hasCapability } from '@/lib/auth/permissions';
import {
  cashSession,
  cashSessionBalance,
  cashClosure,
  cashClosureMetric,
  cashMovement,
  order,
  orderLine,
  payment,
  paymentDetail,
  productVariant,
  product,
  tenantCurrency,
  user,
} from '@frc-e-commerce/db/schema';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CajaSalesFilters } from '@/components/admin/financiero/CajaSalesFilters';
import { formatAmount, formatNumber, getCurrencyDecimalPlaces } from '@frc-e-commerce/shared-utils';

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
      sumDiscountActive: sql<number>`coalesce(sum(${allSessionOrders.discountAmount}) filter (where ${allSessionOrders.status} <> 'cancelled'), 0)`.mapWith(Number),
      sumSurchargeActive: sql<number>`coalesce(sum(${allSessionOrders.surchargeAmount}) filter (where ${allSessionOrders.status} <> 'cancelled'), 0)`.mapWith(Number),
    })
    .from(allSessionOrders);

  /**
   * Total NETO de ventas de la sesión, calculado por línea para descontar
   * devoluciones y cancelaciones parciales (que no cambian order.total).
   * sumGross = unidades activas × precio unitario − descuento de línea
   * (no prorrateamos descuento general por ahora — aprox. razonable).
   */
  const [aggLines] = await db
    .select({
      activeUnits: sql<number>`coalesce(sum(${orderLine.quantity} - ${orderLine.returnedQuantity} - ${orderLine.cancelledQuantity}), 0)`.mapWith(Number),
      returnedUnits: sql<number>`coalesce(sum(${orderLine.returnedQuantity}), 0)`.mapWith(Number),
      cancelledUnits: sql<number>`coalesce(sum(${orderLine.cancelledQuantity}), 0)`.mapWith(Number),
      sumGrossActive: sql<number>`coalesce(sum((${orderLine.quantity} - ${orderLine.returnedQuantity} - ${orderLine.cancelledQuantity}) * ${orderLine.unitPrice} - ${orderLine.discountAmount}), 0)`.mapWith(Number),
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

  const totalActive =
    (aggLines?.sumGrossActive ?? 0)
    - (aggOrders?.sumDiscountActive ?? 0)
    + (aggOrders?.sumSurchargeActive ?? 0);
  const totalCost = aggLines?.costActive ?? 0;
  const profit = totalActive - totalCost;
  const profitPct = totalActive > 0 ? (profit / totalActive) * 100 : 0;
  const avgTicket =
    (aggOrders?.activeCount ?? 0) > 0
      ? Math.round(totalActive / (aggOrders!.activeCount))
      : 0;
  const hasReturns = (aggLines?.returnedUnits ?? 0) > 0;
  const elapsed = (s.closedAt ?? new Date()).getTime() - new Date(s.openedAt).getTime();

  // ── Ventas por método y moneda — suma neta (sale_in − sale_return_out − sale_cancel_out) ──
  const salesByMethod = await db
    .select({
      paymentMethod: cashMovement.paymentMethod,
      currencyCode: cashMovement.currencyCode,
      sumAmount: sql<number>`coalesce(sum(case when ${cashMovement.kind} = 'sale_in' then ${cashMovement.amount} else -${cashMovement.amount} end), 0)`.mapWith(Number),
      sumAmountInPrimary: sql<number>`coalesce(sum(case when ${cashMovement.kind} = 'sale_in' then ${cashMovement.amountInPrimary} else -${cashMovement.amountInPrimary} end), 0)`.mapWith(Number),
    })
    .from(cashMovement)
    .where(
      and(
        eq(cashMovement.cashSessionId, s.id),
        inArray(cashMovement.kind, ['sale_in', 'sale_return_out', 'sale_cancel_out'])
      )
    )
    .groupBy(cashMovement.paymentMethod, cashMovement.currencyCode)
    .orderBy(cashMovement.currencyCode, cashMovement.paymentMethod);

  // Primary currency del tenant (para formatear totales)
  const [primaryTc] = await db
    .select({ code: tenantCurrency.currencyCode })
    .from(tenantCurrency)
    .where(and(eq(tenantCurrency.tenantId, tenant.id), eq(tenantCurrency.isPrimary, true)))
    .limit(1);
  const primaryCurrency = primaryTc?.code ?? 'PYG';

  // ── Cash movements de reversa POSTERIORES al cierre ──
  // Si la sesión está cerrada y luego hay devolución/cancelación, no se actualiza
  // el closure (es snapshot). Listamos los movimientos posteriores para que el
  // operador vea el ajuste real.
  const postClosureReversals = s.closedAt
    ? await db
        .select({
          id: cashMovement.id,
          kind: cashMovement.kind,
          currencyCode: cashMovement.currencyCode,
          amount: cashMovement.amount,
          amountInPrimary: cashMovement.amountInPrimary,
          paymentMethod: cashMovement.paymentMethod,
          createdAt: cashMovement.createdAt,
          orderId: cashMovement.orderId,
        })
        .from(cashMovement)
        .where(
          and(
            eq(cashMovement.cashSessionId, s.id),
            inArray(cashMovement.kind, ['sale_return_out', 'sale_cancel_out']),
            gt(cashMovement.createdAt, s.closedAt)
          )
        )
        .orderBy(asc(cashMovement.createdAt))
    : [];

  /** Suma total (en primary) de los ajustes post-cierre — salieron de caja después del cierre. */
  const postClosureAdjustment = postClosureReversals.reduce(
    (acc, r) => acc + r.amountInPrimary,
    0
  );

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
      returnedUnits: sql<number>`(select coalesce(sum(${orderLine.returnedQuantity}), 0) from ${orderLine} where ${orderLine.orderId} = ${order.id})`.mapWith(Number),
      cancelledUnits: sql<number>`(select coalesce(sum(${orderLine.cancelledQuantity}), 0) from ${orderLine} where ${orderLine.orderId} = ${order.id})`.mapWith(Number),
      // Total neto: sum((qty - returned - cancelled) * unitPrice - line.discount) − order.discount + order.surcharge
      netTotal: sql<number>`(
        select coalesce(sum((${orderLine.quantity} - ${orderLine.returnedQuantity} - ${orderLine.cancelledQuantity}) * ${orderLine.unitPrice} - ${orderLine.discountAmount}), 0)
        from ${orderLine}
        where ${orderLine.orderId} = ${order.id}
      ) - ${order.discountAmount} + ${order.surchargeAmount}`.mapWith(Number),
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
              <span className="text-muted-foreground">Unidades vendidas (neto)</span>
              <span className="font-mono">{aggLines?.activeUnits ?? 0}</span>
            </div>
            {hasReturns && (
              <div className="flex justify-between text-amber-700">
                <span>Unidades devueltas</span>
                <span className="font-mono">{aggLines?.returnedUnits ?? 0}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total vendido (neto)</span>
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
          {postClosureReversals.length > 0 && (
            <div className="mx-4 mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
              <div className="font-medium">⚠ Ajustes posteriores al cierre</div>
              <div className="mt-0.5">
                Hubo {postClosureReversals.length} {postClosureReversals.length === 1 ? 'devolución/cancelación' : 'devoluciones/cancelaciones'} por{' '}
                <strong>{formatAmount(postClosureAdjustment, primaryCurrency)}</strong> después del cierre.
                Los valores del conteo abajo son el snapshot histórico — no se actualizan.
              </div>
            </div>
          )}
          <CardContent className="space-y-2 px-4 pb-4">
            {balances.length === 0 && (
              <div className="rounded-md border border-dashed py-3 text-center text-xs text-muted-foreground">
                Sin balances
              </div>
            )}
            {balances.map((b) => {
              // Los valores en DB están en unidades mínimas — convertimos a mayor para display.
              const dp = getCurrencyDecimalPlaces(b.currencyCode);
              const toMajor = (v: number | string | null | undefined) =>
                v == null ? null : Number(v) / Math.pow(10, dp);
              const openingMajor = toMajor(b.openingDeclared) ?? 0;
              const expectedMajor = toMajor(b.expected);
              const countedMajor = toMajor(b.countedDeclared);
              const diffMajor = toMajor(b.diff);
              const diffColor =
                diffMajor === null
                  ? 'text-muted-foreground'
                  : diffMajor === 0
                    ? 'text-emerald-700'
                    : diffMajor > 0
                      ? 'text-emerald-700'
                      : 'text-destructive';
              return (
                <div key={b.id} className="rounded-md border p-2 text-xs">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-mono font-medium">{b.currencyCode}</span>
                    {diffMajor !== null && (
                      <span className={`font-mono font-medium ${diffColor}`}>
                        {diffMajor > 0 ? '+' : ''}
                        {formatAmount(diffMajor, b.currencyCode)}
                        {diffMajor === 0 && ' ✓'}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-muted-foreground">
                    <span>Apertura</span>
                    <span className="text-right font-mono text-foreground">
                      {formatAmount(openingMajor, b.currencyCode)}
                    </span>
                    <span>Esperado</span>
                    <span className="text-right font-mono text-foreground">
                      {expectedMajor != null
                        ? formatAmount(expectedMajor, b.currencyCode)
                        : '—'}
                    </span>
                    <span>Contado</span>
                    <span className="text-right font-mono text-foreground">
                      {countedMajor != null
                        ? formatAmount(countedMajor, b.currencyCode)
                        : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {salesByMethod.length > 0 && (
          <Card className="mb-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Ventas por método</CardTitle>
              <CardDescription className="text-xs">
                Neto por método y moneda (incluye devoluciones/cancelaciones)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <tbody>
                  {salesByMethod.map((m, i) => {
                    const code = m.currencyCode ?? primaryCurrency;
                    const dp = getCurrencyDecimalPlaces(code);
                    const majorAmount = m.sumAmount / Math.pow(10, dp);
                    const dpPrimary = getCurrencyDecimalPlaces(primaryCurrency);
                    const majorInPrimary = m.sumAmountInPrimary / Math.pow(10, dpPrimary);
                    const showsPrimaryEquiv = code !== primaryCurrency;
                    return (
                      <tr key={`${m.paymentMethod}-${m.currencyCode}-${i}`} className="border-t">
                        <td className="px-2 py-1">
                          {m.paymentMethod} / {m.currencyCode ?? '—'}
                        </td>
                        <td className="px-2 py-1 text-right font-mono">
                          <div>{formatAmount(majorAmount, code)}</div>
                          {showsPrimaryEquiv && (
                            <div className="text-[10px] text-muted-foreground">
                              ≈ {formatAmount(majorInPrimary, primaryCurrency)}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
                  const hasReturn = (o.returnedUnits ?? 0) > 0;
                  const showsNet = o.status !== 'cancelled' && hasReturn && o.netTotal !== o.total;
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
                        {showsNet ? (
                          <>
                            <div className="text-muted-foreground line-through text-xs">
                              {formatAmount(o.total, o.currency)}
                            </div>
                            <div>{formatAmount(o.netTotal ?? o.total, o.currency)}</div>
                          </>
                        ) : (
                          formatAmount(o.total, o.currency)
                        )}
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
                        ) : hasReturn ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                            Con devolución
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
