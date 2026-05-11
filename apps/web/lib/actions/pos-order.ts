'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  order,
  orderLine,
  payment,
  paymentDetail,
  cashSession,
  cashMovement,
  posConfig,
  productVariant,
  productVariantAvgCost,
  stockMovement,
  tenantCurrency,
  exchangeRate,
} from '@frc-e-commerce/db/schema';
import { requireTenant, requireTenantId } from '@/lib/tenant';
import {
  CapabilityDeniedError,
  requireSessionCapability,
} from '@/lib/auth/permissions';

function formatError(e: unknown): string {
  if (e instanceof CapabilityDeniedError) return 'No tenés permiso para esta acción';
  if (e instanceof Error) return e.message;
  return 'Error desconocido';
}

// Schema del payload — debe matchear lo que envía CheckoutDialog
const lineSchema = z.object({
  variantId: z.string().uuid(),
  productName: z.string(),
  variantName: z.string(),
  sku: z.string().optional(),
  color: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  sizeKind: z.string().nullable().optional(),
  unitPrice: z.number().int().min(0),
  quantity: z.number().int().min(1),
  discountAmount: z.number().int().min(0).default(0),
  discountReason: z.string().optional(),
  isComplimentary: z.boolean().default(false),
  complimentaryAuthorizedBy: z.string().optional().nullable(),
  totalPrice: z.number().int().min(0),
});

const detailSchema = z.object({
  kind: z.enum(['payment', 'change', 'discount', 'surcharge']),
  paymentMethod: z.string().nullable(),
  currencyCode: z.string().nullable(),
  amount: z.number().min(0),
  exchangeRateSnapshot: z.string().nullable(),
  amountInPrimary: z.number(),
});

const createPosOrderSchema = z.object({
  customer: z.object({
    customerId: z.string().uuid().nullable(),
    name: z.string().min(1),
    document: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
  }),
  primaryCurrency: z.string(),
  lines: z.array(lineSchema).min(1),
  paymentDetails: z.array(detailSchema).min(1),
  generalDiscountAmount: z.number().int().min(0).default(0),
  generalDiscountReason: z.string().optional(),
  surchargeAmount: z.number().int().min(0).default(0),
  surchargeReason: z.string().optional(),
  subtotal: z.number().int().min(0),
  total: z.number().int().min(0),
  notes: z.string().optional(),
});

