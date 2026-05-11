import Link from 'next/link';
import { listPurchaseOrders } from '@/lib/actions/purchase-order';
import { listSuppliers } from '@/lib/actions/supplier';
import { getCurrentTenant } from '@/lib/tenant';
import { requireSession } from '@/lib/auth/guards';
import { ComprasClient } from '@/components/admin/compras/ComprasClient';
import { LocalDraftBanner } from '@/components/admin/compras/LocalDraftBanner';

export const dynamic = 'force-dynamic';

export default async function ComprasPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;
  const session = await requireSession();

  const [pos, suppliers] = await Promise.all([listPurchaseOrders(), listSuppliers()]);
  const hasActiveSuppliers = suppliers.some((s) => s.isActive);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Compras</h1>
          <p className="text-sm text-muted-foreground">
            Órdenes de compra a proveedores. Al recibir, los gastos extras se prorratean según la
            estrategia configurada y se actualiza el costo promedio del inventario.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-muted-foreground hover:underline">
          ← Volver
        </Link>
      </div>

      <LocalDraftBanner scopeKey={`${tenant.id}:${session.user.id}`} />

      <ComprasClient initial={pos} hasActiveSuppliers={hasActiveSuppliers} />
    </div>
  );
}
