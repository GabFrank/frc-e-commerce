import { and, asc, between, desc, eq, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  cashClosure,
  cashSession,
  cashSessionBalance,
  order,
  orderLine,
  payment,
  paymentDetail,
  product,
  productVariant,
  productVariantAvgCost,
  purchaseExtraCost,
  purchaseOrder,
  stockMovement,
  supplier,
  tenantCurrency,
  user,
} from '@frc-e-commerce/db/schema';
import type { DateRange } from './date-range';
import { granularityTruncUnit } from './date-range';

export async function getPrimaryCurrencyCode(tenantId: string): Promise<string> {
  const [row] = await db
    .select({ code: tenantCurrency.currencyCode })
    .from(tenantCurrency)
    .where(and(eq(tenantCurrency.tenantId, tenantId), eq(tenantCurrency.isPrimary, true)))
    .limit(1);
  return row?.code ?? 'PYG';
}

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

// ── Productos ────────────────────────────────────────────────────────────────

export type ProductStats = {
  totalActiveVariants: number;
  totalArchivedVariants: number;
  totalUnits: number;
  zeroStock: number;
  lowStock: number;
  inventoryValue: number;
};

export async function getProductStats(
  tenantId: string,
  lowStockThreshold: number
): Promise<ProductStats> {
  const [vStats] = await db
    .select({
      activeCount: sql<number>`count(*) filter (where ${productVariant.active} = true)`.mapWith(Number),
      archivedCount: sql<number>`count(*) filter (where ${productVariant.active} = false)`.mapWith(Number),
      totalUnits: sql<number>`coalesce(sum(${productVariant.stock}) filter (where ${productVariant.active} = true), 0)`.mapWith(Number),
      zeroStock: sql<number>`count(*) filter (where ${productVariant.active} = true and ${productVariant.stock} <= 0)`.mapWith(Number),
      lowStock: sql<number>`count(*) filter (where ${productVariant.active} = true and ${productVariant.stock} > 0 and ${productVariant.stock} < ${lowStockThreshold})`.mapWith(Number),
    })
    .from(productVariant)
    .where(eq(productVariant.tenantId, tenantId));

  const [invVal] = await db
    .select({
      value: sql<number>`coalesce(sum(${productVariantAvgCost.stockValueInPrimary}), 0)`.mapWith(Number),
    })
    .from(productVariantAvgCost)
    .where(eq(productVariantAvgCost.tenantId, tenantId));

  return {
    totalActiveVariants: vStats?.activeCount ?? 0,
    totalArchivedVariants: vStats?.archivedCount ?? 0,
    totalUnits: vStats?.totalUnits ?? 0,
    zeroStock: vStats?.zeroStock ?? 0,
    lowStock: vStats?.lowStock ?? 0,
    inventoryValue: invVal?.value ?? 0,
  };
}

export type TopProductRow = {
  variantId: string;
  sku: string;
  productName: string;
  color: string | null;
  size: string | null;
  units: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
};

export async function getTopProducts(
  tenantId: string,
  range: DateRange,
  limit: number
): Promise<TopProductRow[]> {
  const rows = await db
    .select({
      variantId: orderLine.variantId,
      sku: productVariant.sku,
      productName: product.name,
      color: productVariant.color,
      size: productVariant.size,
      units: sql<number>`coalesce(sum(${orderLine.quantity} - ${orderLine.returnedQuantity} - ${orderLine.cancelledQuantity}), 0)`.mapWith(Number),
      revenue: sql<number>`coalesce(sum((${orderLine.quantity} - ${orderLine.returnedQuantity} - ${orderLine.cancelledQuantity}) * ${orderLine.unitPrice} - ${orderLine.discountAmount}), 0)`.mapWith(Number),
      cost: sql<number>`coalesce(sum((${orderLine.quantity} - ${orderLine.returnedQuantity} - ${orderLine.cancelledQuantity}) * coalesce(${orderLine.costSnapshot}, 0)), 0)`.mapWith(Number),
    })
    .from(orderLine)
    .innerJoin(order, eq(order.id, orderLine.orderId))
    .innerJoin(productVariant, eq(productVariant.id, orderLine.variantId))
    .innerJoin(product, eq(product.id, productVariant.productId))
    .where(
      and(
        eq(order.tenantId, tenantId),
        ne(order.status, 'cancelled'),
        between(order.createdAt, range.from, range.to)
      )
    )
    .groupBy(orderLine.variantId, productVariant.sku, product.name, productVariant.color, productVariant.size)
    .having(sql`sum(${orderLine.quantity} - ${orderLine.returnedQuantity} - ${orderLine.cancelledQuantity}) > 0`)
    .orderBy(desc(sql`sum(${orderLine.quantity} - ${orderLine.returnedQuantity} - ${orderLine.cancelledQuantity})`))
    .limit(limit);

  return rows.map((r) => {
    const profit = r.revenue - r.cost;
    const marginPct = r.revenue > 0 ? (profit / r.revenue) * 100 : 0;
    return { ...r, profit, marginPct };
  });
}

