'use server';

import { revalidatePath } from 'next/cache';
import { eq, and, desc, sql, asc, inArray, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  purchaseOrder,
  purchaseOrderLine,
  purchaseExtraCost,
  purchaseExtraCostManualSplit,
  productVariant,
  productVariantAvgCost,
  stockMovement,
  supplier,
  exchangeRate,
  tenantCurrency,
  type PurchaseOrder,
  type PurchaseOrderLine,
  type PurchaseExtraCost,
} from '@frc-e-commerce/db/schema';
import { requireTenant, requireTenantId } from '@/lib/tenant';
import {
  CapabilityDeniedError,
  requireSessionCapability,
} from '@/lib/auth/permissions';
import {
  enrichVariantsForPurchase,
  type PurchaseVariantOption,
} from '@/lib/actions/purchase-search';
import { getCurrencyDecimalPlaces } from '@frc-e-commerce/shared-utils';

function formatError(e: unknown): string {
  if (e instanceof CapabilityDeniedError) return 'No tenés permiso para esta acción';
  if (e instanceof Error) return e.message;
  return 'Error desconocido';
}

// ── Lista ──────────────────────────────────────────────────────────────────────

export type ListPurchaseOrdersFilters = {
  q?: string;
  status?: string;
  supplierId?: string;
  currencyCode?: string;
  page?: number;
  pageSize?: number;
};

