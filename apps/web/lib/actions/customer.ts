'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, ilike, or, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { customer, type Customer } from '@frc-e-commerce/db/schema';
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

const searchSchema = z.object({
  query: z.string().trim().min(1).max(100),
  limit: z.number().int().min(1).max(50).default(10),
});

/**
 * Búsqueda de clientes por nombre/documento/teléfono. Usado por autocomplete del POS y admin.
 */
export async function searchCustomers(input: z.infer<typeof searchSchema>): Promise<{
  ok: true;
  results: Customer[];
} | { ok: false; error: string }> {
  try {
    const tenantId = await requireTenantId();
    await requireSessionCapability(tenantId, 'customer.view');
    const parsed = searchSchema.parse(input);
    const q = `%${parsed.query}%`;
    const results = await db
      .select()
      .from(customer)
      .where(
        and(
          eq(customer.tenantId, tenantId),
          or(
            ilike(customer.name, q),
            ilike(customer.document, q),
            ilike(customer.phone, q),
            ilike(customer.email, q)
          )
        )
      )
      .orderBy(desc(customer.updatedAt))
      .limit(parsed.limit);
    return { ok: true, results };
  } catch (e) {
    return { ok: false, error: formatError(e) };
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(200),
  document: z.string().trim().max(50).optional().or(z.literal('')),
  phone: z.string().trim().max(50).optional().or(z.literal('')),
  email: z.string().trim().email().optional().or(z.literal('')),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});

export async function createCustomer(input: z.infer<typeof createSchema>): Promise<
  { ok: true; customerId: string } | { ok: false; error: string }
> {
  try {
    const tenantId = await requireTenantId();
    await requireSessionCapability(tenantId, 'customer.write');
    const parsed = createSchema.parse(input);
    const [created] = await db
      .insert(customer)
      .values({
        tenantId,
        name: parsed.name,
        document: parsed.document || null,
        phone: parsed.phone || null,
        email: parsed.email || null,
        notes: parsed.notes || null,
      })
      .returning({ id: customer.id });
    if (!created) return { ok: false, error: 'No se pudo crear el cliente' };
    revalidatePath('/admin/clientes');
    return { ok: true, customerId: created.id };
  } catch (e) {
    return { ok: false, error: formatError(e) };
  }
}

const updateSchema = createSchema.extend({ id: z.string().uuid() });

export async function updateCustomer(input: z.infer<typeof updateSchema>): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const tenantId = await requireTenantId();
    await requireSessionCapability(tenantId, 'customer.write');
    const parsed = updateSchema.parse(input);
    await db
      .update(customer)
      .set({
        name: parsed.name,
        document: parsed.document || null,
        phone: parsed.phone || null,
        email: parsed.email || null,
        notes: parsed.notes || null,
        updatedAt: new Date(),
      })
      .where(and(eq(customer.id, parsed.id), eq(customer.tenantId, tenantId)));
    revalidatePath('/admin/clientes');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: formatError(e) };
  }
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const tenantId = await requireTenantId();
  await requireSessionCapability(tenantId, 'customer.view');
  const [c] = await db
    .select()
    .from(customer)
    .where(and(eq(customer.id, id), eq(customer.tenantId, tenantId)))
    .limit(1);
  return c ?? null;
}
