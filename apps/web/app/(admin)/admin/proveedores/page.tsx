import Link from 'next/link';
import { listSuppliers } from '@/lib/actions/supplier';
import { ProveedoresClient } from '@/components/admin/proveedores/ProveedoresClient';

export const dynamic = 'force-dynamic';

export default async function ProveedoresPage() {
  const suppliers = await listSuppliers();
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Proveedores</h1>
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