export async function listPurchaseOrders(
  filters: ListPurchaseOrdersFilters = {}
): Promise<{
  rows: Array<PurchaseOrder & { supplierName: string }>;
  total: number;
}> {
  const tenantId = await requireTenantId();
  await requireSessionCapability(tenantId, 'purchase.view');

  const conditions = [eq(purchaseOrder.tenantId, tenantId)];
  if (filters.q && filters.q.trim()) {
    const term = `%${filters.q.trim()}%`;
    conditions.push(
      or(
        ilike(purchaseOrder.poNumber, term),
        ilike(supplier.name, term),
        ilike(purchaseOrder.notes, term)
      )!
    );
  }
  if (filters.status && filters.status !== 'all') {
    conditions.push(eq(purchaseOrder.status, filters.status as PurchaseOrder['status']));
  }
  if (filters.supplierId && filters.supplierId !== 'all') {
    conditions.push(eq(purchaseOrder.supplierId, filters.supplierId));
  }
  if (filters.currencyCode && filters.currencyCode !== 'all') {
    conditions.push(eq(purchaseOrder.currencyCode, filters.currencyCode));
  }

  const where = and(...conditions);
  const pageSize = filters.pageSize && [25, 50, 100].includes(filters.pageSize) ? filters.pageSize : 25;
  const page = Math.max(1, filters.page ?? 1);
  const offset = (page - 1) * pageSize;

  const [{ value: total }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(purchaseOrder)
    .innerJoin(supplier, eq(supplier.id, purchaseOrder.supplierId))
    .where(where);

  const rows = await db
    .select({ po: purchaseOrder, supplierName: supplier.name })
    .from(purchaseOrder)
    .innerJoin(supplier, eq(supplier.id, purchaseOrder.supplierId))
    .where(where)
    .orderBy(desc(purchaseOrder.createdAt))
    .limit(pageSize)
    .offset(offset);

  // DB guarda en minor units (centavos). Para display devolvemos major.
  return {
    rows: rows.map((r) => {
      const dp = getCurrencyDecimalPlaces(r.po.currencyCode);
      const factor = Math.pow(10, dp);
      return {
        ...r.po,
        subtotalInCurrency: Number(r.po.subtotalInCurrency) / factor,
        extrasTotalInCurrency: Number(r.po.extrasTotalInCurrency) / factor,
        totalInCurrency: Number(r.po.totalInCurrency) / factor,
        supplierName: r.supplierName,
      };
    }),
    total,
  };
}

export async function getPurchaseOrderDetail(id: string) {
  const tenantId = await requireTenantId();
  await requireSessionCapability(tenantId, 'purchase.view');
  const [po] = await db
    .select()
    .from(purchaseOrder)
    .where(and(eq(purchaseOrder.id, id), eq(purchaseOrder.tenantId, tenantId)))
    .limit(1);
  if (!po) return null;
  const lines = await db
    .select({
      line: purchaseOrderLine,
      variantSku: productVariant.sku,
      variantName: productVariant.name,
    })
    .from(purchaseOrderLine)
    .innerJoin(productVariant, eq(productVariant.id, purchaseOrderLine.variantId))
    .where(eq(purchaseOrderLine.purchaseOrderId, id));
  const extras = await db
    .select()
    .from(purchaseExtraCost)
    .where(eq(purchaseExtraCost.purchaseOrderId, id));
  const movements = await db
    .select({
      id: stockMovement.id,
      variantId: stockMovement.variantId,
      kind: stockMovement.kind,
      quantity: stockMovement.quantity,
      unitCostSnapshot: stockMovement.unitCostSnapshot,
      totalCostInPrimary: stockMovement.totalCostInPrimary,
      originalMovementId: stockMovement.originalMovementId,
      reason: stockMovement.reason,
      createdAt: stockMovement.createdAt,
    })
    .from(stockMovement)
    .where(eq(stockMovement.purchaseOrderId, id))
    .orderBy(asc(stockMovement.createdAt));

  // DB en minor units; devolvemos en major para que la UI use formatAmount directo.
  const [primaryRow] = await db
    .select({ code: tenantCurrency.currencyCode })
    .from(tenantCurrency)
    .where(and(eq(tenantCurrency.tenantId, tenantId), eq(tenantCurrency.isPrimary, true)))
    .limit(1);
  const primaryCurrency = primaryRow?.code ?? 'PYG';
  const dpCurrency = getCurrencyDecimalPlaces(po.currencyCode);
  const dpPrimary = getCurrencyDecimalPlaces(primaryCurrency);
  const fromMinorCurrency = (x: number | string | null | undefined) =>
    x == null ? 0 : Number(x) / Math.pow(10, dpCurrency);
  const fromMinorPrimary = (x: number | string | null | undefined) =>
    x == null ? 0 : Number(x) / Math.pow(10, dpPrimary);

  return {
    primaryCurrency,
    po: {
      ...po,
      subtotalInCurrency: fromMinorCurrency(po.subtotalInCurrency),
      extrasTotalInCurrency: fromMinorCurrency(po.extrasTotalInCurrency),
      totalInCurrency: fromMinorCurrency(po.totalInCurrency),
      totalInPrimary: po.totalInPrimary != null ? fromMinorPrimary(po.totalInPrimary) : null,
    },
    lines: lines.map((l) => ({
      ...l.line,
      unitCostInCurrency: fromMinorCurrency(l.line.unitCostInCurrency),
      totalCostInCurrency: fromMinorCurrency(l.line.totalCostInCurrency),
      allocatedExtrasInCurrency: fromMinorCurrency(l.line.allocatedExtrasInCurrency),
      landedUnitCostInCurrency:
        l.line.landedUnitCostInCurrency != null
          ? fromMinorCurrency(l.line.landedUnitCostInCurrency)
          : null,
      landedUnitCostInPrimary:
        l.line.landedUnitCostInPrimary != null
          ? fromMinorPrimary(l.line.landedUnitCostInPrimary)
          : null,
      sellPriceInPrimary:
        l.line.sellPriceInPrimary != null ? fromMinorPrimary(l.line.sellPriceInPrimary) : null,
      variantSku: l.variantSku,
      variantName: l.variantName,
    })),
    extras: extras.map((e) => ({
      ...e,
      amountInCurrency: fromMinorCurrency(e.amountInCurrency),
    })),
    movements: movements.map((m) => ({
      ...m,
      unitCostSnapshot:
        m.unitCostSnapshot != null ? fromMinorPrimary(m.unitCostSnapshot) : null,
      totalCostInPrimary:
        m.totalCostInPrimary != null ? fromMinorPrimary(m.totalCostInPrimary) : null,
    })),
  };
}

// ── Crear PO ───────────────────────────────────────────────────────────────────

// El cliente envía costos/extras en unidades MAYORES (decimal, ej. R$ 87,50);
// la action convierte a minor units (centavos) antes de persistir en bigint.
const lineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1),
  unitCostInCurrency: z.number().min(0),
  /** Nuevo precio de venta en mayor de moneda primary (ej. PYG 250.000). */
  sellPriceInPrimary: z.number().nonnegative().optional(),
});

const extraSchema = z.object({
  description: z.string().min(1),
  amountInCurrency: z.number().min(0),
  allocationStrategy: z.enum(['cost', 'equal', 'qty', 'manual']).default('cost'),
  manualSplits: z
    .array(z.object({ purchaseOrderLineIndex: z.number(), amountInCurrency: z.number() }))
    .optional(),
});

