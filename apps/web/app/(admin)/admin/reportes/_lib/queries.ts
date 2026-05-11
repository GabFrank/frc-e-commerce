import { and, between, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  order,
  orderLine,
  payment,
  paymentDetail,
} from '@frc-e-commerce/db/schema';
import type { DateRange } from './date-range';
import { granularityTruncUnit } from './date-range';

export type SalesKpis = {
  grossSales: number;
  netSales: number;
  totalDiscount: number;
  totalSurcharge: number;
  ticketCount: number;
  avgTicket: number;
  totalUnits: number;
  totalCost: number;
  grossProfit: number;
  marginPct: number;
};

/** KPIs agregados para el tab Ventas, sólo órdenes no canceladas dentro del rango. */
export async function getSalesKpis(tenantId: string, range: DateRange): Promise<SalesKpis> {
  const baseFilter = and(
    eq(order.tenantId, tenantId),
    sql`${order.status} <> 'cancelled'`,
    between(order.createdAt, range.from, range.to)
  );

  const [agg] = await db
    .select({
      grossSum: sql<number>`coalesce(sum(${order.subtotal} + ${order.surchargeAmount}), 0)`.mapWith(Number),
      netSum: sql<number>`coalesce(sum(${order.total}), 0)`.mapWith(Number),
      discountSum: sql<number>`coalesce(sum(${order.discountAmount}), 0)`.mapWith(Number),
      surchargeSum: sql<number>`coalesce(sum(${order.surchargeAmount}), 0)`.mapWith(Number),
      ticketCount: sql<number>`count(*)`.mapWith(Number),
    })
    .from(order)
    .where(baseFilter);

  const [lineAgg] = await db
    .select({
      units: sql<number>`coalesce(sum(${orderLine.quantity} - ${orderLine.returnedQuantity} - ${orderLine.cancelledQuantity}), 0)`.mapWith(Number),
      lineDiscount: sql<number>`coalesce(sum(${orderLine.discountAmount}), 0)`.mapWith(Number),
      cost: sql<number>`coalesce(sum(coalesce(${orderLine.costSnapshot}, 0) * (${orderLine.quantity} - ${orderLine.returnedQuantity} - ${orderLine.cancelledQuantity})), 0)`.mapWith(Number),
    })
    .from(orderLine)
    .innerJoin(order, eq(order.id, orderLine.orderId))
    .where(baseFilter);

  const grossSales = agg?.grossSum ?? 0;
  const netSales = agg?.netSum ?? 0;
  const totalDiscount = (agg?.discountSum ?? 0) + (lineAgg?.lineDiscount ?? 0);
  const totalSurcharge = agg?.surchargeSum ?? 0;
  const ticketCount = agg?.ticketCount ?? 0;
  const totalUnits = lineAgg?.units ?? 0;
  const totalCost = lineAgg?.cost ?? 0;
  const avgTicket = ticketCount > 0 ? Math.round(netSales / ticketCount) : 0;
  const grossProfit = netSales - totalCost;
  const marginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  return {
    grossSales,
    netSales,
    totalDiscount,
    totalSurcharge,
    ticketCount,
    avgTicket,
    totalUnits,
    totalCost,
    grossProfit,
    marginPct,
  };
}

export type SalesSeriesPoint = {
  bucket: string; // ISO date del inicio del bucket
  bucketLabel: string;
  total: number;
  count: number;
};

/** Serie temporal de ventas netas + nº tickets agrupadas por granularidad. */
export async function getSalesSeries(
  tenantId: string,
  range: DateRange
): Promise<SalesSeriesPoint[]> {
  const unit = granularityTruncUnit(range.granularity);
  // `unit` viene de un union tipado ('day'|'week'|'month') así que es seguro inlinear con sql.raw.
  // No se puede parametrizar porque Postgres no infiere el tipo de date_trunc($1, ...) en ese contexto.
  const trunc = sql`date_trunc(${sql.raw(`'${unit}'`)}, ${order.createdAt})`;
  const rows = await db
    .select({
      bucket: sql<Date>`${trunc}`.mapWith((v) => new Date(v as string)),
      total: sql<number>`coalesce(sum(${order.total}), 0)`.mapWith(Number),
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(order)
    .where(
      and(
        eq(order.tenantId, tenantId),
        sql`${order.status} <> 'cancelled'`,
        between(order.createdAt, range.from, range.to)
      )
    )
    .groupBy(trunc)
    .orderBy(trunc);

  const labelFor = (d: Date) => {
    if (unit === 'day') return d.toLocaleDateString('es-PY', { day: '2-digit', month: 'short' });
    if (unit === 'week')
      return `Sem ${d.toLocaleDateString('es-PY', { day: '2-digit', month: 'short' })}`;
    return d.toLocaleDateString('es-PY', { month: 'short', year: '2-digit' });
  };

  return rows.map((r) => ({
    bucket: r.bucket.toISOString(),
    bucketLabel: labelFor(r.bucket),
    total: r.total,
    count: r.count,
  }));
}

export type RecentTicket = {
  id: string;
  ticketCorrelative: number | null;
  orderNumber: string;
  channel: string;
  status: string;
  total: number;
  currency: string;
  createdAt: Date;
  customerName: string;
  methods: string[];
};

/** Últimos N tickets dentro del rango (incluye cancelados para visibilidad). */
export async function getRecentTickets(
  tenantId: string,
  range: DateRange,
  limit: number
): Promise<RecentTicket[]> {
  const rows = await db
    .select({
      id: order.id,
      ticketCorrelative: order.ticketCorrelative,
      orderNumber: order.orderNumber,
      channel: order.channel,
      status: order.status,
      total: order.total,
      currency: order.currency,
      createdAt: order.createdAt,
      customerName: order.customerName,
    })
    .from(order)
    .where(
      and(eq(order.tenantId, tenantId), between(order.createdAt, range.from, range.to))
    )
    .orderBy(desc(order.createdAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const methods = await db
    .select({
      orderId: payment.orderId,
      method: paymentDetail.paymentMethod,
    })
    .from(paymentDetail)
    .innerJoin(payment, eq(payment.id, paymentDetail.paymentId))
    .where(and(inArray(payment.orderId, ids), eq(paymentDetail.kind, 'payment')));

  const byOrder = new Map<string, Set<string>>();
  for (const m of methods) {
    if (!m.method) continue;
    const set = byOrder.get(m.orderId) ?? new Set<string>();
    set.add(m.method);
    byOrder.set(m.orderId, set);
  }

  return rows.map((r) => ({
    ...r,
    methods: Array.from(byOrder.get(r.id) ?? []),
  }));
}
