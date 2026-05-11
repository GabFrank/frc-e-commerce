'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  receivePurchaseOrder,
  cancelPurchaseOrder,
  deleteDraftPurchaseOrder,
} from '@/lib/actions/purchase-order';
import type { PurchaseOrder } from '@frc-e-commerce/db/schema';

type POView = PurchaseOrder & { supplierName: string };

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  placed: 'Pedida',
  received: 'Recibida',
  partially_received: 'Parcial',
  cancelled: 'Cancelada',
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  placed: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  received: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
  partially_received: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200',
  cancelled: 'bg-destructive/10 text-destructive',
};

export function ComprasClient({
  initial,
  hasActiveSuppliers,
}: {
  initial: POView[];
  hasActiveSuppliers: boolean;
}) {
  const router = useRouter();

  return (
    <>
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/admin/compras/nueva">
            <Plus className="mr-1 h-4 w-4" /> Nueva orden de compra
          </Link>
        </Button>
      </div>

      {!hasActiveSuppliers && (
        <div className="rounded-md bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
          No hay proveedores cargados todavía. Al crear una PO podés crear el primero inline,
          o gestionar el listado en{' '}
          <a href="/admin/proveedores" className="underline">
            /admin/proveedores
          </a>
          .
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{initial.length} órdenes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {initial.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Sin órdenes todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">PO</th>
                    <th className="px-3 py-2 text-left">Proveedor</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-left">Moneda</th>
                    <th className="px-3 py-2 text-left">Creada</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {initial.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs">{p.poNumber}</td>
                      <td className="px-3 py-2">{p.supplierName}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs ${STATUS_COLOR[p.status] ?? 'bg-muted'}`}
                        >
                          {STATUS_LABEL[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {Number(p.totalInCurrency).toLocaleString('es-PY')}
                      </td>
                      <td className="px-3 py-2 text-xs">{p.currencyCode}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString('es-PY')}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <POActions po={p} onRefresh={() => router.refresh()} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function POActions({ po, onRefresh }: { po: POView; onRefresh: () => void }) {
  const [pending, startTransition] = useTransition();

  const onReceive = () => {
    if (!confirm(`¿Recibir PO ${po.poNumber}? Esto suma stock y actualiza costos.`)) return;
    startTransition(async () => {
      const res = await receivePurchaseOrder({ purchaseOrderId: po.id });
      if (!res.ok) alert(res.error);
      else onRefresh();
    });
  };

  const onCancel = () => {
    if (!confirm(`¿Cancelar PO ${po.poNumber}? Si ya estaba recibida, se revertirá el stock.`)) return;
    startTransition(async () => {
      const res = await cancelPurchaseOrder(po.id);
      if (!res.ok) alert(res.error);
      else onRefresh();
    });
  };

  const onDeleteDraft = () => {
    if (!confirm(`¿Eliminar el borrador ${po.poNumber}? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      const res = await deleteDraftPurchaseOrder(po.id);
      if (!res.ok) alert(res.error);
      else onRefresh();
    });
  };

  return (
    <div className="flex justify-end gap-1">
      {po.status === 'draft' && (
        <>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/admin/compras/nueva?draftId=${po.id}`}>Continuar</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={onDeleteDraft} disabled={pending}>
            Eliminar
          </Button>
        </>
      )}
      {po.status === 'placed' && (
        <Button size="sm" variant="outline" onClick={onReceive} disabled={pending}>
          Recibir
        </Button>
      )}
      {(po.status === 'placed' || po.status === 'received') && (
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      )}
    </div>
  );
}