const createSchema = z.object({
  supplierId: z.string().uuid(),
  currencyCode: z.string().min(2).max(10),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
  extras: z.array(extraSchema).default([]),
  /** Si se pasa, "promueve" el borrador (status=draft → placed) en vez de crear nueva PO. */
  promoteFromDraftId: z.string().uuid().optional(),
});

export async function createPurchaseOrder(input: z.infer<typeof createSchema>) {
  try {
    const tenant = await requireTenant();
    const { userId } = await requireSessionCapability(tenant.id, 'purchase.write');
    const parsed = createSchema.parse(input);

    const [primaryRow] = await db
      .select({ code: tenantCurrency.currencyCode })
      .from(tenantCurrency)
      .where(and(eq(tenantCurrency.tenantId, tenant.id), eq(tenantCurrency.isPrimary, true)))
      .limit(1);
    const primaryCurrencyCode = primaryRow?.code ?? 'PYG';

    const result = await db.transaction(async (tx) => {
      // Subtotal/extras/total se calculan en MINOR units (centavos) para guardar
      // como bigint sin pérdida de precisión. Los inputs son mayor; los convertimos.
      const dpCurrency = getCurrencyDecimalPlaces(parsed.currencyCode);
      const toMinor = (x: number) => Math.round(x * Math.pow(10, dpCurrency));
      const subtotal = parsed.lines.reduce(
        (acc, l) => acc + toMinor(l.unitCostInCurrency) * l.quantity,
        0
      );
      const extrasTotal = parsed.extras.reduce((acc, e) => acc + toMinor(e.amountInCurrency), 0);
      const total = subtotal + extrasTotal;

      let poId: string;
      let poNumber: string;

      if (parsed.promoteFromDraftId) {
        // Promote: valida que el draft exista y sea del tenant + status=draft
        const [draft] = await tx
          .select({ id: purchaseOrder.id, poNumber: purchaseOrder.poNumber, status: purchaseOrder.status })
          .from(purchaseOrder)
          .where(
            and(
              eq(purchaseOrder.id, parsed.promoteFromDraftId),
              eq(purchaseOrder.tenantId, tenant.id)
            )
          )
          .limit(1);
        if (!draft) throw new Error('Borrador no encontrado');
        if (draft.status !== 'draft')
          throw new Error(`No se puede promover: el estado es "${draft.status}"`);

        // Limpia líneas y extras existentes (manualSplits se borra en cascade)
        await tx
          .delete(purchaseOrderLine)
          .where(eq(purchaseOrderLine.purchaseOrderId, draft.id));
        await tx
          .delete(purchaseExtraCost)
          .where(eq(purchaseExtraCost.purchaseOrderId, draft.id));

        await tx
          .update(purchaseOrder)
          .set({
            supplierId: parsed.supplierId,
            currencyCode: parsed.currencyCode,
            notes: parsed.notes,
            status: 'placed',
            subtotalInCurrency: subtotal,
            extrasTotalInCurrency: extrasTotal,
            totalInCurrency: total,
            placedAt: sql`now()`,
            updatedAt: sql`now()`,
          })
          .where(eq(purchaseOrder.id, draft.id));

        poId = draft.id;
        poNumber = draft.poNumber;
      } else {
        poNumber = `PO-${tenant.slug}-${Date.now().toString(36).toUpperCase()}`;
        const [po] = await tx
          .insert(purchaseOrder)
          .values({
            tenantId: tenant.id,
            supplierId: parsed.supplierId,
            poNumber,
            status: 'placed',
            currencyCode: parsed.currencyCode,
            subtotalInCurrency: subtotal,
            extrasTotalInCurrency: extrasTotal,
            totalInCurrency: total,
            placedAt: sql`now()`,
            notes: parsed.notes,
            createdBy: userId,
          })
          .returning({ id: purchaseOrder.id });
        if (!po) throw new Error('No se pudo crear PO');
        poId = po.id;
      }

      await insertLinesAndExtras(
        tx,
        tenant.id,
        poId,
        parsed.currencyCode,
        primaryCurrencyCode,
        parsed.lines,
        parsed.extras
      );
      return { id: poId, poNumber };
    });

    revalidatePath('/admin/compras');
    return { ok: true as const, ...result };
  } catch (e) {
    return { ok: false as const, error: formatError(e) };
  }
}

/**
 * Helper compartido: inserta líneas + extras (con manual splits) en una PO existente.
 * Convierte los amounts mayor → minor units según los decimales de la moneda.
 */
