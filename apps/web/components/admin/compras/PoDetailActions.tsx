'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  receivePurchaseOrder,
  cancelPurchaseOrder,
  deleteDraftPurchaseOrder,
} from '@/lib/actions/purchase-order';

type Props = {
  poId: string;
  poNumber: string;
  status: string;
};

export function PoDetailActions({ poId, poNumber, status }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onReceive = () => {
    if (!confirm(`¿Recibir PO ${poNumber}? Esto suma stock y actualiza costos promedio.`)) return;
    startTransition(async () => {
      const res = await receivePurchaseOrder({ purchaseOrderId: poId });
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  };

  const onCancel = () => {
    if (
      !confirm(
        `¿Cancelar PO ${poNumber}? Si ya estaba recibida, se revierte el stock y se ajusta avg_cost.`
      )
    )
      return;
    startTransition(async () => {
      const res = await cancelPurchaseOrder(poId);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  };

  const onDeleteDraft = () => {
    if (!confirm(`¿Eliminar el borrador ${poNumber}? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      const res = await deleteDraftPurchaseOrder(poId);
      if (!res.ok) alert(res.error);
      else router.push('/admin/compras');
    });
  };

  return (
    <div className="flex flex-wrap gap-2 border-t pt-4">
      <span className="text-xs text-muted-foreground self-center mr-1">Acciones:</span>
      {status === 'draft' && (
        <>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/admin/compras/nueva?draftId=${poId}`}>Continuar editando</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={onDeleteDraft} disabled={pending}>
            Eliminar borrador
          </Button>
        </>
      )}
      {status === 'placed' && (
        <Button size="sm" onClick={onReceive} disabled={pending}>
          {pending ? 'Procesando…' : 'Recibir'}
        </Button>
      )}
      {(status === 'placed' || status === 'received' || status === 'partially_received') && (
        <Button size="sm" variant="destructive" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      )}
    </div>
  );
}
