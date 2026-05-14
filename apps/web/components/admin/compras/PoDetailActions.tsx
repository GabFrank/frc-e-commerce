'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
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
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();

  const onReceive = async () => {
    const ok = await confirm({
      title: `Recibir PO ${poNumber}`,
      description: 'Esto suma stock y actualiza costos promedio.',
      confirmLabel: 'Recibir',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await receivePurchaseOrder({ purchaseOrderId: poId });
      if (!res.ok) await confirm({ mode: 'alert', title: 'Error', description: res.error });
      else router.refresh();
    });
  };

  const onCancel = async () => {
    const ok = await confirm({
      title: `Cancelar PO ${poNumber}`,
      description: 'Si ya estaba recibida, se revierte el stock y se ajusta avg_cost.',
      confirmLabel: 'Cancelar PO',
      variant: 'destructive',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await cancelPurchaseOrder(poId);
      if (!res.ok) await confirm({ mode: 'alert', title: 'Error', description: res.error });
      else router.refresh();
    });
  };

  const onDeleteDraft = async () => {
    const ok = await confirm({
      title: `Eliminar borrador ${poNumber}`,
      description: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteDraftPurchaseOrder(poId);
      if (!res.ok) await confirm({ mode: 'alert', title: 'Error', description: res.error });
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