async function insertLinesAndExtras(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  tenantId: string,
  poId: string,
  currencyCode: string,
  primaryCurrencyCode: string,
  lines: z.infer<typeof lineSchema>[],
  extras: z.infer<typeof extraSchema>[]
): Promise<void> {
  const dpCurrency = getCurrencyDecimalPlaces(currencyCode);
  const dpPrimary = getCurrencyDecimalPlaces(primaryCurrencyCode);
  const toMinorCurrency = (x: number) => Math.round(x * Math.pow(10, dpCurrency));
  const toMinorPrimary = (x: number) => Math.round(x * Math.pow(10, dpPrimary));

  const insertedLines: string[] = [];
  for (const l of lines) {
    const unitCostMinor = toMinorCurrency(l.unitCostInCurrency);
    const [created] = await tx
      .insert(purchaseOrderLine)
      .values({
        purchaseOrderId: poId,
        tenantId,
        variantId: l.variantId,
        quantity: l.quantity,
        unitCostInCurrency: unitCostMinor,
        totalCostInCurrency: unitCostMinor * l.quantity,
        sellPriceInPrimary:
          l.sellPriceInPrimary != null ? toMinorPrimary(l.sellPriceInPrimary) : null,
      })
      .returning({ id: purchaseOrderLine.id });
    if (created) insertedLines.push(created.id);
  }

  for (const e of extras) {
    const [createdExtra] = await tx
      .insert(purchaseExtraCost)
      .values({
        purchaseOrderId: poId,
        description: e.description,
        amountInCurrency: toMinorCurrency(e.amountInCurrency),
        allocationStrategy: e.allocationStrategy,
      })
      .returning({ id: purchaseExtraCost.id });
    if (e.allocationStrategy === 'manual' && e.manualSplits && createdExtra) {
      for (const s of e.manualSplits) {
        const lineId = insertedLines[s.purchaseOrderLineIndex];
        if (!lineId) continue;
        await tx.insert(purchaseExtraCostManualSplit).values({
          extraCostId: createdExtra.id,
          purchaseOrderLineId: lineId,
          amountInCurrency: toMinorCurrency(s.amountInCurrency),
        });
      }
    }
  }
}

// ── Borrador (status=draft) ────────────────────────────────────────────────────

const saveDraftSchema = z.object({
  /** Si se pasa, actualiza ese draft; sino crea uno nuevo. */
  draftId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  currencyCode: z.string().min(2).max(10),
  notes: z.string().optional(),
  /** En draft las líneas pueden estar vacías; solo se valida shape de las que hay. */
  lines: z.array(lineSchema).default([]),
  extras: z.array(extraSchema).default([]),
});

