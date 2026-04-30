'use server';
import { isRedirectError } from '@/lib/actions/_redirect-helper';

import { revalidatePath } from 'next/cache';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  cart,
  cartLine,
  order,
  orderLine,
  payment,
  type Order,
  type Payment,
} from '@frc-e-commerce/db/schema';
import { requireTenantId, requireTenant } from '@/lib/tenant';
import { getSession } from '@/lib/auth/guards';
import { requireTenantMembership } from '@/lib/auth/guards';
import { getOrCreateCart } from './cart';
import { getPaymentHandler } from '@/lib/payments';
import { cookies } from 'next/headers';

const CART_COOKIE = 'cart_id';

function generateOrderNumber(tenantSlug: string): string {
  // ORD-TENANTSLUG-<8 hex chars from random UUID>
  const shortId = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `ORD-${tenantSlug.toUpperCase()}-${shortId}`;
}

export interface ShippingAddress {
  street: string;
  city: string;
  /** Department / state / province */
  state?: string;
  department?: string;
  zip?: string;
  postalCode?: string;
  country?: string;
  additionalInfo?: string;
}

export interface CreateOrderInput {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  notes?: string;
}

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNumber: string }
  | { ok: false; error: string };

/** Converts the current cart into a confirmed order with a payment record. */
export async function createOrderFromCart(input: CreateOrderInput): Promise<CreateOrderResult> {
  try {
    const currentTenant = await requireTenant();
    const tenantId = currentTenant.id;
    const session = await getSession();
    const userId = session?.user.id ?? null;

    // Load cart + lines
    const currentCart = await getOrCreateCart();
    const lines = await db.select().from(cartLine).where(eq(cartLine.cartId, currentCart.id));

    if (lines.length === 0) {
      return { ok: false, error: 'El carrito está vacío' };
    }

    // Compute totals (all amounts in minor currency units)
    const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    const shippingCost = 0; // TODO: calculate shipping based on address/rules
    const tax = 0; // TODO: calculate tax based on tenant settings
    const total = subtotal + shippingCost + tax;
    const currency = currentCart.currency;

    // Get the payment handler before writing to DB (fast fail)
    const handler = getPaymentHandler(input.paymentMethod);

    const orderNumber = generateOrderNumber(currentTenant.slug);

    // Create order, lines and payment in a transaction
    const [createdOrder] = await db
      .insert(order)
      .values({
        tenantId,
        userId,
        orderNumber,
        status: 'pending',
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        subtotal,
        shippingCost,
        tax,
        total,
        currency,
        shippingAddressJson: input.shippingAddress as unknown as Record<string, unknown>,
        notes: input.notes,
        channel: 'web',
      })
      .returning();

    if (!createdOrder) return { ok: false, error: 'No se pudo crear el pedido' };

    // Insert order lines
    await db.insert(orderLine).values(
      lines.map((l) => ({
        orderId: createdOrder.id,
        tenantId,
        variantId: l.variantId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        totalPrice: l.unitPrice * l.quantity,
      }))
    );

    // Create payment record (initial pending state before handler runs)
    const [createdPayment] = await db
      .insert(payment)
      .values({
        orderId: createdOrder.id,
        tenantId,
        method: input.paymentMethod,
        status: 'pending',
        amount: total,
        currency,
      })
      .returning();

    if (!createdPayment) return { ok: false, error: 'No se pudo registrar el pago' };

    // Invoke the payment handler to get initial payment status + metadata
    const paymentResult = await handler.createPayment({
      order: createdOrder,
      tenant: currentTenant,
    });

    // Update payment record with handler result
    await db
      .update(payment)
      .set({
        status: paymentResult.status,
        externalId: paymentResult.externalId,
        metadataJson: paymentResult.metadata as Record<string, unknown> | null | undefined,
        updatedAt: new Date(),
      })
      .where(eq(payment.id, createdPayment.id));

    // Clear the cart after successful order creation
    await db.delete(cartLine).where(eq(cartLine.cartId, currentCart.id));
    await db.delete(cart).where(eq(cart.id, currentCart.id));

    // Remove cart cookie
    const cookieStore = await cookies();
    cookieStore.delete(CART_COOKIE);

    revalidatePath('/carrito');
    revalidatePath('/checkout');
    revalidatePath('/admin/pedidos');

    return { ok: true, orderId: createdOrder.id, orderNumber: createdOrder.orderNumber };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { ok: false, error: message };
  }
}

