'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { posConfig, type PosConfig } from '@frc-e-commerce/db/schema';
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

export async function getPosConfig(): Promise<PosConfig | null> {
  const tenantId = await requireTenantId();
  await requireSessionCapability(tenantId, 'tenant.settings');
  const [c] = await db
    .select()
    .from(posConfig)
    .where(eq(posConfig.tenantId, tenantId))
    .limit(1);
  return c ?? null;
}

const updateSchema = z
  .object({
    enabledCurrencies: z.array(z.string()).min(1),
    pricingDisplayCurrencies: z.array(z.string()),
    paymentMethods: z.array(z.string()).min(1),
    primaryPaymentMethod: z.string().nullable().optional(),
    searchShowImages: z.boolean(),
    showCostToAdmin: z.boolean(),
    strictStock: z.boolean(),
    marginFormula: z.enum(['markup', 'gross']).default('markup'),
    ticketPrefix: z.string().min(1).max(10),
    receiptHeader: z.string().optional(),
    receiptFooter: z.string().optional(),
  })
  .refine(
    (v) => !v.primaryPaymentMethod || v.paymentMethods.includes(v.primaryPaymentMethod),
    { message: 'El método principal debe estar dentro de los métodos aceptados', path: ['primaryPaymentMethod'] }
  );

export async function updatePosConfig(input: z.infer<typeof updateSchema>) {
  try {
    const tenantId = await requireTenantId();
    await requireSessionCapability(tenantId, 'tenant.settings');
    const parsed = updateSchema.parse(input);

    const [existing] = await db
      .select()
      .from(posConfig)
      .where(eq(posConfig.tenantId, tenantId))
      .limit(1);

    const primaryPaymentMethod = parsed.primaryPaymentMethod ?? null;

    if (existing) {
      await db
        .update(posConfig)
        .set({
          enabledCurrencies: parsed.enabledCurrencies,
          pricingDisplayCurrencies: parsed.pricingDisplayCurrencies,
          paymentMethods: parsed.paymentMethods,
          primaryPaymentMethod,
          searchShowImages: parsed.searchShowImages,
          showCostToAdmin: parsed.showCostToAdmin,
          strictStock: parsed.strictStock,
          marginFormula: parsed.marginFormula,
          ticketPrefix: parsed.ticketPrefix,
          receiptHeader: parsed.receiptHeader,
          receiptFooter: parsed.receiptFooter,
          updatedAt: new Date(),
        })
        .where(eq(posConfig.tenantId, tenantId));
    } else {
      await db.insert(posConfig).values({
        tenantId,
        enabledCurrencies: parsed.enabledCurrencies,
        pricingDisplayCurrencies: parsed.pricingDisplayCurrencies,
        paymentMethods: parsed.paymentMethods,
        primaryPaymentMethod,
        searchShowImages: parsed.searchShowImages,
        showCostToAdmin: parsed.showCostToAdmin,
        strictStock: parsed.strictStock,
        marginFormula: parsed.marginFormula,
        ticketPrefix: parsed.ticketPrefix,
        receiptHeader: parsed.receiptHeader,
        receiptFooter: parsed.receiptFooter,
      });
    }

    revalidatePath('/admin/configuracion/pos');
    revalidatePath('/pos');
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: formatError(e) };
  }
}