export async function createPosOrder(input: z.infer<typeof createPosOrderSchema>) {
  try {
    const tenant = await requireTenant();
    const { userId } = await requireSessionCapability(tenant.id, 'pos.sell');
    const parsed = createPosOrderSchema.parse(input);

    // 1. Cash session activa del cashier
    const [activeSession] = await db
      .select()
      .from(cashSession)
      .where(
        and(
          eq(cashSession.tenantId, tenant.id),
          eq(cashSession.cashierId, userId),
          eq(cashSession.status, 'open')
        )
      )
      .limit(1);
    if (!activeSession) {
      return { ok: false as const, error: 'Necesitás abrir caja antes de cobrar' };
    }

    // 2. Costos snapshot por variante
    const variantIds = parsed.lines.map((l) => l.variantId);
    const costs = await db
      .select({
        variantId: productVariantAvgCost.variantId,
        avgCost: productVariantAvgCost.avgCostInPrimary,
      })
      .from(productVariantAvgCost)
      .where(eq(productVariantAvgCost.tenantId, tenant.id));
    const costByVariant = new Map<string, number>();
    for (const c of costs) costByVariant.set(c.variantId, Number(c.avgCost));

    // 3. Validar payment_method/currencyCode permitidos por config
    const [cfg] = await db
      .select()
      .from(posConfig)
      .where(eq(posConfig.tenantId, tenant.id))
      .limit(1);

    const result = await db.transaction(async (tx) => {
      // 4. Asignar correlativo
      const [updatedCfg] = await tx
        .update(posConfig)
        .set({ ticketCorrelative: sql`${posConfig.ticketCorrelative} + 1`, updatedAt: new Date() })
        .where(eq(posConfig.tenantId, tenant.id))
        .returning({ ticketCorrelative: posConfig.ticketCorrelative, prefix: posConfig.ticketPrefix });
      if (!updatedCfg) throw new Error('No se pudo asignar correlativo');
      const correlative = Number(updatedCfg.ticketCorrelative);
      const orderNumber = `${updatedCfg.prefix}-${tenant.slug}-${String(correlative).padStart(6, '0')}`;

      // 5. Insert order header
      const [createdOrder] = await tx
        .insert(order)
        .values({
          tenantId: tenant.id,
          userId,
          customerId: parsed.customer.customerId,
          orderNumber,
          ticketCorrelative: correlative,
          status: 'confirmed',
          customerName: parsed.customer.name,
          customerEmail: parsed.customer.email ?? '',
          customerPhone: parsed.customer.phone,
          subtotal: parsed.subtotal,
          discountAmount: parsed.generalDiscountAmount,
          discountReason: parsed.generalDiscountReason,
          surchargeAmount: parsed.surchargeAmount,
          surchargeReason: parsed.surchargeReason,
          shippingCost: 0,
          tax: 0,
          total: parsed.total,
          currency: parsed.primaryCurrency,
          primaryCurrencyAtTime: parsed.primaryCurrency,
          shippingAddressJson: {},
          notes: parsed.notes,
          channel: 'pos',
          cashSessionId: activeSession.id,
        })
        .returning({ id: order.id });
      if (!createdOrder) throw new Error('No se pudo crear order');

      // 6. Insert order_lines + stock_movements + decrement stock
      for (const l of parsed.lines) {
        const cost = costByVariant.get(l.variantId) ?? null;
        await tx.insert(orderLine).values({
          orderId: createdOrder.id,
          tenantId: tenant.id,
          variantId: l.variantId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discountAmount: l.discountAmount,
          discountReason: l.discountReason,
          totalPrice: l.totalPrice,
          isComplimentary: l.isComplimentary,
          complimentaryAuthorizedBy: l.complimentaryAuthorizedBy ?? null,
          complimentaryAuthorizedAt: l.complimentaryAuthorizedBy ? new Date() : null,
          costSnapshot: cost,
          variantSnapshot: {
            color: l.color ?? null,
            size: l.size ?? null,
            sizeKind: l.sizeKind ?? null,
            sku: l.sku ?? '',
            productName: l.productName,
            variantName: l.variantName,
          },
        });

        await tx.insert(stockMovement).values({
          tenantId: tenant.id,
          variantId: l.variantId,
          kind: 'sale',
          quantity: l.quantity,
          unitCostSnapshot: cost,
          totalCostInPrimary: cost != null ? cost * l.quantity : null,
          orderId: createdOrder.id,
          createdBy: userId,
        });

        await tx
          .update(productVariant)
          .set({ stock: sql`${productVariant.stock} - ${l.quantity}` })
          .where(eq(productVariant.id, l.variantId));
      }

      // 7. Insert payment header
      const [createdPayment] = await tx
        .insert(payment)
        .values({
          orderId: createdOrder.id,
          tenantId: tenant.id,
          method: 'pos',
          status: 'captured',
          amount: parsed.total,
          currency: parsed.primaryCurrency,
          amountInPrimary: parsed.total,
        })
        .returning({ id: payment.id });
      if (!createdPayment) throw new Error('No se pudo crear payment');

      // 8. Insert payment_detail rows + cash_movement por cada línea con plata real
      const cashMethods = new Set(['efectivo', 'transferencia', 'tarjeta_pos', 'cheque']);
      for (let i = 0; i < parsed.paymentDetails.length; i++) {
        const d = parsed.paymentDetails[i];
        if (!d) continue;
        await tx.insert(paymentDetail).values({
          paymentId: createdPayment.id,
          kind: d.kind,
          paymentMethod: d.paymentMethod,
          currencyCode: d.currencyCode,
          amount: d.amount,
          exchangeRateSnapshot: d.exchangeRateSnapshot,
          amountInPrimary: d.amountInPrimary,
          position: i,
        });

        if (
          d.paymentMethod &&
          d.currencyCode &&
          cashMethods.has(d.paymentMethod) &&
          (d.kind === 'payment' || d.kind === 'change')
        ) {
          const cmKind = d.kind === 'payment' ? 'sale_in' : 'sale_return_out';
          await tx.insert(cashMovement).values({
            cashSessionId: activeSession.id,
            tenantId: tenant.id,
            kind: cmKind,
            paymentMethod: d.paymentMethod,
            currencyCode: d.currencyCode,
            amount: d.amount,
            exchangeRateSnapshot: d.exchangeRateSnapshot,
            amountInPrimary: d.amountInPrimary,
            orderId: createdOrder.id,
            createdBy: userId,
          });
        }
      }

      return { orderId: createdOrder.id, orderNumber, correlative };
    });

    revalidatePath('/pos');
    revalidatePath('/admin/pedidos');
    return {
      ok: true as const,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      correlative: result.correlative,
    };
  } catch (e) {
    return { ok: false as const, error: formatError(e) };
  }
}
