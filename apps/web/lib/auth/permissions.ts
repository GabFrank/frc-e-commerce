import type { TenantMemberRole } from '@frc-e-commerce/db/schema';
import { getMembership, requireSession } from './guards';

export type Capability =
  // Productos / catálogo
  | 'product.view'
  | 'product.write'
  | 'product.delete'
  | 'category.write'
  // Customer
  | 'customer.view'
  | 'customer.write'
  // POS
  | 'pos.sell'
  | 'pos.discount.line'
  | 'pos.discount.general'
  | 'pos.see_cost'
  | 'pos.change_currency'
  | 'pos.mark_complimentary'
  // Caja
  | 'cash.open'
  | 'cash.close'
  | 'cash.adjust'
  // Pedidos
  | 'order.view'
  | 'order.cancel'
  | 'order.return'
  // Compras
  | 'purchase.view'
  | 'purchase.write'
  | 'purchase.receive'
  | 'purchase.return'
  | 'supplier.write'
  // Monedas
  | 'currency.view'
  | 'currency.set_rate'
  | 'currency.config'
  // Reportes
  | 'reports.financial'
  | 'reports.operational'
  // Tenant settings
  | 'tenant.settings'
  | 'tenant.members'
  // Admin override (validar credencial admin para autorizar acciones de cashier)
  | 'admin.override';

const ALL_CAPS: Capability[] = [
  'product.view', 'product.write', 'product.delete', 'category.write',
  'customer.view', 'customer.write',
  'pos.sell', 'pos.discount.line', 'pos.discount.general', 'pos.see_cost',
  'pos.change_currency', 'pos.mark_complimentary',
  'cash.open', 'cash.close', 'cash.adjust',
  'order.view', 'order.cancel', 'order.return',
  'purchase.view', 'purchase.write', 'purchase.receive', 'purchase.return', 'supplier.write',
  'currency.view', 'currency.set_rate', 'currency.config',
  'reports.financial', 'reports.operational',
  'tenant.settings', 'tenant.members',
  'admin.override',
];

const ROLE_CAPS: Record<TenantMemberRole, ReadonlySet<Capability>> = {
  owner: new Set(ALL_CAPS),
  admin: new Set(ALL_CAPS),
  manager: new Set<Capability>([
    'product.view', 'product.write', 'category.write',
    'customer.view', 'customer.write',
    'pos.sell', 'pos.discount.line', 'pos.discount.general', 'pos.see_cost',
    'pos.change_currency', 'pos.mark_complimentary',
    'cash.open', 'cash.close', 'cash.adjust',
    'order.view', 'order.cancel', 'order.return',
    'purchase.view', 'purchase.write', 'purchase.receive', 'purchase.return', 'supplier.write',
    'currency.view', 'currency.set_rate',
    'reports.financial', 'reports.operational',
    'admin.override',
  ]),
  cashier: new Set<Capability>([
    'product.view',
    'customer.view', 'customer.write',
    'pos.sell', 'pos.discount.line', 'pos.discount.general',
    'cash.open', 'cash.close',
    'order.view',
    'currency.view',
  ]),
  viewer: new Set<Capability>([
    'product.view',
    'customer.view',
    'order.view',
    'currency.view',
    'reports.operational',
  ]),
};

export function hasCapability(role: TenantMemberRole, cap: Capability): boolean {
  return ROLE_CAPS[role]?.has(cap) ?? false;
}

export function capabilitiesForRole(role: TenantMemberRole): Capability[] {
  return Array.from(ROLE_CAPS[role] ?? []);
}

export class CapabilityDeniedError extends Error {
  constructor(public readonly capability: Capability, public readonly role: TenantMemberRole | null) {
    super(`Capability "${capability}" denegada para rol "${role ?? 'none'}"`);
    this.name = 'CapabilityDeniedError';
  }
}

/**
 * Verifica que el user tenga la capability en el tenant; throws si no.
 * Usar al inicio de cada server action que requiera permisos específicos.
 */
export async function requireCapability(
  userId: string,
  tenantId: string,
  cap: Capability
): Promise<{ role: TenantMemberRole }> {
  const m = await getMembership(userId, tenantId);
  if (!m) throw new CapabilityDeniedError(cap, null);
  if (!hasCapability(m.role, cap)) throw new CapabilityDeniedError(cap, m.role);
  return { role: m.role };
}

/**
 * Combo session + capability: valida sesión y permiso en un paso.
 * Devuelve session, membership.role, y userId para reutilizar.
 */
export async function requireSessionCapability(tenantId: string, cap: Capability) {
  const session = await requireSession();
  const { role } = await requireCapability(session.user.id, tenantId, cap);
  return { session, userId: session.user.id, role };
}
