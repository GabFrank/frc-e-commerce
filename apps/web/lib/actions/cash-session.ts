'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, sum, asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  cashSession,
  cashSessionBalance,
  cashCountDetail,
  cashMovement,
  cashClosure,
  cashClosureMetric,
  denomination,
  tenantCurrency,
  type CashSession,
  type CashSessionBalance,
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

// ── Lectura ────────────────────────────────────────────────────────────────────

export type ActiveSessionView = {
  session: CashSession;
  balances: CashSessionBalance[];
} | null;

export async function getActiveSessionForCurrentUser(): Promise<ActiveSessionView> {
  const tenantId = await requireTenantId();
  const { userId } = await requireSessionCapability(tenantId, 'pos.sell');
  const [s] = await db
    .select()
    .from(cashSession)
    .where(
      and(
        eq(cashSession.tenantId, tenantId),
        eq(cashSession.cashierId, userId),
        eq(cashSession.status, 'open')
      )
    )
    .limit(1);
  if (!s) return null;
  const balances = await db
    .select()
    .from(cashSessionBalance)
    .where(eq(cashSessionBalance.cashSessionId, s.id));
  return { session: s, balances };
}

// ── Apertura de caja ───────────────────────────────────────────────────────────

const openSchema = z.object({
  balances: z
    .array(
      z.object({
        currencyCode: z.string().min(2).max(10),
        openingDeclared: z.number().int().min(0),
        denominations: z
          .array(
            z.object({
              denominationId: z.string().uuid(),
              qty: z.number().int().min(0),
            })
          )
          .default([]),
      })
    )
    .min(1),
  notes: z.string().optional(),
});

export async function openCashSession(input: z.infer<typeof openSchema>) {
  try {
    const tenantId = await requireTenantId();
    const { userId } = await requireSessionCapability(tenantId, 'cash.open');
    const parsed = openSchema.parse(input);

    // No permitir 2 sesiones abiertas del mismo cashier
    const [existing] = await db
      .select()
      .from(cashSession)
      .where(
        and(
          eq(cashSession.tenantId, tenantId),
          eq(cashSession.cashierId, userId),
          eq(cashSession.status, 'open')
        )
      )
      .limit(1);
    if (existing) {
      return { ok: false as const, error: 'Ya tenés una caja abierta' };
    }

    const sessionId = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(cashSession)
        .values({
          tenantId,
          cashierId: userId,
          status: 'open',
          notes: parsed.notes,
        })
        .returning({ id: cashSession.id });
      if (!created) throw new Error('No se pudo crear la sesión');

      for (const b of parsed.balances) {
        await tx.insert(cashSessionBalance).values({
          cashSessionId: created.id,
          currencyCode: b.currencyCode,
          openingDeclared: b.openingDeclared,
        });
        for (const d of b.denominations) {
          if (d.qty > 0) {
            await tx.insert(cashCountDetail).values({
              cashSessionId: created.id,
              moment: 'open',
              currencyCode: b.currencyCode,
              denominationId: d.denominationId,
              qty: d.qty,
            });
          }
        }
      }
      return created.id;
    });

    revalidatePath('/pos');
    return { ok: true as const, sessionId };
  } catch (e) {
    return { ok: false as const, error: formatError(e) };
  }
}

// ── Cierre de caja ─────────────────────────────────────────────────────────────

const closeSchema = z.object({
  cashSessionId: z.string().uuid(),
  balances: z.array(
    z.object({
      currencyCode: z.string(),
      countedDeclared: z.number().int().min(0),
      denominations: z
        .array(z.object({ denominationId: z.string().uuid(), qty: z.number().int().min(0) }))
        .default([]),
    })
  ),
  notes: z.string().optional(),
});

