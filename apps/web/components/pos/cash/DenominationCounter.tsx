'use client';

import { useEffect, useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
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
import { getDenominationsForCurrency } from '@/lib/actions/cash-session';

export type DenominationCount = {
  denominationId: string;
  qty: number;
};

type Props = {
  open: boolean;
  currencyCode: string;
  currencySymbol: string;
  declaredAmount: number;
  onClose: () => void;
  onConfirm: (totals: {
    countedTotal: number;
    detail: DenominationCount[];
  }) => void;
};

export function DenominationCounter({
  open,
  currencyCode,
  currencySymbol,
  declaredAmount,
  onClose,
  onConfirm,
}: Props) {
  const [denoms, setDenoms] = useState<
    Array<{ id: string; value: number; kind: string }>
  >([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const res = await getDenominationsForCurrency(currencyCode);
      setDenoms(
        res.map((d) => ({ id: d.id, value: Number(d.value), kind: d.kind }))
      );
      setCounts({});
    });
  }, [open, currencyCode]);

  const total = denoms.reduce((acc, d) => acc + d.value * (counts[d.id] ?? 0), 0);
  const diff = total - declaredAmount;

  const handleConfirm = () => {
    onConfirm({
      countedTotal: total,
      detail: Object.entries(counts)
        .filter(([, q]) => q > 0)
        .map(([denominationId, qty]) => ({ denominationId, qty })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conteo {currencyCode}</DialogTitle>
          <DialogDescription>
            Ingresá la cantidad física de billetes y monedas que tenés en caja.
          </DialogDescription>
        </DialogHeader>
        {pending ? (
          <div className="flex justify-center p-6 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left font-normal">Denom.</th>
                  <th className="font-normal">×</th>
                  <th className="text-right font-normal">Cant.</th>
                  <th className="text-right font-normal">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {denoms.map((d) => {
                  const qty = counts[d.id] ?? 0;
                  return (
                    <tr key={d.id} className="border-b">
                      <td className="py-1 font-mono">
                        {d.value.toLocaleString('es-PY')}
                      </td>
                      <td className="text-xs text-muted-foreground">
                        {d.kind === 'coin' ? 'm' : 'b'}
                      </td>
                      <td className="py-1">
                        <Input
                          type="number"
                          min={0}
                          value={qty || ''}
                          onChange={(e) =>
                            setCounts((c) => ({
                              ...c,
                              [d.id]: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="ml-auto h-7 w-16 text-right"
                        />
                      </td>
                      <td className="py-1 text-right font-mono text-xs">
                        {(d.value * qty).toLocaleString('es-PY')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium">
                  <td colSpan={2} className="py-2">
                    Total contado
                  </td>
                  <td colSpan={2} className="text-right font-mono">
                    {currencySymbol} {total.toLocaleString('es-PY')}
                  </td>
                </tr>
                <tr className="text-muted-foreground">
                  <td colSpan={2}>Vs declarado</td>
                  <td colSpan={2} className="text-right font-mono">
                    {currencySymbol} {declaredAmount.toLocaleString('es-PY')}
                  </td>
                </tr>
                <tr className={diff !== 0 ? 'text-amber-700' : 'text-green-700'}>
                  <td colSpan={2} className="font-medium">
                    Diferencia
                  </td>
                  <td colSpan={2} className="text-right font-mono">
                    {diff > 0 ? '+' : ''}
                    {diff.toLocaleString('es-PY')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={pending}>
            Confirmar conteo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