/** Crea o actualiza un borrador (status='draft'). Sin movimientos de stock. */
export async function saveDraftPurchaseOrder(input: z.infer<typeof saveDraftSchema>) {
  try {
    const tenant = await requireTenant();
    const { userId } = await requireSessionCapability(tenant.id, 'purchase.write');
    const parsed = saveDraftSchema.parse(input);

    if (!parsed.supplierId) {
      return { ok: false as const, error: 'Elegí un proveedor antes de guardar el borrador' };
    }
    const supplierId = parsed.supplierId;

    const [primaryRow] = await db
      .select({ code: tenantCurrency.currencyCode })
      .from(tenantCurrency)
      .where(and(eq(tenantCurrency.tenantId, tenant.id), eq(tenantCurrency.isPrimary, true)))
      .limit(1);
    const primaryCurrencyCode = primaryRow?.code ?? 'PYG';
    const dpCurrency = getCurrencyDecimalPlaces(parsed.currencyCode);
    const toMinor = (x: number) => Math.round(x * Math.pow(10, dpCurrency));

    const subtotal = parsed.lines.reduce(
      (acc, l) => acc + toMinor(l.unitCostInCurrency) * l.quantity,
      0
    );
    const extrasTotal = parsed.extras.reduce((acc, e) => acc + toMinor(e.amountInCurrency), 0);
    const total = subtotal + extrasTotal;

    const result = await db.transaction(async (tx) => {
      let poId: string;
      let poNumber: string;

      if (parsed.draftId) {
        const [existing] = await tx
          .select({ id: purchaseOrder.id, poNumber: purchaseOrder.poNumber, status: purchaseOrder.status })
          .from(purchaseOrder)
          .where(
            and(
              eq(purchaseOrder.id, parsed.draftId),
              eq(purchaseOrder.tenantId, tenant.id)
            )
          )
          .limit(1);
        if (!existing) throw new Error('Borrador no encontrado');
        if (existing.status !== 'draft')
          throw new Error(`Solo se pueden editar borradores (estado actual: ${existing.status})`);

        await tx
          .delete(purchaseOrderLine)
          .where(eq(purchaseOrderLine.purchaseOrderId, existing.id));
        await tx
          .delete(purchaseExtraCost)
          .where(eq(purchaseExtraCost.purchaseOrderId, existing.id));

        await tx
          .update(purchaseOrder)
          .set({
            supplierId,
            currencyCode: parsed.currencyCode,
            notes: parsed.notes,
            subtotalInCurrency: subtotal,
            extrasTotalInCurrency: extrasTotal,
            totalInCurrency: total,
            updatedAt: sql`now()`,
          })
          .where(eq(purchaseOrder.id, existing.id));

        poId = existing.id;
        poNumber = existing.poNumber;
      } else {
        poNumber = `PO-${tenant.slug}-${Date.now().toString(36).toUpperCase()}`;
        const [po] = await tx
          .insert(purchaseOrder)
          .values({
            tenantId: tenant.id,
            supplierId,
            poNumber,
            status: 'draft',
            currencyCode: parsed.currencyCode,
            subtotalInCurrency: subtotal,
            extrasTotalInCurrency: extrasTotal,
            totalInCurrency: total,
            notes: parsed.notes,
            createdBy: userId,
          })
          .returning({ id: purchaseOrder.id });
        if (!po) throw new Error('No se pudo crear el borrador');
        poId = po.id;
      }

      await insertLinesAndExtras(
        tx,
        tenant.id,
        poId,
        parsed.currencyCode,
        primaryCurrencyCode,
        parsed.lines,
        parsed.extras
      );
      return { id: poId, poNumber };
    });

    revalidatePath('/admin/compras');
    return {
      ok: true as const,
      draftId: result.id,
      poNumber: result.poNumber,
    };
  } catch (e) {
    return { ok: false as const, error: formatError(e) };
  }
}

export type DraftForEdit = {
  id: string;
  poNumber: string;
  supplierId: string;
  currencyCode: string;
  notes: string | null;
  lines: Array<{
    id: string;
    variant: PurchaseVariantOption;
    quantity: number;
    unitCost: number;
    sellPrice: number | null;
  }>;
  extras: Array<{
    id: string;
    description: string;
    amount: number;
    strategy: 'cost' | 'equal' | 'qty' | 'manual';
  }>;
};

