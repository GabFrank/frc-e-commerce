'use server';

import { revalidatePath } from 'next/cache';
import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  currency,
  tenantCurrency,
  exchangeRate,
  type Currency,
  type TenantCurrency,
} from '@frc-e-commerce/db/schema';
import { requireTenantId } from '@/lib/tenant';
import {
  CapabilityDeniedError,
  requireSessionCapability,
} from '@/lib/auth/permissions';

export type ActionError = { ok: false; error: string };
export type ActionOk<T = void> = T extends void ? { ok: true } : { ok: true } & T;

function formatError(e: unknown): string {
  if (e instanceof CapabilityDeniedError) return 'No tenés permiso para esta acción';
  if (e instanceof Error) return e.message;
  return 'Error desconocido';
}

// ── Lectura ────────────────────────────────────────────────────────────────────

export type TenantCurrencyView = {
  tenantCurrencyId: string;
  currency: Currency;
  isPrimary: boolean;
  isActive: boolean;
  position: number;
  /** Cotización actual (la fila más reciente para esta moneda en este tenant). null si no hay rate configurado o si es la primary. */
  currentRate: { id: string; buyRate: string; sellRate: string; effectiveFrom: Date } | null;
};

/**
 * Devuelve todas las monedas master + estado para el tenant actual (configurada o no).
 * Incluye cotización vigente para las que ya están configuradas como secundarias.
 */
export async function listTenantCurrenciesView(): Promise<TenantCurrencyView[]> {
  const tenantId = await requireTenantId();
  await requireSessionCapability(tenantId, 'currency.view');

  const allCurrencies = await db
    .select()
    .from(currency)
    .where(eq(currency.isActive, true))
    .orderBy(asc(currency.code));

  const configured = await db
    .select()
    .from(tenantCurrency)
    .where(eq(tenantCurrency.tenantId, tenantId));

  const cfgByCode = new Map<string, TenantCurrency>();
  for (const c of configured) cfgByCode.set(c.currencyCode, c);

  // Última cotización vigente por moneda secundaria
  const ratesByCurrency = new Map<
    string,
    { id: string; buyRate: string; sellRate: string; effectiveFrom: Date }
  >();
  const allRates = await db
    .select({
      id: exchangeRate.id,
      currencyCode: exchangeRate.currencyCode,
      buyRate: exchangeRate.buyRate,
      sellRate: exchangeRate.sellRate,
      effectiveFrom: exchangeRate.effectiveFrom,
    })
    .from(exchangeRate)
    .where(eq(exchangeRate.tenantId, tenantId))
    .orderBy(desc(exchangeRate.effectiveFrom));
  for (const r of allRates) {
    if (!ratesByCurrency.has(r.currencyCode)) {
      ratesByCurrency.set(r.currencyCode, {
        id: r.id,
        buyRate: r.buyRate,
        sellRate: r.sellRate,
        effectiveFrom: r.effectiveFrom,
      });
    }
  }

  return allCurrencies.map<TenantCurrencyView>((c) => {
    const cfg = cfgByCode.get(c.code);
    return {
      tenantCurrencyId: cfg?.id ?? '',
      currency: c,
      isPrimary: cfg?.isPrimary ?? false,
      isActive: cfg?.isActive ?? false,
      position: cfg?.position ?? 999,
      currentRate: cfg && !cfg.isPrimary ? ratesByCurrency.get(c.code) ?? null : null,
    };
  });
}

// ── Mutaciones ─────────────────────────────────────────────────────────────────

const toggleSchema = z.object({
  currencyCode: z.string().min(2).max(10),
  isActive: z.boolean(),
});

