import Link from 'next/link';
import { db } from '@/lib/db';
import { tenant } from '@frc-e-commerce/db/schema';
import { desc } from 'drizzle-orm';
import { Button } from '@/components/ui/button';

export default async function TenantsListPage() {
  const tenants = await db.select().from(tenant).orderBy(desc(tenant.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">Tiendas</h1>
        <Link href="/super/tenants/new">
          <Button>+ Nueva tienda</Button>
        </Link>
      </div>

      {tenants.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay tiendas. Creá la primera.</p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Slug</th>
                  <th className="p-3">Plan</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Creada</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-t hover:bg-muted/50">
                    <td className="p-3 font-medium">
                      <Link href={`/super/tenants/${t.id}`} className="hover:underline">
                        {t.name}
                      </Link>
                    </td>
                    <td className="p-3 font-mono text-xs">{t.slug}</td>
                    <td className="p-3 capitalize">{t.plan}</td>
                    <td className="p-3 capitalize">{t.status}</td>
                    <td className="p-3 text-muted-foreground">{new Date(t.createdAt).toLocaleDateString('es-PY')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
