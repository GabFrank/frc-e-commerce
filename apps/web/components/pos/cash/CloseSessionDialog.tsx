'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatAmount } from '@frc-e-commerce/shared-utils';
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
import { closeCashSession, getClosureSummary } from '@/lib/actions/cash-session';
import { DenominationCounter, type DenominationCount } from './DenominationCounter';
import type { PosTenantContext } from '../PosShell';

type CurrencyCloseState = {
  countedDeclared: number;
  detail: DenominationCount[] | null;
};

type Props = {
  open: boolean;
  cashSessionId: string;
  /** códigos de moneda con balance abierto */
  openCurrencies: string[];
  ctx: PosTenantContext;
  onClose: () => void;
};

export function CloseSessionDialog({ open, cashSessionId, openCurrencies, ctx, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [byCurrency, setByCurrency] = useState<Record<string, CurrencyCloseState>>({});
  const [notes, setNotes] = useState('');
  const [closureId, setClosureId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getClosureSummary>> | null>(null);

  useEffect(() => {
    if (!open) return;
    setByCurrency(
      Object.fromEntries(
        openCurrencies.map((c) => [c, { countedDeclared: 0, detail: null }])
      )
    );
    setError(null);
    setClosureId(null);
    setSummary(null);
  }, [open, openCurrencies.join(',')]);

  const handleClose = () => {
    setError(null);
    const balances = openCurrencies.map((c) => {
      const s = byCurrency[c];
      return {
        currencyCode: c,
        countedDeclared: s?.countedDeclared ?? 0,
        denominations: s?.detail ?? [],
      };
    });
    startTransition(async () => {
      const res = await closeCashSession({ cashSessionId, balances, notes: notes || undefined });
      if (!res.ok) setError(res.error);
      else {
        setClosureId(res.closureId);
        const s = await getClosureSummary(res.closureId);
        setSummary(s);
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && (closureId ? router.refresh() : onClose())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{closureId ? 'Cierre de caja confirmado' : 'Cerrar caja'}</DialogTitle>
            <DialogDescription>
              {closureId
                ? 'La sesión quedó cerrada. Mirá el resumen abajo y podés imprimir.'
                : 'Contá físicamente el efectivo en caja por moneda y confirmá. Las diferencias quedan registradas.'}
            </DialogDescription>
          </DialogHeader>

          {!closureId && (
            <div className="space-y-3">
              {openCurrencies.map((code) => {
                const c = ctx.currencies.find((cc) => cc.code === code);
                const s = byCurrency[code] ?? { countedDeclared: 0, detail: null };
                if (!c) return null;
                return (
                  <div key={code} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {code} <span className="text-xs text-muted-foreground">({c.name})</span>
                      </span>
                    </div>
                    <div className="mt-2 flex items-end gap-2">
                      <label className="flex-1 text-sm">
                        <span className="block mb-1 text-xs text-muted-foreground">
                          Contado físico ({c.symbol})
                        </span>
                        <Input
                          type="number"
                          value={s.countedDeclared || ''}
                          onChange={(e) =>
                            setByCurrency((b) => ({
                              ...b,
                              [code]: { ...s, countedDeclared: Number(e.target.value) || 0 },
                            }))
                          }
                        />
                      </label>
                      <Button variant="outline" size="sm" onClick={() => setCounterFor(code)}>
                        Contar
                      </Button>
                    </div>
                  </div>
                );
              })}

              <label className="block text-sm">
                <span className="block mb-1 text-xs text-muted-foreground">Notas (opcional)</span>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
            </div>
          )}

          {summary && closureId && (
            <div className="space-y-2 text-sm">
              <div className="rounded-md border p-3">
                <div className="font-medium">Resumen del cierre</div>
                <div className="mt-2 grid grid-cols-2 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Transacciones</span>
                  <span className="text-right font-mono">{summary.header.totalTransactions}</span>
                  <span className="text-muted-foreground">Ticket promedio</span>
                  <span className="text-right font-mono">
                    {formatAmount(Number(summary.header.avgTicketInPrimary), ctx.primaryCurrency)}
                  </span>
                  <span className="text-muted-foreground">Ventas (primary)</span>
                  <span className="text-right font-mono">
                    {formatAmount(Number(summary.header.totalSalesInPrimary), ctx.primaryCurrency)}
                  </span>
                  <span className="text-muted-foreground">Devoluciones</span>
                  <span className="text-right font-mono">
                    {formatAmount(Number(summary.header.totalReturnsInPrimary), ctx.primaryCurrency)}
                  </span>
                  <span className="text-muted-foreground">Cancelaciones</span>
                  <span className="text-right font-mono">
                    {formatAmount(Number(summary.header.totalCancellationsInPrimary), ctx.primaryCurrency)}
                  </span>
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="font-medium">Cuadre por moneda</div>
                <table className="mt-2 w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left">Moneda</th>
                      <th className="text-right">Apertura</th>
                      <th className="text-right">Esperado</th>
                      <th className="text-right">Contado</th>
                      <th className="text-right">Dif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.balances.map((b) => (
                      <tr key={b.id} className="border-t">
                        <td className="font-mono">{b.currencyCode}</td>
                        <td className="text-right font-mono">
                          {formatAmount(Number(b.openingDeclared), b.currencyCode)}
                        </td>
                        <td className="text-right font-mono">
                          {formatAmount(Number(b.expected ?? 0), b.currencyCode)}
                        </td>
                        <td className="text-right font-mono">
                          {formatAmount(Number(b.countedDeclared ?? 0), b.currencyCode)}
                        </td>
                        <td
                          className={`text-right font-mono ${
                            (Number(b.diff ?? 0)) === 0
                              ? 'text-green-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {Number(b.diff ?? 0) > 0 ? '+' : ''}
                          {formatAmount(Number(b.diff ?? 0), b.currencyCode)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-md border p-3">
                <div className="font-medium">Ventas por método y moneda</div>
                <table className="mt-2 w-full text-xs">
                  <tbody>
                    {summary.metrics
                      .filter((m) => m.metric === 'sales')
                      .map((m) => (
                        <tr key={m.id} className="border-t">
                          <td>
                            {m.paymentMethod} / {m.currencyCode}
                          </td>
                          <td className="text-right font-mono">
                            {formatAmount(Number(m.valueNumeric ?? 0), m.currencyCode ?? ctx.primaryCurrency)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            {closureId ? (
              <>
                <Button variant="outline" onClick={() => window.print()}>
                  Imprimir
                </Button>
                <Button
                  onClick={() => {
                    onClose();
                    router.refresh();
                  }}
                >
                  Listo
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button onClick={handleClose} disabled={pending}>
                  {pending ? 'Cerrando…' : 'Confirmar cierre'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {counterFor && (() => {
        const c = ctx.currencies.find((cc) => cc.code === counterFor)!;
        const s = byCurrency[counterFor] ?? { countedDeclared: 0, detail: null };
        return (
          <DenominationCounter
            open
            currencyCode={c.code}
            currencySymbol={c.symbol}
            declaredAmount={s.countedDeclared}
            onClose={() => setCounterFor(null)}
            onConfirm={(t) => {
              setByCurrency((b) => ({
                ...b,
                [c.code]: {
                  countedDeclared: t.countedTotal,
                  detail: t.detail,
                },
              }));
              setCounterFor(null);
            }}
          />
        );
      })()}
    </>
  );
}
