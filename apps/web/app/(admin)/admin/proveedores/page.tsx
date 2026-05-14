import Link from 'next/link';
import { listSuppliers } from '@/lib/actions/supplier';
import { ProveedoresClient } from '@/components/admin/proveedores/ProveedoresClient';

export const dynamic = 'force-dynamic';

export default async function ProveedoresPage() {
  const suppliers = await listSuppliers();
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold sm:text-2xl">Proveedores</h1>
          <p className="text-sm text-muted-foreground">
            Quienes te venden mercadería. Usados al crear órdenes de compra.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-muted-foreground hover:underline">
          ← Volver
        </Link>
      </div>
      <ProveedoresClient initial={suppliers} />
    </div>
  );
}
