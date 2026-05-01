'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { usePosCart, calcLineTotal, calcTotal } from '@/lib/stores/usePosCart';
import { createPosOrder } from '@/lib/actions/pos-order';
import type { PosTenantContext } from '../PosShell';

type Row = {
  id: string;
  kind: 'payment' | 'change' | 'discount' | 'surcharge';
  paymentMethod: string | null;
  currencyCode: string | null;
  amount: number;
  exchangeRateSnapshot: string | null;
};

const genId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function CheckoutDialog({
  open,
  ctx,
  onClose,
}: {
  open: boolean;
  ctx: PosTenantContext;
  onClose: () => void;
}) {
  const router = useRouter();
  const cart = usePosCart();
  const totals = calcTotal({
    lines: cart.lines,
    generalDiscount: cart.generalDiscount,
    surcharge: cart.surcharge,
  });
  const primary = cart.primaryCurrencyOverride ?? ctx.primaryCurrency;
  const primaryCfg = ctx.currencies.find((c) => c.code === primary);
  const enabledMethods = ctx.posConfig.paymentMethods;
  const enabledCurrencies = ctx.currencies.filter((c) =>
    ctx.posConfig.enabledCurrencies.includes(c.code)
  );

  const [rows, setRows] = useState<Row[]>(() => [
    {
      id: genId(),
      kind: 'payment',
      paymentMethod: enabledMethods[0] ?? 'efectivo',
      currencyCode: primary,
      amount: totals.total,
      exchangeRateSnapshot: null,
    },
  ]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ orderNumber: string; correlative: number } | null>(null);

  const getRateForCurrency = (code: string | null): string | null => {
    if (!code || code === primary) return null;
    const c = ctx.currencies.find((cc) => cc.code === code);
    return c?.currentSellRate ?? null;
  };

  const computeAmountInPrimary = (r: Row): number => {
    if (!r.currencyCode || r.currencyCode === primary) return Math.round(r.amount);
    const rate = Number(r.exchangeRateSnapshot ?? getRateForCurrency(r.currencyCode));
    if (!rate) return 0;
    return Math.round(r.amount * rate);
  };

  const totalCovered = rows.reduce((acc, r) => {
    const v = computeAmountInPrimary(r);
    if (r.kind === 'payment' || r.kind === 'surcharge') return acc + v;
    if (r.kind === 'change' || r.kind === 'discount') return acc - v;
    return acc;
  }, 0);
  const diff = totalCovered - totals.total;

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if (patch.currencyCode !== undefined) {
          next.exchangeRateSnapshot = getRateForCurrency(patch.currencyCode);
        }
        return next;
      })
    );
  };

  const addRow = () =>
    setRows((rs) => [
      ...rs,
      {
        id: genId(),
        kind: 'payment',
        paymentMethod: enabledMethods[0] ?? 'efectivo',
        currencyCode: primary,
        amount: 0,
        exchangeRateSnapshot: null,
      },
    ]);

  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));

  const onConfirm = () => {
    if (diff !== 0) {
      setError(`Diferencia ${diff} ≠ 0. Ajustá los cobros.`);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createPosOrder({
        customer: cart.customer,
        primaryCurrency: primary,
        subtotal: totals.subtotal,
        total: totals.total,
        generalDiscountAmount: totals.generalDiscountAmount,
        generalDiscountReason: cart.generalDiscount?.kind === 'pct'
          ? `${cart.generalDiscount.value}%`
          : undefined,
        surchargeAmount: totals.surchargeAmount,
        surchargeReason: cart.surcharge?.reason,
        notes: cart.notes,
        lines: cart.lines.map((l) => ({
          variantId: l.variantId,
          productName: l.productName,
          variantName: l.variantName,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          discountAmount:
            l.discount?.kind === 'amount'
              ? l.discount.value
              : l.discount?.kind === 'pct'
                ? Math.round(l.unitPrice * l.quantity * (l.discount.value / 100))
                : 0,
          discountReason:
            l.discount?.kind === 'pct' ? `${l.discount.value}%` : undefined,
          isComplimentary: l.isComplimentary,
          complimentaryAuthorizedBy: l.complimentaryAuthorizedBy,
          totalPrice: calcLineTotal(l),
        })),
        paymentDetails: rows.map((r) => ({
          kind: r.kind,
          paymentMethod: r.paymentMethod,
          currencyCode: r.currencyCode,
          amount: r.amount,
          exchangeRateSnapshot: r.exchangeRateSnapshot,
          amountInPrimary: computeAmountInPrimary(r),
        })),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess({ orderNumber: res.orderNumber, correlative: res.correlative });
      cart.reset();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          if (success) router.refresh();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{success ? 'Cobro confirmado' : 'Cobro'}</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border bg-muted/40 p-4 text-center">
              <div className="text-2xl font-bold">{success.orderNumber}</div>
              <div className="text-muted-foreground">Ticket #{success.correlative}</div>
            </div>
            <div className="text-center text-muted-foreground">
              La venta se registró exitosamente. Stock decrementado, payment_detail guardado, caja
              actualizada con los movimientos en efectivo.
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => window.print()}>
                Imprimir ticket
              </Button>
              <Button
                onClick={() => {
                  onClose();
                  router.refresh();
                }}
              >
                Nueva venta
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total a cobrar</span>
                <span className="text-xl font-bold font-mono">
                  {primaryCfg?.symbol} {totals.total.toLocaleString('es-PY')}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left">Tipo</th>
                    <th className="text-left">Método</th>
                    <th className="text-left">Moneda</th>
                    <th className="text-right">Monto</th>
                    <th className="text-right">Cotiz.</th>
                    <th className="text-right">En {primary}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="py-1">
                        <select
                          className="rounded border bg-background px-1 py-0.5 text-sm"
                          value={r.kind}
                          onChange={(e) =>
                            updateRow(r.id, { kind: e.target.value as Row['kind'] })
                          }
                        >
                          <option value="payment">Pago</option>
                          <option value="change">Vuelto</option>
                          <option value="discount">Descuento</option>
                          <option value="surcharge">Aumento</option>
                        </select>
                      </td>
                      <td>
                        {r.kind === 'discount' || r.kind === 'surcharge' ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <select
                            className="rounded border bg-background px-1 py-0.5 text-sm"
                            value={r.paymentMethod ?? ''}
                            onChange={(e) =>
                              updateRow(r.id, { paymentMethod: e.target.value })
                            }
                          >
                            {enabledMethods.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td>
                        <select
                          className="rounded border bg-background px-1 py-0.5 text-sm"
                          value={r.currencyCode ?? ''}
                          onChange={(e) =>
                            updateRow(r.id, { currencyCode: e.target.value })
                          }
                        >
                          {enabledCurrencies.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.code}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <Input
                          type="number"
                          value={r.amount || ''}
                          onChange={(e) => updateRow(r.id, { amount: Number(e.target.value) || 0 })}
                          className="ml-auto h-7 w-24 text-right"
                        />
                      </td>
                      <td>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder={r.currencyCode === primary ? '1' : ''}
                          value={r.exchangeRateSnapshot ?? ''}
                          onChange={(e) =>
                            updateRow(r.id, { exchangeRateSnapshot: e.target.value })
                          }
                          disabled={r.currencyCode === primary}
                          className="ml-auto h-7 w-20 text-right text-xs"
                        />
                      </td>
                      <td className="text-right font-mono">
                        {computeAmountInPrimary(r).toLocaleString('es-PY')}
                      </td>
                      <td>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive"
                          onClick={() => removeRow(r.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button variant="outline" size="sm" onClick={addRow} className="mt-2">
                <Plus className="mr-1 h-3 w-3" /> Agregar fila
              </Button>
            </div>

            <div className="flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">
                Cobrado: <strong className="text-foreground">{totalCovered.toLocaleString('es-PY')}</strong>
              </span>
              <span
                className={`font-mono ${diff === 0 ? 'text-green-700' : 'text-amber-700'}`}
              >
                Diff: {diff > 0 ? '+' : ''}
                {diff.toLocaleString('es-PY')}
                {diff === 0 && ' ✓'}
              </span>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={pending}>
                Cancelar
              </Button>
              <Button onClick={onConfirm} disabled={pending || diff !== 0 || cart.lines.length === 0}>
                {pending ? 'Procesando…' : 'Confirmar y Cobrar'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
