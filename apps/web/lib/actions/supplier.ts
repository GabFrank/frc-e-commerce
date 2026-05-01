'use server';

import { revalidatePath } from 'next/cache';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { supplier, type Supplier } from '@frc-e-commerce/db/schema';
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

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(200),
  document: z.string().trim().max(50).optional().or(z.literal('')),
  contactName: z.string().trim().max(200).optional().or(z.literal('')),
  phone: z.string().trim().max(50).optional().or(z.literal('')),
  email: z.string().trim().email().optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  isActive: z.boolean().default(true),
});

export async function listSuppliers(): Promise<Supplier[]> {
  const tenantId = await requireTenantId();
  await requireSessionCapability(tenantId, 'purchase.view');
  return db
    .select()
    .from(supplier)
    .where(eq(supplier.tenantId, tenantId))
    .orderBy(desc(supplier.updatedAt));
}

export async function upsertSupplier(input: z.infer<typeof upsertSchema>) {
  try {
    const tenantId = await requireTenantId();
    await requireSessionCapability(tenantId, 'supplier.write');
    const parsed = upsertSchema.parse(input);
    const values = {
      tenantId,
      name: parsed.name,
      document: parsed.document || null,
      contactName: parsed.contactName || null,
      phone: parsed.phone || null,
      email: parsed.email || null,
      notes: parsed.notes || null,
      isActive: parsed.isActive,
      updatedAt: new Date(),
    };
    if (parsed.id) {
      await db
        .update(supplier)
        .set(values)
        .where(and(eq(supplier.id, parsed.id), eq(supplier.tenantId, tenantId)));
    } else {
      await db.insert(supplier).values(values);
    }
    revalidatePath('/admin/proveedores');
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: formatError(e) };
  }
}
