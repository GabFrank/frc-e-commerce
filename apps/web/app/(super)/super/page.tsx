import Link from 'next/link';
import { db } from '@/lib/db';
import { tenant } from '@frc-e-commerce/db/schema';
import { count } from 'drizzle-orm';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default async function SuperHome() {
  const [{ value: tenantCount }] = await db.select({ value: count() }).from(tenant);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Tiendas activas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{tenantCount ?? 0}</p>
            <Link href="/super/tenants" className="text-xs text-primary underline">
              Ver todas
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
