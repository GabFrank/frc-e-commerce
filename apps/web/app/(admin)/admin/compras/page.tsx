import Link from 'next/link';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tenantCurrency, currency } from '@frc-e-commerce/db/schema';
import { getCurrentTenant } from '@/lib/tenant';
import { listPurchaseOrders } from '@/lib/actions/purchase-order';
import { listSuppliers } from '@/lib/actions/supplier';
import { ComprasClient } from '@/components/admin/compras/ComprasClient';

export const dynamic = 'force-dynamic';

export default async function ComprasPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;

  const [pos, suppliers, currencies] = await Promise.all([
    listPurchaseOrders(),
    listSuppliers(),
    db
      .select({ code: tenantCurrency.currencyCode, symbol: currency.symbol, name: currency.name })
      .from(tenantCurrency)
      .innerJoin(currency, eq(currency.code, tenantCurrency.currencyCode))
      .where(and(eq(tenantCurrency.tenantId, tenant.id), eq(tenantCurrency.isActive, true))),
  ]);

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

      <ComprasClient
        initial={pos}
        suppliers={suppliers.filter((s) => s.isActive)}
        currencies={currencies}
      />
    </div>
  );
}
