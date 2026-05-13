import Link from 'next/link';
import { listPurchaseOrders } from '@/lib/actions/purchase-order';
import { listSuppliers } from '@/lib/actions/supplier';
import { getCurrentTenant } from '@/lib/tenant';
import { requireSession } from '@/lib/auth/guards';
import { ComprasClient } from '@/components/admin/compras/ComprasClient';
import { LocalDraftBanner } from '@/components/admin/compras/LocalDraftBanner';

export const dynamic = 'force-dynamic';

const VALID_STATUS = ['draft', 'placed', 'received', 'partially_received', 'cancelled'] as const;
const VALID_PAGE_SIZES = [25, 50, 100];

type SearchParams = Promise<{
  q?: string;
  status?: string;
  supplier?: string;
  currency?: string;
  page?: string;
  pageSize?: string;
}>;

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;
  const session = await requireSession();

  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const status =
    sp.status && VALID_STATUS.includes(sp.status as (typeof VALID_STATUS)[number])
      ? sp.status
      : 'all';
  const supplierId = sp.supplier && sp.supplier !== 'all' ? sp.supplier : 'all';
  const currencyCode = sp.currency && sp.currency !== 'all' ? sp.currency : 'all';
  const pageSize = VALID_PAGE_SIZES.includes(Number(sp.pageSize))
    ? Number(sp.pageSize)
    : 25;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const [{ rows, total }, suppliers] = await Promise.all([
    listPurchaseOrders({
      q,
      status,
      supplierId,
      currencyCode,
      page,
      pageSize,
    }),
    listSuppliers(),
  ]);
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

      <ComprasClient
        rows={rows}
        total={total}
        suppliers={suppliers}
        hasActiveSuppliers={hasActiveSuppliers}
        filters={{ q, status, supplierId, currencyCode, page, pageSize }}
      />
    </div>
  );
}
