'use server';

import { revalidatePath } from 'next/cache';
import { eq, and, sql, inArray, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  order,
  orderLine,
  payment,
  paymentDetail,
  productVariant,
  stockMovement,
  cashSession,
  cashMovement,
} from '@frc-e-commerce/db/schema';
import { requireTenantId } from '@/lib/tenant';
import {
  CapabilityDeniedError,
  requireSessionCapability,
} from '@/lib/auth/permissions';

function formatError(e: unknown): string {
  if (e instanceof CapabilityDeniedError) return 'No tenés permiso para esta acción';
  if (e instanceof Error) return e.message;
  return 'Error desconocido';
}

/**
 * Cancela una venta POS completa.
 * - Stock movement kind='sale_cancel' por cada línea (revierte stock vendido)
 * - Si la cash_session original sigue abierta: cash_movement kind='sale_cancel_out' por cada
 *   payment_detail en efectivo. Si está cerrada: queda como ajuste contable (no toca caja).
 * - Order pasa a status='cancelled'
 */
export async function cancelPosOrder(orderId: string) {
  try {
    const tenantId = await requireTenantId();
    const { userId } = await requireSessionCapability(tenantId, 'order.cancel');

    await db.transaction(async (tx) => {
      const [o] = await tx
        .select()
        .from(order)
        .where(and(eq(order.id, orderId), eq(order.tenantId, tenantId)))
        .limit(1);
      if (!o) throw new Error('Pedido no encontrado');
      if (o.status === 'cancelled') throw new Error('Ya está cancelado');
      if (o.channel !== 'pos') throw new Error('Use cancelOrder para órdenes web');

      const lines = await tx
        .select()
        .from(orderLine)
        .where(eq(orderLine.orderId, o.id));

      // Stock revert por cada línea (qty efectiva = quantity - returnedQty - cancelledQty)
      for (const l of lines) {
        const remaining = l.quantity - l.returnedQuantity - l.cancelledQuantity;
        if (remaining <= 0) continue;
        const [origMov] = await tx
          .select({ id: stockMovement.id })
          .from(stockMovement)
          .where(
            and(
              eq(stockMovement.orderId, o.id),
              eq(stockMovement.variantId, l.variantId),
              eq(stockMovement.kind, 'sale')
            )
          )
          .limit(1);
        await tx.insert(stockMovement).values({
          tenantId,
          variantId: l.variantId,
          kind: 'sale_cancel',
          quantity: remaining,
          unitCostSnapshot: l.costSnapshot,
          totalCostInPrimary: l.costSnapshot != null ? l.costSnapshot * remaining : null,
          orderId: o.id,
          originalMovementId: origMov?.id ?? null,
          createdBy: userId,
        });
        await tx
          .update(productVariant)
          .set({ stock: sql`${productVariant.stock} + ${remaining}` })
          .where(eq(productVariant.id, l.variantId));
        await tx
          .update(orderLine)
          .set({ cancelledQuantity: l.quantity - l.returnedQuantity })
          .where(eq(orderLine.id, l.id));
      }

      // Cash impact si sesión sigue abierta
      let sessionStillOpen = false;
      if (o.cashSessionId) {
        const [s] = await tx
          .select({ status: cashSession.status })
          .from(cashSession)
          .where(eq(cashSession.id, o.cashSessionId))
          .limit(1);
        sessionStillOpen = s?.status === 'open';
      }

      if (sessionStillOpen && o.cashSessionId) {
        const details = await tx
          .select()
          .from(paymentDetail)
          .innerJoin(payment, eq(payment.id, paymentDetail.paymentId))
          .where(and(eq(payment.orderId, o.id), eq(paymentDetail.kind, 'payment')));
        for (const d of details) {
          const pd = d.payment_detail;
          if (!pd.paymentMethod || !pd.currencyCode) continue;
          await tx.insert(cashMovement).values({
            cashSessionId: o.cashSessionId,
            tenantId,
            kind: 'sale_cancel_out',
            paymentMethod: pd.paymentMethod,
            currencyCode: pd.currencyCode,
            amount: pd.amount,
            exchangeRateSnapshot: pd.exchangeRateSnapshot,
            amountInPrimary: pd.amountInPrimary,
            orderId: o.id,
            createdBy: userId,
            reason: 'cancelación venta',
          });
        }
      }

      // Update order status
      await tx
        .update(order)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
          notes: sessionStillOpen
            ? o.notes
            : (o.notes ?? '') + ' [ajuste contable: caja cerrada]',
        })
        .where(eq(order.id, o.id));

      // Update payment status
      await tx
        .update(payment)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(payment.orderId, o.id));
    });

    revalidatePath('/admin/pedidos');
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: formatError(e) };
  }
}

/**
 * Registra una devolución parcial de venta POS.
 * Cada línea con returnedQty > 0 incrementa orderLine.returnedQuantity, inserta
 * stock_movement kind='sale_return', y si la sesión sigue abierta y el método
 * era efectivo, inserta cash_movement kind='sale_return_out'.
 */
