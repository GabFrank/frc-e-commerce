'use server';

import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { verifyPassword } from 'better-auth/crypto';
import { db } from '@/lib/db';
import { user, account, tenantMember } from '@frc-e-commerce/db/schema';
import { requireTenantId } from '@/lib/tenant';
import { hasCapability } from '@/lib/auth/permissions';

const validateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  /** La capability que la acción del cashier requiere — el admin override debe tenerla */
  requiredCapability: z.string().min(1),
});

/**
 * Valida credenciales de un user del tenant que tenga la capability requerida.
 * NO crea sesión. Sólo confirma identidad. Usado por el flow "PIN admin"
 * cuando un cashier necesita override (ej: marcar línea como brindis).
 *
 * Retorna { ok: true, userId, name } si valida; { ok: false } si no.
 */
export async function validateAdminCredential(
  input: z.infer<typeof validateSchema>
): Promise<
  | { ok: true; userId: string; name: string }
  | { ok: false; error: string }
> {
  try {
    const tenantId = await requireTenantId();
    const parsed = validateSchema.parse(input);

    // 1. Buscar user por email
    const [u] = await db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.email, parsed.email.toLowerCase().trim()))
      .limit(1);
    if (!u) return { ok: false, error: 'Credenciales inválidas' };

    // 2. Verificar password contra account.password (Better Auth usa scrypt)
    const [acc] = await db
      .select({ password: account.password })
      .from(account)
      .where(and(eq(account.userId, u.id), eq(account.providerId, 'credential')))
      .limit(1);
    if (!acc?.password) return { ok: false, error: 'Credenciales inválidas' };

    const passwordOk = await verifyPassword({ hash: acc.password, password: parsed.password });
    if (!passwordOk) return { ok: false, error: 'Credenciales inválidas' };

    // 3. Verificar membership en este tenant + capability requerida
    const [m] = await db
      .select({ role: tenantMember.role })
      .from(tenantMember)
      .where(and(eq(tenantMember.userId, u.id), eq(tenantMember.tenantId, tenantId)))
      .limit(1);
    if (!m) return { ok: false, error: 'Ese usuario no pertenece a esta tienda' };

    if (!hasCapability(m.role, parsed.requiredCapability as never)) {
      return { ok: false, error: 'Ese usuario no tiene permisos para autorizar esta acción' };
    }

    return { ok: true, userId: u.id, name: u.name };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Error de validación',
    };
  }
}