export type AdminActionResult = { ok: true } | { ok: false; error: string };

/** Admin: marks a payment as captured and transitions the order to confirmed. */
export async function markPaymentAsPaid(paymentId: string): Promise<AdminActionResult> {
  try {
    const tenantId = await requireTenantId();
    // Guard: current user must be a member of this tenant
    await requireTenantMembership(tenantId);

    const [p] = await db
      .select()
      .from(payment)
      .where(and(eq(payment.id, paymentId), eq(payment.tenantId, tenantId)))
      .limit(1);

    if (!p) return { ok: false, error: 'Pago no encontrado' };
    if (p.status === 'captured') return { ok: false, error: 'El pago ya fue confirmado' };

    await db
      .update(payment)
      .set({ status: 'captured', updatedAt: new Date() })
      .where(eq(payment.id, paymentId));

    // Transition order to confirmed
    await db
      .update(order)
      .set({ status: 'confirmed', updatedAt: new Date() })
      .where(and(eq(order.id, p.orderId), eq(order.tenantId, tenantId)));

    revalidatePath('/admin/pedidos');
    revalidatePath(`/admin/pedidos/${p.orderId}`);
    return { ok: true };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { ok: false, error: message };
  }
}

/** Admin: cancels an order and its associated payment. */
export async function cancelOrder(orderId: string): Promise<AdminActionResult> {
  try {
    const tenantId = await requireTenantId();
    await requireTenantMembership(tenantId);

    const [o] = await db
      .select()
      .from(order)
      .where(and(eq(order.id, orderId), eq(order.tenantId, tenantId)))
      .limit(1);

    if (!o) return { ok: false, error: 'Pedido no encontrado' };
    if (o.status === 'cancelled') return { ok: false, error: 'El pedido ya está cancelado' };
    if (o.status === 'delivered' || o.status === 'shipped') {
      return { ok: false, error: 'No se puede cancelar un pedido enviado o entregado' };
    }

    await db
      .update(order)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(order.id, orderId), eq(order.tenantId, tenantId)));

    await db
      .update(payment)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(eq(payment.orderId, orderId), eq(payment.tenantId, tenantId)));

    revalidatePath('/admin/pedidos');
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { ok: true };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { ok: false, error: message };
  }
}

/** Returns all orders for the current tenant, optionally filtered by status. */
export async function listOrders(statusFilter?: string): Promise<Order[]> {
  const tenantId = await requireTenantId();
  await requireTenantMembership(tenantId);

  const conditions = [eq(order.tenantId, tenantId)];
  // Apply status filter when provided and valid
  const validStatuses = [
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
    'refunded',
  ] as const;
  type ValidStatus = (typeof validStatuses)[number];

  if (statusFilter && (validStatuses as readonly string[]).includes(statusFilter)) {
    conditions.push(eq(order.status, statusFilter as ValidStatus));
  }

  return db
    .select()
    .from(order)
    .where(and(...conditions))
    .orderBy(desc(order.createdAt));
}

export interface OrderDetail {
  order: Order;
  lines: Array<{
    id: string;
    variantId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    costSnapshot: number | null;
  }>;
  payments: Payment[];
}

/** Returns a single order with lines and payments, scoped to the current tenant. */
export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const tenantId = await requireTenantId();
  await requireTenantMembership(tenantId);

  const [o] = await db
    .select()
    .from(order)
    .where(and(eq(order.id, orderId), eq(order.tenantId, tenantId)))
    .limit(1);

  if (!o) return null;

  const [lines, payments] = await Promise.all([
    db.select().from(orderLine).where(eq(orderLine.orderId, orderId)),
    db.select().from(payment).where(eq(payment.orderId, orderId)),
  ]);

  return { order: o, lines, payments };
}