export async function closeCashSession(input: z.infer<typeof closeSchema>) {
  try {
    const tenantId = await requireTenantId();
    const { userId } = await requireSessionCapability(tenantId, 'cash.close');
    const parsed = closeSchema.parse(input);

    // Validar que la sesión es del cashier actual y está abierta
    const [s] = await db
      .select()
      .from(cashSession)
      .where(
        and(
          eq(cashSession.id, parsed.cashSessionId),
          eq(cashSession.tenantId, tenantId),
          eq(cashSession.cashierId, userId),
          eq(cashSession.status, 'open')
        )
      )
      .limit(1);
    if (!s) {
      return { ok: false as const, error: 'Sesión no encontrada o ya cerrada' };
    }

    const closureId = await db.transaction(async (tx) => {
      // Para cada balance: calcular expected y diff
      for (const b of parsed.balances) {
        const [existingBalance] = await tx
          .select({ id: cashSessionBalance.id, opening: cashSessionBalance.openingDeclared })
          .from(cashSessionBalance)
          .where(
            and(
              eq(cashSessionBalance.cashSessionId, s.id),
              eq(cashSessionBalance.currencyCode, b.currencyCode)
            )
          )
          .limit(1);
        // Si la caja no abrió con esta moneda pero ahora hay que contar
        // (porque hubo movimientos o el cajero la incluye), creamos balance
        // con apertura 0 para que el cierre quede registrado.
        if (!existingBalance) {
          await tx.insert(cashSessionBalance).values({
            cashSessionId: s.id,
            currencyCode: b.currencyCode,
            openingDeclared: 0,
          });
        }
        const opening = existingBalance?.opening ?? 0;

        // Sum cash_movement de esta moneda y método=efectivo
        // Para MVP: el saldo expected es opening + sum sale_in - sum sale_return_out - sum sale_cancel_out
        //           + manual_in - manual_out (todos en payment_method='efectivo' por moneda)
        const movements = await tx
          .select({
            kind: cashMovement.kind,
            amount: cashMovement.amount,
          })
          .from(cashMovement)
          .where(
            and(
              eq(cashMovement.cashSessionId, s.id),
              eq(cashMovement.currencyCode, b.currencyCode),
              eq(cashMovement.paymentMethod, 'efectivo')
            )
          );
        let net = 0;
        for (const m of movements) {
          const amt = Number(m.amount);
          if (m.kind === 'sale_in' || m.kind === 'manual_in') net += amt;
          else if (
            m.kind === 'sale_return_out' ||
            m.kind === 'sale_cancel_out' ||
            m.kind === 'manual_out'
          )
            net -= amt;
        }
        const expected = Number(opening) + net;
        const diff = b.countedDeclared - expected;

        await tx
          .update(cashSessionBalance)
          .set({
            countedDeclared: b.countedDeclared,
            expected,
            diff,
          })
          .where(
            and(
              eq(cashSessionBalance.cashSessionId, s.id),
              eq(cashSessionBalance.currencyCode, b.currencyCode)
            )
          );

        // Persist count detail por denominación
        for (const d of b.denominations) {
          if (d.qty > 0) {
            await tx.insert(cashCountDetail).values({
              cashSessionId: s.id,
              moment: 'close',
              currencyCode: b.currencyCode,
              denominationId: d.denominationId,
              qty: d.qty,
            });
          }
        }
      }

      // Marcar sesión como cerrada
      await tx
        .update(cashSession)
        .set({
          status: 'closed',
          closedAt: new Date(),
          notes: parsed.notes ?? s.notes,
        })
        .where(eq(cashSession.id, s.id));

      // Crear cash_closure header con métricas básicas
      const allMovements = await tx
        .select({
          kind: cashMovement.kind,
          paymentMethod: cashMovement.paymentMethod,
          currencyCode: cashMovement.currencyCode,
          amountInPrimary: cashMovement.amountInPrimary,
        })
        .from(cashMovement)
        .where(eq(cashMovement.cashSessionId, s.id));

      let totalSales = 0;
      let totalReturns = 0;
      let totalCancels = 0;
      let txCount = 0;
      const byMethodCurrency = new Map<string, number>();
      for (const m of allMovements) {
        const amt = Number(m.amountInPrimary);
        if (m.kind === 'sale_in') {
          totalSales += amt;
          txCount += 1;
          const k = `sales|${m.paymentMethod}|${m.currencyCode}`;
          byMethodCurrency.set(k, (byMethodCurrency.get(k) ?? 0) + amt);
        } else if (m.kind === 'sale_return_out') {
          totalReturns += amt;
        } else if (m.kind === 'sale_cancel_out') {
          totalCancels += amt;
        }
      }
      const avgTicket = txCount > 0 ? Math.round(totalSales / txCount) : 0;

      const [closure] = await tx
        .insert(cashClosure)
        .values({
          cashSessionId: s.id,
          totalTransactions: txCount,
          avgTicketInPrimary: avgTicket,
          totalSalesInPrimary: totalSales,
          totalReturnsInPrimary: totalReturns,
          totalCancellationsInPrimary: totalCancels,
        })
        .returning({ id: cashClosure.id });
      if (!closure) throw new Error('No se pudo crear closure');

      // Insertar metric rows: 1 por método+moneda con totales de sales
      for (const [k, v] of byMethodCurrency.entries()) {
        const [metric, paymentMethod, currencyCode] = k.split('|');
        await tx.insert(cashClosureMetric).values({
          cashClosureId: closure.id,
          metric: metric ?? 'unknown',
          paymentMethod: paymentMethod ?? null,
          currencyCode: currencyCode ?? null,
          valueNumeric: v,
        });
      }
      // Métrica adicional: avg_ticket y tx_count
      await tx.insert(cashClosureMetric).values({
        cashClosureId: closure.id,
        metric: 'tx_count',
        valueNumeric: txCount,
      });
      await tx.insert(cashClosureMetric).values({
        cashClosureId: closure.id,
        metric: 'avg_ticket',
        valueNumeric: avgTicket,
      });

      return closure.id;
    });

    revalidatePath('/pos');
    return { ok: true as const, closureId };
  } catch (e) {
    return { ok: false as const, error: formatError(e) };
  }
}

// ── Helper: leer denominaciones activas para una moneda ────────────────────────

export async function getDenominationsForCurrency(currencyCode: string) {
  const tenantId = await requireTenantId();
  await requireSessionCapability(tenantId, 'pos.sell');
  return db
    .select()
    .from(denomination)
    .where(and(eq(denomination.currencyCode, currencyCode), eq(denomination.isActive, true)))
    .orderBy(asc(denomination.position));
}

// ── Lectura: cierre completo para resumen post-close ───────────────────────────

export async function getClosureSummary(closureId: string) {
  const tenantId = await requireTenantId();
  await requireSessionCapability(tenantId, 'cash.close');
  const [header] = await db
    .select()
    .from(cashClosure)
    .where(eq(cashClosure.id, closureId))
    .limit(1);
  if (!header) return null;
  const metrics = await db
    .select()
    .from(cashClosureMetric)
    .where(eq(cashClosureMetric.cashClosureId, closureId));
  const balances = await db
    .select()
    .from(cashSessionBalance)
    .where(eq(cashSessionBalance.cashSessionId, header.cashSessionId));
  return { header, metrics, balances };
}