/** Trae un draft con líneas enriquecidas para hidratar el form de edición. */
export async function getDraftForEdit(
  draftId: string
): Promise<{ ok: true; draft: DraftForEdit } | { ok: false; error: string }> {
  try {
    const tenantId = await requireTenantId();
    await requireSessionCapability(tenantId, 'purchase.write');
    const [po] = await db
      .select()
      .from(purchaseOrder)
      .where(and(eq(purchaseOrder.id, draftId), eq(purchaseOrder.tenantId, tenantId)))
      .limit(1);
    if (!po) return { ok: false, error: 'Borrador no encontrado' };
    if (po.status !== 'draft')
      return { ok: false, error: `No editable: estado actual "${po.status}"` };

    const rawLines = await db
      .select({
        lineId: purchaseOrderLine.id,
        variantId: purchaseOrderLine.variantId,
        quantity: purchaseOrderLine.quantity,
        unitCostInCurrency: purchaseOrderLine.unitCostInCurrency,
        sellPriceInPrimary: purchaseOrderLine.sellPriceInPrimary,
      })
      .from(purchaseOrderLine)
      .where(eq(purchaseOrderLine.purchaseOrderId, draftId));

    const variantIds = rawLines.map((l) => l.variantId);
    const enriched = await enrichVariantsForPurchase(tenantId, variantIds);
    const variantById = new Map(enriched.results.map((v) => [v.variantId, v]));

    // DB guarda en minor units; el form trabaja en major.
    const dpCurrency = getCurrencyDecimalPlaces(po.currencyCode);
    const [primaryRow2] = await db
      .select({ code: tenantCurrency.currencyCode })
      .from(tenantCurrency)
      .where(and(eq(tenantCurrency.tenantId, tenantId), eq(tenantCurrency.isPrimary, true)))
      .limit(1);
    const dpPrimary = getCurrencyDecimalPlaces(primaryRow2?.code ?? 'PYG');
    const fromMinorCurrency = (x: number) => x / Math.pow(10, dpCurrency);
    const fromMinorPrimary = (x: number) => x / Math.pow(10, dpPrimary);

    const lines = rawLines
      .map((l) => {
        const v = variantById.get(l.variantId);
        if (!v) return null;
        return {
          id: l.lineId,
          variant: v,
          quantity: l.quantity,
          unitCost: fromMinorCurrency(Number(l.unitCostInCurrency)),
          sellPrice:
            l.sellPriceInPrimary != null ? fromMinorPrimary(Number(l.sellPriceInPrimary)) : null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const rawExtras = await db
      .select({
        id: purchaseExtraCost.id,
        description: purchaseExtraCost.description,
        amountInCurrency: purchaseExtraCost.amountInCurrency,
        allocationStrategy: purchaseExtraCost.allocationStrategy,
      })
      .from(purchaseExtraCost)
      .where(eq(purchaseExtraCost.purchaseOrderId, draftId));

    const extras = rawExtras.map((e) => ({
      id: e.id,
      description: e.description,
      amount: fromMinorCurrency(Number(e.amountInCurrency)),
      strategy: (e.allocationStrategy as DraftForEdit['extras'][number]['strategy']) ?? 'cost',
    }));

    return {
      ok: true,
      draft: {
        id: po.id,
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        currencyCode: po.currencyCode,
        notes: po.notes,
        lines,
        extras,
      },
    };
  } catch (e) {
    return { ok: false, error: formatError(e) };
  }
}

/** Borra un borrador. Solo permite borrar draft (no placed/received). */
export async function deleteDraftPurchaseOrder(draftId: string) {
  try {
    const tenantId = await requireTenantId();
    await requireSessionCapability(tenantId, 'purchase.write');
    const [existing] = await db
      .select({ id: purchaseOrder.id, status: purchaseOrder.status })
      .from(purchaseOrder)
      .where(and(eq(purchaseOrder.id, draftId), eq(purchaseOrder.tenantId, tenantId)))
      .limit(1);
    if (!existing) return { ok: false as const, error: 'Borrador no encontrado' };
    if (existing.status !== 'draft')
      return { ok: false as const, error: `No se puede borrar: estado "${existing.status}"` };
    await db.delete(purchaseOrder).where(eq(purchaseOrder.id, draftId));
    revalidatePath('/admin/compras');
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: formatError(e) };
  }
}

// ── Recibir PO (con prorrateo y avg cost update) ───────────────────────────────

const receiveSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  /** Cotización al recibir (currency de la PO → primary) */
  exchangeRateOverride: z.number().positive().optional(),
});

