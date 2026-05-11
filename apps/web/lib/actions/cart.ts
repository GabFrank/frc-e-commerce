'use server';
import { isRedirectError } from '@/lib/actions/_redirect-helper';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { cart, cartLine, productVariant, product, type Cart, type CartLine } from '@frc-e-commerce/db/schema';
import { requireTenantId } from '@/lib/tenant';
import { getSession } from '@/lib/auth/guards';

const CART_COOKIE = 'cart_id';
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Reads or creates the cart for the current user/session. Sets httpOnly cookie. */
export async function getOrCreateCart(): Promise<Cart> {
  const tenantId = await requireTenantId();
  const session = await getSession();
  const userId = session?.user.id ?? null;

  const cookieStore = await cookies();
  const cartIdFromCookie = cookieStore.get(CART_COOKIE)?.value ?? null;

  // Try to find existing cart (prefer user-based lookup when authenticated)
  let existing: Cart | null = null;

  if (userId) {
    const [userCart] = await db
      .select()
      .from(cart)
      .where(and(eq(cart.tenantId, tenantId), eq(cart.userId, userId)))
      .limit(1);
    existing = userCart ?? null;
  }

  if (!existing && cartIdFromCookie) {
    const [cookieCart] = await db
      .select()
      .from(cart)
      .where(and(eq(cart.tenantId, tenantId), eq(cart.id, cartIdFromCookie)))
      .limit(1);
    existing = cookieCart ?? null;
  }

  if (existing) {
    // Refresh cookie so it doesn't expire while customer is actively shopping
    cookieStore.set(CART_COOKIE, existing.id, {
      httpOnly: true,
      path: '/',
      maxAge: CART_COOKIE_MAX_AGE,
      sameSite: 'lax',
    });
    return existing;
  }

  // No existing cart — create a new one
  const sessionId = cartIdFromCookie ?? crypto.randomUUID();
  const [created] = await db
    .insert(cart)
    .values({
      tenantId,
      userId,
      sessionId,
      expiresAt: new Date(Date.now() + CART_COOKIE_MAX_AGE * 1000),
    })
    .returning();

  if (!created) throw new Error('No se pudo crear el carrito');

  cookieStore.set(CART_COOKIE, created.id, {
    httpOnly: true,
    path: '/',
    maxAge: CART_COOKIE_MAX_AGE,
    sameSite: 'lax',
  });

  return created;
}

export type AddToCartResult = { ok: true } | { ok: false; error: string };

/** Adds a variant to the cart, or increments quantity if already present. */
export async function addToCart(
  variantId: string,
  quantity: number,
  unitPrice: number
): Promise<AddToCartResult> {
  if (quantity <= 0) return { ok: false, error: 'La cantidad debe ser mayor a 0' };

  try {
    const tenantId = await requireTenantId();

    // Rechazo temprano si la variante no existe, no es del tenant, o fue archivada.
    const [vCheck] = await db
      .select({ active: productVariant.active })
      .from(productVariant)
      .where(and(eq(productVariant.id, variantId), eq(productVariant.tenantId, tenantId)))
      .limit(1);
    if (!vCheck) return { ok: false, error: 'Variante no encontrada' };
    if (!vCheck.active) return { ok: false, error: 'Esta variante ya no está disponible' };

    const currentCart = await getOrCreateCart();

    // Check if this variant is already in the cart
    const [existingLine] = await db
      .select()
      .from(cartLine)
      .where(and(eq(cartLine.cartId, currentCart.id), eq(cartLine.variantId, variantId)))
      .limit(1);

    if (existingLine) {
      await db
        .update(cartLine)
        .set({ quantity: existingLine.quantity + quantity })
        .where(eq(cartLine.id, existingLine.id));
    } else {
      // Snapshot denormalizado para que el carrito muestre datos consistentes
      const [vDetail] = await db
        .select({
          color: productVariant.color,
          size: productVariant.size,
          sizeKind: productVariant.sizeKind,
          sku: productVariant.sku,
          variantName: productVariant.name,
          productName: product.name,
        })
        .from(productVariant)
        .innerJoin(product, eq(product.id, productVariant.productId))
        .where(eq(productVariant.id, variantId))
        .limit(1);

      await db.insert(cartLine).values({
        cartId: currentCart.id,
        variantId,
        quantity,
        unitPrice,
        variantSnapshot: vDetail
          ? {
              color: vDetail.color,
              size: vDetail.size,
              sizeKind: vDetail.sizeKind,
              sku: vDetail.sku,
              productName: vDetail.productName,
              variantName: vDetail.variantName,
            }
          : null,
      });
    }

    revalidatePath('/carrito');
    revalidatePath('/checkout');
    return { ok: true };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { ok: false, error: message };
  }
}

export type UpdateCartLineResult = { ok: true } | { ok: false; error: string };

/** Updates quantity of a cart line. If quantity is 0, removes the line. */
export async function updateCartLine(
  lineId: string,
  quantity: number
): Promise<UpdateCartLineResult> {
  try {
    const tenantId = await requireTenantId();

    // Security: ensure the line belongs to a cart owned by the current tenant
    const [line] = await db
      .select({ id: cartLine.id, cartId: cartLine.cartId })
      .from(cartLine)
      .innerJoin(cart, eq(cartLine.cartId, cart.id))
      .where(and(eq(cartLine.id, lineId), eq(cart.tenantId, tenantId)))
      .limit(1);

    if (!line) return { ok: false, error: 'Línea de carrito no encontrada' };

    if (quantity <= 0) {
      await db.delete(cartLine).where(eq(cartLine.id, lineId));
    } else {
      await db.update(cartLine).set({ quantity }).where(eq(cartLine.id, lineId));
    }

    revalidatePath('/carrito');
    revalidatePath('/checkout');
    return { ok: true };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { ok: false, error: message };
  }
}

export type RemoveCartLineResult = { ok: true } | { ok: false; error: string };

/** Removes a line from the cart entirely. */
export async function removeCartLine(lineId: string): Promise<RemoveCartLineResult> {
  try {
    const tenantId = await requireTenantId();

    // Security: ensure the line belongs to a cart owned by the current tenant
    const [line] = await db
      .select({ id: cartLine.id })
      .from(cartLine)
      .innerJoin(cart, eq(cartLine.cartId, cart.id))
      .where(and(eq(cartLine.id, lineId), eq(cart.tenantId, tenantId)))
      .limit(1);

    if (!line) return { ok: false, error: 'Línea de carrito no encontrada' };

    await db.delete(cartLine).where(eq(cartLine.id, lineId));

    revalidatePath('/carrito');
    revalidatePath('/checkout');
    return { ok: true };
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return { ok: false, error: message };
  }
}

/** Returns the full cart with its lines for rendering. */
export async function getCartWithLines(): Promise<{ cart: Cart; lines: CartLine[] } | null> {
  try {
    const currentCart = await getOrCreateCart();
    const lines = await db
      .select()
      .from(cartLine)
      .where(eq(cartLine.cartId, currentCart.id));
    return { cart: currentCart, lines };
  } catch {
    return null;
  }
}