export async function toggleTenantCurrency(input: z.infer<typeof toggleSchema>) {
  try {
    const tenantId = await requireTenantId();
    await requireSessionCapability(tenantId, 'currency.config');
    const parsed = toggleSchema.parse(input);

    const [existing] = await db
      .select()
      .from(tenantCurrency)
      .where(
        and(
          eq(tenantCurrency.tenantId, tenantId),
          eq(tenantCurrency.currencyCode, parsed.currencyCode)
        )
      )
      .limit(1);

    if (existing) {
      // No permitir desactivar la primary
      if (existing.isPrimary && !parsed.isActive) {
        return { ok: false as const, error: 'No se puede desactivar la moneda principal' };
      }
      await db
        .update(tenantCurrency)
        .set({ isActive: parsed.isActive, updatedAt: new Date() })
        .where(eq(tenantCurrency.id, existing.id));
    } else {
      // Inserta nueva fila como activa, no primary, position al final
      const [maxPos] = await db
        .select({ position: tenantCurrency.position })
        .from(tenantCurrency)
        .where(eq(tenantCurrency.tenantId, tenantId))
        .orderBy(desc(tenantCurrency.position))
        .limit(1);
      await db.insert(tenantCurrency).values({
        tenantId,
        currencyCode: parsed.currencyCode,
        isActive: parsed.isActive,
        isPrimary: false,
        position: (maxPos?.position ?? 0) + 1,
      });
    }

    revalidatePath('/admin/configuracion/monedas');
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: formatError(e) };
  }
}

const setPrimarySchema = z.object({
  currencyCode: z.string().min(2).max(10),
});

export async function setPrimaryCurrency(input: z.infer<typeof setPrimarySchema>) {
  try {
    const tenantId = await requireTenantId();
    await requireSessionCapability(tenantId, 'currency.config');
    const parsed = setPrimarySchema.parse(input);

    // La moneda debe estar configurada y activa
    const [target] = await db
      .select()
      .from(tenantCurrency)
      .where(
        and(
          eq(tenantCurrency.tenantId, tenantId),
          eq(tenantCurrency.currencyCode, parsed.currencyCode)
        )
      )
      .limit(1);
    if (!target) {
      return { ok: false as const, error: 'La moneda no está configurada para este tenant' };
    }
    if (!target.isActive) {
      return { ok: false as const, error: 'Activá la moneda antes de marcarla como principal' };
    }

    await db.transaction(async (tx) => {
      await tx
        .update(tenantCurrency)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(tenantCurrency.tenantId, tenantId));
      await tx
        .update(tenantCurrency)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(tenantCurrency.id, target.id));
    });

    revalidatePath('/admin/configuracion/monedas');
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: formatError(e) };
  }
}

const setRateSchema = z.object({
  currencyCode: z.string().min(2).max(10),
  buyRate: z.string().min(1),
  sellRate: z.string().min(1),
  note: z.string().optional(),
});

/**
 * Inserta una nueva fila en exchange_rate (versionado: el rate "vigente" es el más reciente).
 */
export async function setExchangeRate(input: z.infer<typeof setRateSchema>) {
  try {
    const tenantId = await requireTenantId();
    const { userId } = await requireSessionCapability(tenantId, 'currency.set_rate');
    const parsed = setRateSchema.parse(input);

    // Validar que la moneda esté configurada y NO sea primary
    const [tc] = await db
      .select()
      .from(tenantCurrency)
      .where(
        and(
          eq(tenantCurrency.tenantId, tenantId),
          eq(tenantCurrency.currencyCode, parsed.currencyCode)
        )
      )
      .limit(1);
    if (!tc) {
      return { ok: false as const, error: 'La moneda no está configurada' };
    }
    if (tc.isPrimary) {
      return { ok: false as const, error: 'La moneda principal no necesita cotización (siempre 1.0)' };
    }

    const buy = Number(parsed.buyRate);
    const sell = Number(parsed.sellRate);
    if (!Number.isFinite(buy) || buy <= 0) {
      return { ok: false as const, error: 'buyRate inválido' };
    }
    if (!Number.isFinite(sell) || sell <= 0) {
      return { ok: false as const, error: 'sellRate inválido' };
    }

    await db.insert(exchangeRate).values({
      tenantId,
      currencyCode: parsed.currencyCode,
      buyRate: parsed.buyRate,
      sellRate: parsed.sellRate,
      setBy: userId,
      note: parsed.note,
    });

    revalidatePath('/admin/configuracion/monedas');
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: formatError(e) };
  }
}
