'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cancelPosOrder, registerSaleReturn } from '@/lib/actions/order-return';

type LineForReturn = {
  id: string;
  variantId: string;
  variantSku?: string | null;
  variantName?: string | null;
  quantity: number;
  returnedQuantity: number;
  cancelledQuantity: number;
  unitPrice: number;
};

type Props = {
  orderId: string;
  channel: string;
  status: string;
  lines: LineForReturn[];
};

export function PosOrderActions({ orderId, channel, status, lines }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [returnOpen, setReturnOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});

  if (channel !== 'pos') return null;

  const cancelable = status !== 'cancelled' && status !== 'refunded';
  const returnable = lines.some(
    (l) => l.quantity - l.returnedQuantity - l.cancelledQuantity > 0
  );

  const onCancel = () => {
    if (!confirm('¿Cancelar la venta POS completa? Revierte stock y caja si la sesión sigue abierta.')) return;
    startTransition(async () => {
      const res = await cancelPosOrder(orderId);
      if (!res.ok) alert(res.error);
      else router.refresh();
    });
  };

  const onReturn = () => {
    setError(null);
    const returns = Object.entries(returnQty)
      .filter(([, q]) => q > 0)
      .map(([lineId, quantity]) => ({ lineId, quantity }));
    if (returns.length === 0) {
      setError('Indicá cantidades a devolver en al menos una línea');
      return;
    }
    startTransition(async () => {
      const res = await registerSaleReturn({ orderId, returns });
      if (!res.ok) setError(res.error);
      else {
        setReturnOpen(false);
        setReturnQty({});
        router.refresh();
      }
    });
  };

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
        <span className="text-xs text-muted-foreground">Acciones POS:</span>
        {cancelable && (
          <Button variant="destructive" size="sm" onClick={onCancel} disabled={pending}>
            Cancelar venta POS
          </Button>
        )}
        {returnable && status !== 'cancelled' && (
          <Button variant="outline" size="sm" onClick={() => setReturnOpen(true)}>
            Registrar devolución
          </Button>
        )}
      </div>

      {returnOpen && (
        <Dialog open onOpenChange={(o) => !o && setReturnOpen(false)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Devolución parcial</DialogTitle>
              <DialogDescription>
                Indicá la cantidad a devolver de cada línea. Solo se permite hasta lo no devuelto/cancelado.
              </DialogDescription>
            </DialogHeader>
            <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-left">Línea</th>
                  <th className="text-right">Vendido</th>
                  <th className="text-right">Disponible</th>
                  <th className="text-right">Devolver</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const available = l.quantity - l.returnedQuantity - l.cancelledQuantity;
                  return (
                    <tr key={l.id} className="border-t">
                      <td className="py-2 text-xs">
                        <div className="font-medium">{l.variantName ?? l.variantSku ?? l.variantId}</div>
                        <div className="text-muted-foreground">{l.variantSku}</div>
                      </td>
                      <td className="text-right">{l.quantity}</td>
                      <td className="text-right">{available}</td>
                      <td className="text-right">
                        <Input
                          type="number"
                          min={0}
                          max={available}
                          value={returnQty[l.id] || ''}
                          onChange={(e) => {
                            const v = Math.min(available, Math.max(0, Number(e.target.value) || 0));
                            setReturnQty((q) => ({ ...q, [l.id]: v }));
                          }}
                          disabled={available === 0}
                          className="ml-auto h-7 w-20 text-right"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setReturnOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={onReturn} disabled={pending}>
                {pending ? 'Procesando…' : 'Confirmar devolución'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