export type LowStockRow = {
  variantId: string;
  sku: string;
  productName: string;
  color: string | null;
  size: string | null;
  stock: number;
};

export async function getLowStockVariants(
  tenantId: string,
  threshold: number,
  limit: number
): Promise<LowStockRow[]> {
  return db
    .select({
      variantId: productVariant.id,
      sku: productVariant.sku,
      productName: product.name,
      color: productVariant.color,
      size: productVariant.size,
      stock: productVariant.stock,
    })
    .from(productVariant)
    .innerJoin(product, eq(product.id, productVariant.productId))
    .where(
      and(
        eq(productVariant.tenantId, tenantId),
        eq(productVariant.active, true),
        lt(productVariant.stock, threshold)
      )
    )
    .orderBy(asc(productVariant.stock), asc(product.name))
    .limit(limit);
}

// ── Inventario ───────────────────────────────────────────────────────────────

export type InventoryMovementByKind = {
  kind: string;
  totalQty: number;
  totalCost: number;
  count: number;
};

export async function getMovementsByKind(
  tenantId: string,
  range: DateRange
): Promise<InventoryMovementByKind[]> {
  return db
    .select({
      kind: stockMovement.kind,
      totalQty: sql<number>`coalesce(sum(${stockMovement.quantity}), 0)`.mapWith(Number),
      totalCost: sql<number>`coalesce(sum(coalesce(${stockMovement.totalCostInPrimary}, 0)), 0)`.mapWith(Number),
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(stockMovement)
    .where(
      and(
        eq(stockMovement.tenantId, tenantId),
        between(stockMovement.createdAt, range.from, range.to)
      )
    )
    .groupBy(stockMovement.kind)
    .orderBy(desc(sql`sum(${stockMovement.quantity})`));
}

export type RecentMovement = {
  id: string;
  kind: string;
  quantity: number;
  variantSku: string;
  productName: string;
  color: string | null;
  size: string | null;
  unitCost: number | null;
  totalCost: number | null;
  reason: string | null;
  createdAt: Date;
  createdByName: string | null;
};

export type StockMovementsFilters = {
  kind?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export async function getRecentStockMovements(
  tenantId: string,
  range: DateRange,
  filters: StockMovementsFilters = {}
): Promise<{ rows: RecentMovement[]; total: number }> {
  const conds = [
    eq(stockMovement.tenantId, tenantId),
    between(stockMovement.createdAt, range.from, range.to),
  ];
  if (filters.kind && filters.kind !== 'all') {
    conds.push(eq(stockMovement.kind, filters.kind));
  }
  if (filters.q && filters.q.trim()) {
    const term = `%${filters.q.trim()}%`;
    conds.push(
      sql`(${productVariant.sku} ILIKE ${term} OR ${product.name} ILIKE ${term})`
    );
  }

  const where = and(...conds);
  const pageSize =
    filters.pageSize && [25, 50, 100].includes(filters.pageSize) ? filters.pageSize : 25;
  const page = Math.max(1, filters.page ?? 1);
  const offset = (page - 1) * pageSize;

  const [{ value: total }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(stockMovement)
    .innerJoin(productVariant, eq(productVariant.id, stockMovement.variantId))
    .innerJoin(product, eq(product.id, productVariant.productId))
    .where(where);

  const rows = await db
    .select({
      id: stockMovement.id,
      kind: stockMovement.kind,
      quantity: stockMovement.quantity,
      variantSku: productVariant.sku,
      productName: product.name,
      color: productVariant.color,
      size: productVariant.size,
      unitCost: stockMovement.unitCostSnapshot,
      totalCost: stockMovement.totalCostInPrimary,
      reason: stockMovement.reason,
      createdAt: stockMovement.createdAt,
      createdByName: user.name,
    })
    .from(stockMovement)
    .innerJoin(productVariant, eq(productVariant.id, stockMovement.variantId))
    .innerJoin(product, eq(product.id, productVariant.productId))
    .leftJoin(user, eq(user.id, stockMovement.createdBy))
    .where(where)
    .orderBy(desc(stockMovement.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { rows, total };
}

// ── Caja ─────────────────────────────────────────────────────────────────────

export type CashKpis = {
  totalClosures: number;
  totalSales: number;
  totalReturns: number;
  totalCancellations: number;
  totalTransactions: number;
  /** Diferencia de conteo agrupada por moneda (en MINOR units de cada moneda). */
  diffsByCurrency: Array<{ currencyCode: string; diff: number }>;
};

export async function getCashKpis(tenantId: string, range: DateRange): Promise<CashKpis> {
  const closuresFilter = and(
    eq(cashSession.tenantId, tenantId),
    between(cashSession.closedAt, range.from, range.to),
    eq(cashSession.status, 'closed')
  );

  const [agg] = await db
    .select({
      totalClosures: sql<number>`count(*)`.mapWith(Number),
      totalSales: sql<number>`coalesce(sum(${cashClosure.totalSalesInPrimary}), 0)`.mapWith(Number),
      totalReturns: sql<number>`coalesce(sum(${cashClosure.totalReturnsInPrimary}), 0)`.mapWith(Number),
      totalCancellations: sql<number>`coalesce(sum(${cashClosure.totalCancellationsInPrimary}), 0)`.mapWith(Number),
      totalTransactions: sql<number>`coalesce(sum(${cashClosure.totalTransactions}), 0)`.mapWith(Number),
    })
    .from(cashSession)
    .innerJoin(cashClosure, eq(cashClosure.cashSessionId, cashSession.id))
    .where(closuresFilter);

  // Las diferencias de cash_session_balance están en MINOR de su currencyCode.
  // Sumar entre monedas mezcla unidades distintas, así que devolvemos lista agrupada.
  const diffRows = await db
    .select({
      currencyCode: cashSessionBalance.currencyCode,
      diff: sql<number>`coalesce(sum(coalesce(${cashSessionBalance.diff}, 0)), 0)`.mapWith(Number),
    })
    .from(cashSessionBalance)
    .innerJoin(cashSession, eq(cashSession.id, cashSessionBalance.cashSessionId))
    .where(closuresFilter)
    .groupBy(cashSessionBalance.currencyCode);

  return {
    totalClosures: agg?.totalClosures ?? 0,
    totalSales: agg?.totalSales ?? 0,
    totalReturns: agg?.totalReturns ?? 0,
    totalCancellations: agg?.totalCancellations ?? 0,
    totalTransactions: agg?.totalTransactions ?? 0,
    diffsByCurrency: diffRows.map((r) => ({ currencyCode: r.currencyCode, diff: r.diff })),
  };
}

export type CashierRankRow = {
  cashierId: string;
  cashierName: string | null;
  cashierEmail: string;
  sessions: number;
  totalSales: number;
  totalTickets: number;
  avgTicket: number;
};

export async function getCashierRanking(
  tenantId: string,
  range: DateRange
): Promise<CashierRankRow[]> {
  const rows = await db
    .select({
      cashierId: cashSession.cashierId,
      cashierName: user.name,
      cashierEmail: user.email,
      sessions: sql<number>`count(*)`.mapWith(Number),
      totalSales: sql<number>`coalesce(sum(${cashClosure.totalSalesInPrimary}), 0)`.mapWith(Number),
      totalTickets: sql<number>`coalesce(sum(${cashClosure.totalTransactions}), 0)`.mapWith(Number),
    })
    .from(cashSession)
    .innerJoin(cashClosure, eq(cashClosure.cashSessionId, cashSession.id))
    .innerJoin(user, eq(user.id, cashSession.cashierId))
    .where(
      and(
        eq(cashSession.tenantId, tenantId),
        between(cashSession.closedAt, range.from, range.to),
        eq(cashSession.status, 'closed')
      )
    )
    .groupBy(cashSession.cashierId, user.name, user.email)
    .orderBy(desc(sql`sum(${cashClosure.totalSalesInPrimary})`));

  return rows.map((r) => ({
    ...r,
    avgTicket: r.totalTickets > 0 ? Math.round(r.totalSales / r.totalTickets) : 0,
  }));
}

export type CashClosureRow = {
  sessionId: string;
  cashierName: string | null;
  cashierEmail: string;
  openedAt: Date;
  closedAt: Date | null;
  totalSales: number;
  totalReturns: number;
  totalTransactions: number;
  /** Diferencias por moneda (en MINOR units de cada currency). Una entrada por moneda con diff ≠ 0 (o todas si hubo balances). */
  diffsByCurrency: Array<{ currencyCode: string; diff: number }>;
};

export async function getClosuresInRange(
  tenantId: string,
  range: DateRange,
  limit: number
): Promise<CashClosureRow[]> {
  const baseRows = await db
    .select({
      sessionId: cashSession.id,
      cashierName: user.name,
      cashierEmail: user.email,
      openedAt: cashSession.openedAt,
      closedAt: cashSession.closedAt,
      totalSales: cashClosure.totalSalesInPrimary,
      totalReturns: cashClosure.totalReturnsInPrimary,
      totalTransactions: cashClosure.totalTransactions,
    })
    .from(cashSession)
    .innerJoin(cashClosure, eq(cashClosure.cashSessionId, cashSession.id))
    .innerJoin(user, eq(user.id, cashSession.cashierId))
    .where(
      and(
        eq(cashSession.tenantId, tenantId),
        between(cashSession.closedAt, range.from, range.to),
        eq(cashSession.status, 'closed')
      )
    )
    .orderBy(desc(cashSession.closedAt))
    .limit(limit);

  if (baseRows.length === 0) return [];

  const sessionIds = baseRows.map((r) => r.sessionId);
  const diffs = await db
    .select({
      cashSessionId: cashSessionBalance.cashSessionId,
      currencyCode: cashSessionBalance.currencyCode,
      diff: sql<number>`coalesce(${cashSessionBalance.diff}, 0)`.mapWith(Number),
    })
    .from(cashSessionBalance)
    .where(inArray(cashSessionBalance.cashSessionId, sessionIds));
  const diffMap = new Map<string, Array<{ currencyCode: string; diff: number }>>();
  for (const d of diffs) {
    const list = diffMap.get(d.cashSessionId) ?? [];
    list.push({ currencyCode: d.currencyCode, diff: d.diff });
    diffMap.set(d.cashSessionId, list);
  }

  return baseRows.map((r) => ({
    ...r,
    totalSales: Number(r.totalSales ?? 0),
    totalReturns: Number(r.totalReturns ?? 0),
    diffsByCurrency: diffMap.get(r.sessionId) ?? [],
  }));
}

// ── Compras ──────────────────────────────────────────────────────────────────

export type PurchaseKpis = {
  totalOrders: number;
  /** Gasto total en MINOR units de la moneda primary del tenant. */
  totalSpent: number;
  /** Costos extras totales en MINOR units de primary. */
  totalExtras: number;
  /** Tamaño promedio de PO en MINOR units de primary. */
  avgPoSize: number;
  /** Número de POs en el período que NO tienen snapshot a primary (placed sin recibir) — quedaron fuera. */
  pendingOrdersCount: number;
};

export async function getPurchaseKpis(
  tenantId: string,
  range: DateRange
): Promise<PurchaseKpis> {
  // Solo contamos POs con totalInPrimary (i.e., recibidas o partial_received).
  // Para placed/cancelled sin snapshot a primary no podemos comparar monedas.
  const [agg] = await db
    .select({
      totalOrders: sql<number>`count(*)`.mapWith(Number),
      totalSpent: sql<number>`coalesce(sum(${purchaseOrder.totalInPrimary}), 0)`.mapWith(Number),
    })
    .from(purchaseOrder)
    .where(
      and(
        eq(purchaseOrder.tenantId, tenantId),
        between(purchaseOrder.createdAt, range.from, range.to),
        ne(purchaseOrder.status, 'cancelled'),
        isNotNull(purchaseOrder.totalInPrimary)
      )
    );

  // Extras: convertirlos a primary usando exchangeRateSnapshot de cada PO.
  // amount_in_currency es MINOR de currencyCode; primary tiene su propio dp.
  // El rate convierte: valor_minor_primary = valor_minor_currency * rate * 10^(dp_primary - dp_currency)
  // Como no sabemos dp_primary acá (sin context), aproximamos: dado que `totalInPrimary` ya
  // contempló esa misma fórmula, basta con asumir mismas escalas. Simplificamos:
  // expressing extras como fracción del total de la PO en currency, multiplicar por totalInPrimary.
  // Eso elude la mezcla de unidades.
  const extrasRows = await db
    .select({
      poId: purchaseOrder.id,
      totalInCurrency: purchaseOrder.totalInCurrency,
      totalInPrimary: purchaseOrder.totalInPrimary,
      extrasInCurrency: sql<number>`coalesce(sum(${purchaseExtraCost.amountInCurrency}), 0)`.mapWith(Number),
    })
    .from(purchaseOrder)
    .innerJoin(purchaseExtraCost, eq(purchaseOrder.id, purchaseExtraCost.purchaseOrderId))
    .where(
      and(
        eq(purchaseOrder.tenantId, tenantId),
        between(purchaseOrder.createdAt, range.from, range.to),
        ne(purchaseOrder.status, 'cancelled'),
        isNotNull(purchaseOrder.totalInPrimary)
      )
    )
    .groupBy(purchaseOrder.id, purchaseOrder.totalInCurrency, purchaseOrder.totalInPrimary);

  const totalExtras = extrasRows.reduce((acc, r) => {
    const totalCurr = Number(r.totalInCurrency);
    const totalPrim = Number(r.totalInPrimary ?? 0);
    const extras = Number(r.extrasInCurrency);
    if (totalCurr <= 0) return acc;
    return acc + Math.round((extras / totalCurr) * totalPrim);
  }, 0);

  // POs sin snapshot: las que están placed o partial sin haber recibido nada.
  const [pending] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(purchaseOrder)
    .where(
      and(
        eq(purchaseOrder.tenantId, tenantId),
        between(purchaseOrder.createdAt, range.from, range.to),
        ne(purchaseOrder.status, 'cancelled'),
        ne(purchaseOrder.status, 'draft'),
        sql`${purchaseOrder.totalInPrimary} IS NULL`
      )
    );

  const totalOrders = agg?.totalOrders ?? 0;
  const totalSpent = agg?.totalSpent ?? 0;

  return {
    totalOrders,
    totalSpent,
    totalExtras,
    avgPoSize: totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0,
    pendingOrdersCount: pending?.count ?? 0,
  };
}

export type SpendBySupplierRow = {
  supplierId: string;
  supplierName: string;
  orderCount: number;
  totalSpent: number;
};

export async function getSpendBySupplier(
  tenantId: string,
  range: DateRange,
  limit: number
): Promise<SpendBySupplierRow[]> {
  return db
    .select({
      supplierId: supplier.id,
      supplierName: supplier.name,
      orderCount: sql<number>`count(*)`.mapWith(Number),
      totalSpent: sql<number>`coalesce(sum(${purchaseOrder.totalInPrimary}), 0)`.mapWith(Number),
    })
    .from(purchaseOrder)
    .innerJoin(supplier, eq(supplier.id, purchaseOrder.supplierId))
    .where(
      and(
        eq(purchaseOrder.tenantId, tenantId),
        between(purchaseOrder.createdAt, range.from, range.to),
        ne(purchaseOrder.status, 'cancelled'),
        isNotNull(purchaseOrder.totalInPrimary)
      )
    )
    .groupBy(supplier.id, supplier.name)
    .orderBy(desc(sql`sum(${purchaseOrder.totalInPrimary})`))
    .limit(limit);
}

export type RecentPurchaseOrder = {
  id: string;
  poNumber: string;
  status: string;
  supplierName: string;
  currencyCode: string;
  totalInCurrency: number;
  totalInPrimary: number | null;
  createdAt: Date;
  receivedAt: Date | null;
};

export async function getRecentPurchaseOrders(
  tenantId: string,
  range: DateRange,
  limit: number
): Promise<RecentPurchaseOrder[]> {
  return db
    .select({
      id: purchaseOrder.id,
      poNumber: purchaseOrder.poNumber,
      status: purchaseOrder.status,
      supplierName: supplier.name,
      currencyCode: purchaseOrder.currencyCode,
      totalInCurrency: purchaseOrder.totalInCurrency,
      totalInPrimary: purchaseOrder.totalInPrimary,
      createdAt: purchaseOrder.createdAt,
      receivedAt: purchaseOrder.receivedAt,
    })
    .from(purchaseOrder)
    .innerJoin(supplier, eq(supplier.id, purchaseOrder.supplierId))
    .where(
      and(
        eq(purchaseOrder.tenantId, tenantId),
        between(purchaseOrder.createdAt, range.from, range.to)
      )
    )
    .orderBy(desc(purchaseOrder.createdAt))
    .limit(limit);
}

// ── Dashboard helpers ────────────────────────────────────────────────────────

export type OpenCashSession = {
  id: string;
  cashierName: string | null;
  openedAt: Date;
};

/** Sesiones de caja con status='open' (todas, no solo del día). */
export async function getOpenCashSessions(tenantId: string): Promise<OpenCashSession[]> {
  return db
    .select({
      id: cashSession.id,
      cashierName: user.name,
      openedAt: cashSession.openedAt,
    })
    .from(cashSession)
    .leftJoin(user, eq(user.id, cashSession.cashierId))
    .where(and(eq(cashSession.tenantId, tenantId), eq(cashSession.status, 'open')))
    .orderBy(desc(cashSession.openedAt));
}

export type LastClosedSession = {
  sessionId: string;
  closedAt: Date;
  cashierName: string | null;
  diffsByCurrency: Array<{ currencyCode: string; diff: number }>;
};

/** Último cierre del tenant con sus diferencias por moneda. */
export async function getLastClosedSession(
  tenantId: string
): Promise<LastClosedSession | null> {
  const [row] = await db
    .select({
      sessionId: cashSession.id,
      closedAt: cashSession.closedAt,
      cashierName: user.name,
    })
    .from(cashSession)
    .leftJoin(user, eq(user.id, cashSession.cashierId))
    .where(
      and(
        eq(cashSession.tenantId, tenantId),
        eq(cashSession.status, 'closed'),
        isNotNull(cashSession.closedAt)
      )
    )
    .orderBy(desc(cashSession.closedAt))
    .limit(1);

  if (!row || !row.closedAt) return null;

  const balances = await db
    .select({
      currencyCode: cashSessionBalance.currencyCode,
      diff: sql<number>`coalesce(${cashSessionBalance.diff}, 0)`.mapWith(Number),
    })
    .from(cashSessionBalance)
    .where(eq(cashSessionBalance.cashSessionId, row.sessionId));

  return {
    sessionId: row.sessionId,
    closedAt: row.closedAt,
    cashierName: row.cashierName,
    diffsByCurrency: balances.map((b) => ({ currencyCode: b.currencyCode, diff: b.diff })),
  };
}

export type StalePendingPOs = {
  count: number;
  totalInCurrencyByCode: Array<{ currencyCode: string; total: number }>;
};

/** POs con status='placed' (o 'partially_received') sin recibir desde hace +N días. */
export async function getStalePendingPOs(
  tenantId: string,
  daysThreshold: number
): Promise<StalePendingPOs> {
  const cutoff = new Date(Date.now() - daysThreshold * 86400_000);
  const rows = await db
    .select({
      currencyCode: purchaseOrder.currencyCode,
      total: sql<number>`coalesce(sum(${purchaseOrder.totalInCurrency}), 0)`.mapWith(Number),
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(purchaseOrder)
    .where(
      and(
        eq(purchaseOrder.tenantId, tenantId),
        inArray(purchaseOrder.status, ['placed', 'partially_received']),
        lt(purchaseOrder.placedAt, cutoff)
      )
    )
    .groupBy(purchaseOrder.currencyCode);

  const count = rows.reduce((acc, r) => acc + r.count, 0);
  return {
    count,
    totalInCurrencyByCode: rows.map((r) => ({ currencyCode: r.currencyCode, total: r.total })),
  };
}