export async function receivePurchaseOrder(input: z.infer<typeof receiveSchema>) {
  try {
    const tenant = await requireTenant();
    const { userId } = await requireSessionCapability(tenant.id, 'purchase.receive');
    const parsed = receiveSchema.parse(input);

    const result = await db.transaction(async (tx) => {
      const [po] = await tx
        .select()
        .from(purchaseOrder)
        .where(
          and(
            eq(purchaseOrder.id, parsed.purchaseOrderId),
            eq(purchaseOrder.tenantId, tenant.id)
          )
        )
        .limit(1);
      if (!po) throw new Error('PO no encontrada');
      if (po.status !== 'placed' && po.status !== 'partially_received') {
        throw new Error(`PO en estado ${po.status} no se puede recibir`);
      }

      // 1. Determinar exchange rate a primary
      const [primaryRow] = await tx
        .select()
        .from(tenantCurrency)
        .where(
          and(eq(tenantCurrency.tenantId, tenant.id), eq(tenantCurrency.isPrimary, true))
        )
        .limit(1);
      if (!primaryRow) throw new Error('No hay moneda primary configurada');
      const primaryCode = primaryRow.currencyCode;
      let rate = 1;
      if (po.currencyCode !== primaryCode) {
        if (parsed.exchangeRateOverride) {
          rate = parsed.exchangeRateOverride;
        } else {
          // Toma el sellRate vigente para la currency de la PO (lo que pago al comprar moneda extranjera)
          const [latest] = await tx
            .select({ buyRate: exchangeRate.buyRate })
            .from(exchangeRate)
            .where(
              and(
                eq(exchangeRate.tenantId, tenant.id),
                eq(exchangeRate.currencyCode, po.currencyCode)
              )
            )
            .orderBy(desc(exchangeRate.effectiveFrom))
            .limit(1);
          if (!latest) throw new Error(`Sin cotización para ${po.currencyCode}`);
          rate = Number(latest.buyRate);
        }
      }

      // 2. Cargar lines y extras
      const lines = await tx
        .select()
        .from(purchaseOrderLine)
        .where(eq(purchaseOrderLine.purchaseOrderId, po.id))
        .orderBy(asc(purchaseOrderLine.id));
      const extras = await tx
        .select()
        .from(purchaseExtraCost)
        .where(eq(purchaseExtraCost.purchaseOrderId, po.id));

      const totalQty = lines.reduce((acc, l) => acc + l.quantity, 0);
      const totalCost = lines.reduce((acc, l) => acc + Number(l.totalCostInCurrency), 0);

      // 3. Calcular allocated_extras por línea según strategy de cada extra cost
      const allocatedByLine = new Map<string, number>();
      for (const l of lines) allocatedByLine.set(l.id, 0);

      for (const e of extras) {
        const eAmount = Number(e.amountInCurrency);
        if (e.allocationStrategy === 'cost' && totalCost > 0) {
          for (const l of lines) {
            const share = (Number(l.totalCostInCurrency) / totalCost) * eAmount;
            allocatedByLine.set(l.id, (allocatedByLine.get(l.id) ?? 0) + share);
          }
        } else if (e.allocationStrategy === 'equal' && lines.length > 0) {
          const share = eAmount / lines.length;
          for (const l of lines) {
            allocatedByLine.set(l.id, (allocatedByLine.get(l.id) ?? 0) + share);
          }
        } else if (e.allocationStrategy === 'qty' && totalQty > 0) {
          for (const l of lines) {
            const share = (l.quantity / totalQty) * eAmount;
            allocatedByLine.set(l.id, (allocatedByLine.get(l.id) ?? 0) + share);
          }
        } else if (e.allocationStrategy === 'manual') {
          const splits = await tx
            .select()
            .from(purchaseExtraCostManualSplit)
            .where(eq(purchaseExtraCostManualSplit.extraCostId, e.id));
          for (const s of splits) {
            allocatedByLine.set(
              s.purchaseOrderLineId,
              (allocatedByLine.get(s.purchaseOrderLineId) ?? 0) + Number(s.amountInCurrency)
            );
          }
        }
      }

      // 4. Por cada línea: actualizar landed_unit_cost + insert stock_movement + update avg_cost + decrement stock
      const variantIds = lines.map((l) => l.variantId);
      const existingAvg = await tx
        .select()
        .from(productVariantAvgCost)
        .where(inArray(productVariantAvgCost.variantId, variantIds));
      const avgByVariant = new Map<string, { avg: number; stockValue: number }>();
      for (const a of existingAvg) {
        avgByVariant.set(a.variantId, {
          avg: Number(a.avgCostInPrimary),
          stockValue: Number(a.stockValueInPrimary),
        });
      }
      const stockBefore = await tx
        .select({ id: productVariant.id, stock: productVariant.stock })
        .from(productVariant)
        .where(inArray(productVariant.id, variantIds));
      const stockMap = new Map<string, number>();
      for (const s of stockBefore) stockMap.set(s.id, s.stock);

      // Para convertir landed (en minor de currencyCode) a minor de primary:
      // landed_minor_primary = (landed_minor_currency / 10^dp_currency) * rate * 10^dp_primary
      // Equivalente: landed * rate * 10^(dp_primary - dp_currency).
      const dpCurrency = getCurrencyDecimalPlaces(po.currencyCode);
      const dpPrimary = getCurrencyDecimalPlaces(primaryCode);
      const minorConversionFactor = Math.pow(10, dpPrimary - dpCurrency);

      for (const l of lines) {
        const allocated = Math.round(allocatedByLine.get(l.id) ?? 0);
        const landedUnit = Math.round(
          Number(l.unitCostInCurrency) + allocated / l.quantity
        );
        const landedUnitInPrimary = Math.round(landedUnit * rate * minorConversionFactor);

        await tx
          .update(purchaseOrderLine)
          .set({
            allocatedExtrasInCurrency: allocated,
            landedUnitCostInCurrency: landedUnit,
            landedUnitCostInPrimary: landedUnitInPrimary,
            receivedQuantity: l.quantity,
          })
          .where(eq(purchaseOrderLine.id, l.id));

        await tx.insert(stockMovement).values({
          tenantId: tenant.id,
          variantId: l.variantId,
          kind: 'purchase',
          quantity: l.quantity,
          unitCostSnapshot: landedUnitInPrimary,
          totalCostInPrimary: landedUnitInPrimary * l.quantity,
          purchaseOrderId: po.id,
          createdBy: userId,
        });

        await tx
          .update(productVariant)
          .set({ stock: sql`${productVariant.stock} + ${l.quantity}` })
          .where(eq(productVariant.id, l.variantId));

        // Aplica nuevo precio de venta si la línea lo trae
        if (l.sellPriceInPrimary != null && Number(l.sellPriceInPrimary) >= 0) {
          await tx
            .update(productVariant)
            .set({ price: Number(l.sellPriceInPrimary) })
            .where(eq(productVariant.id, l.variantId));
        }

        // Update avg cost (weighted)
        const prev = avgByVariant.get(l.variantId) ?? { avg: 0, stockValue: 0 };
        const prevStock = stockMap.get(l.variantId) ?? 0;
        const newStock = prevStock + l.quantity;
        const newStockValue = prev.stockValue + landedUnitInPrimary * l.quantity;
        const newAvg = newStock > 0 ? Math.round(newStockValue / newStock) : 0;
        const [existing] = existingAvg.filter((a) => a.variantId === l.variantId);
        if (existing) {
          await tx
            .update(productVariantAvgCost)
            .set({
              avgCostInPrimary: newAvg,
              stockValueInPrimary: newStockValue,
              updatedAt: new Date(),
            })
            .where(eq(productVariantAvgCost.variantId, l.variantId));
        } else {
          await tx.insert(productVariantAvgCost).values({
            variantId: l.variantId,
            tenantId: tenant.id,
            avgCostInPrimary: newAvg,
            stockValueInPrimary: newStockValue,
          });
        }
        avgByVariant.set(l.variantId, { avg: newAvg, stockValue: newStockValue });
        stockMap.set(l.variantId, newStock);
      }

      // 5. Update PO header
      await tx
        .update(purchaseOrder)
        .set({
          status: 'received',
          receivedAt: sql`now()`,
          exchangeRateSnapshot: rate.toString(),
          totalInPrimary: Math.round(Number(po.totalInCurrency) * rate),
          updatedAt: sql`now()`,
        })
        .where(eq(purchaseOrder.id, po.id));

      return { id: po.id };
    });

    revalidatePath('/admin/compras');
    revalidatePath(`/admin/compras/${result.id}`);
    revalidatePath('/admin/inventario');
    return { ok: true as const, id: result.id };
  } catch (e) {
    return { ok: false as const, error: formatError(e) };
  }
}