const returnSchema = z.object({
  orderId: z.string().uuid(),
  /** lineId → cantidad a devolver (debe ser <= quantity - returnedQuantity - cancelledQuantity) */
  returns: z.array(z.object({ lineId: z.string().uuid(), quantity: z.number().int().min(1) })).min(1),
  reason: z.string().optional(),
});

export async function registerSaleReturn(input: z.infer<typeof returnSchema>) {
  try {
    const tenantId = await requireTenantId();
    const { userId } = await requireSessionCapability(tenantId, 'order.return');
    const parsed = returnSchema.parse(input);

    const result = await db.transaction(async (tx) => {
      const [o] = await tx
        .select()
        .from(order)
        .where(and(eq(order.id, parsed.orderId), eq(order.tenantId, tenantId)))
        .limit(1);
      if (!o) throw new Error('Pedido no encontrado');
      if (o.status === 'cancelled') throw new Error('Pedido cancelado');

      const lineIds = parsed.returns.map((r) => r.lineId);
      const lines = await tx.select().from(orderLine).where(inArray(orderLine.id, lineIds));
      const linesById = new Map(lines.map((l) => [l.id, l]));

      let totalRefundInPrimary = 0;
      for (const r of parsed.returns) {
        const l = linesById.get(r.lineId);
        if (!l) throw new Error('Línea no encontrada');
        const available = l.quantity - l.returnedQuantity - l.cancelledQuantity;
        if (r.quantity > available) {
          throw new Error(`No podés devolver ${r.quantity}, disponible: ${available}`);
        }
        const [origMov] = await tx
          .select({ id: stockMovement.id })
          .from(stockMovement)
          .where(
            and(
              eq(stockMovement.orderId, o.id),
              eq(stockMovement.variantId, l.variantId),
              eq(stockMovement.kind, 'sale')
            )
          )
          .limit(1);
        await tx.insert(stockMovement).values({
          tenantId,
          variantId: l.variantId,
          kind: 'sale_return',
          quantity: r.quantity,
          unitCostSnapshot: l.costSnapshot,
          totalCostInPrimary: l.costSnapshot != null ? l.costSnapshot * r.quantity : null,
          orderId: o.id,
          originalMovementId: origMov?.id ?? null,
          reason: parsed.reason,
          createdBy: userId,
        });
        await tx
          .update(productVariant)
          .set({ stock: sql`${productVariant.stock} + ${r.quantity}` })
          .where(eq(productVariant.id, l.variantId));
        await tx
          .update(orderLine)
          .set({ returnedQuantity: l.returnedQuantity + r.quantity })
          .where(eq(orderLine.id, l.id));

        // Refund proporcional al unitPrice de la línea (precio original)
        const refundForLine =
          (l.totalPrice / Math.max(1, l.quantity - l.cancelledQuantity)) * r.quantity;
        totalRefundInPrimary += Math.round(refundForLine);
      }

      // Cash impact si la sesión sigue abierta
      if (o.cashSessionId && o.channel === 'pos') {
        const [s] = await tx
          .select({ status: cashSession.status })
          .from(cashSession)
          .where(eq(cashSession.id, o.cashSessionId))
          .limit(1);
        if (s?.status === 'open') {
          // Refund proporcional por payment_detail kind='payment' (solo efectivo)
          const details = await tx
            .select()
            .from(paymentDetail)
            .innerJoin(payment, eq(payment.id, paymentDetail.paymentId))
            .where(
              and(
                eq(payment.orderId, o.id),
                eq(paymentDetail.kind, 'payment'),
                eq(paymentDetail.paymentMethod, 'efectivo')
              )
            );
          // Total efectivo cobrado en la venta original
          const totalCash = details.reduce(
            (acc, d) => acc + Number(d.payment_detail.amountInPrimary),
            0
          );
          // Si hubo efectivo, devolver proporcional al monto refund vs cash original
          if (totalCash > 0) {
            for (const d of details) {
              const pd = d.payment_detail;
              if (!pd.currencyCode) continue;
              const share = Number(pd.amountInPrimary) / totalCash;
              const refundShare = Math.round(totalRefundInPrimary * share);
              if (refundShare > 0) {
                await tx.insert(cashMovement).values({
                  cashSessionId: o.cashSessionId,
                  tenantId,
                  kind: 'sale_return_out',
                  paymentMethod: 'efectivo',
                  currencyCode: pd.currencyCode,
                  amount: refundShare,
                  exchangeRateSnapshot: pd.exchangeRateSnapshot,
                  amountInPrimary: refundShare,
                  orderId: o.id,
                  createdBy: userId,
                  reason: parsed.reason ?? 'devolución parcial',
                });
              }
            }
          }
        }
      }

      return { totalRefundInPrimary };
    });

    revalidatePath('/admin/pedidos');
    revalidatePath(`/admin/pedidos/${parsed.orderId}`);
    return { ok: true as const, refunded: result.totalRefundInPrimary };
  } catch (e) {
    return { ok: false as const, error: formatError(e) };
  }
}
