import Link from 'next/link';
import { and, count, eq } from 'drizzle-orm';
import { getCurrentTenant } from '@/lib/tenant';
import { db } from '@/lib/db';
import { product, order } from '@frc-e-commerce/db/schema';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default async function AdminDashboard() {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;

  const [{ value: productCount }] = await db
    .select({ value: count() })
    .from(product)
    .where(eq(product.tenantId, tenant.id));

  const [{ value: orderCount }] = await db
    .select({ value: count() })
    .from(order)
    .where(eq(order.tenantId, tenant.id));

  const [{ value: pendingCount }] = await db
    .select({ value: count() })
    .from(order)
    .where(and(eq(order.tenantId, tenant.id), eq(order.status, 'pending')));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-zinc-500">{tenant.name}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500">Productos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{productCount ?? 0}</p>
            <Link href="/admin/productos" className="text-xs text-blue-600 underline">
              Gestionar productos →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500">Pedidos totales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{orderCount ?? 0}</p>
            <Link href="/admin/pedidos" className="text-xs text-blue-600 underline">
              Ver pedidos →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500">Pedidos pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-600">{pendingCount ?? 0}</p>
            <Link href="/admin/pedidos?status=pending" className="text-xs text-blue-600 underline">
              Revisar →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