// ── Cancelar PO (revierte stock si ya recibida) ────────────────────────────────

export async function cancelPurchaseOrder(id: string) {
  try {
    const tenant = await requireTenant();
    const { userId } = await requireSessionCapability(tenant.id, 'purchase.write');
    await db.transaction(async (tx) => {
      const [po] = await tx
        .select()
        .from(purchaseOrder)
        .where(and(eq(purchaseOrder.id, id), eq(purchaseOrder.tenantId, tenant.id)))
        .limit(1);
      if (!po) throw new Error('PO no encontrada');
      if (po.status === 'cancelled') return;
      if (po.status === 'received') {
        // Revertir stock con kind='purchase_cancel'
        const lines = await tx
          .select()
          .from(purchaseOrderLine)
          .where(eq(purchaseOrderLine.purchaseOrderId, po.id));
        const original = await tx
          .select({ id: stockMovement.id, variantId: stockMovement.variantId, quantity: stockMovement.quantity })
          .from(stockMovement)
          .where(
            and(
              eq(stockMovement.purchaseOrderId, po.id),
              eq(stockMovement.kind, 'purchase')
            )
          );
        const origByVariant = new Map<string, { id: string; quantity: number }>();
        for (const o of original) origByVariant.set(o.variantId, o);
        for (const l of lines) {
          const orig = origByVariant.get(l.variantId);
          await tx.insert(stockMovement).values({
            tenantId: tenant.id,
            variantId: l.variantId,
            kind: 'purchase_cancel',
            quantity: l.quantity,
            originalMovementId: orig?.id ?? null,
            purchaseOrderId: po.id,
            createdBy: userId,
            reason: 'cancel',
          });
          await tx
            .update(productVariant)
            .set({ stock: sql`${productVariant.stock} - ${l.quantity}` })
            .where(eq(productVariant.id, l.variantId));
        }
      }
      await tx
        .update(purchaseOrder)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(purchaseOrder.id, po.id));
    });
    revalidatePath('/admin/compras');
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: formatError(e) };
  }
}
