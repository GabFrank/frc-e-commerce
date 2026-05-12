'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatAmount, getCurrencyDecimalPlaces } from '@frc-e-commerce/shared-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
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
  /**
   * Códigos de moneda con balance abierto explícito. Se sigue contando todas
   * las habilitadas en config; este array sirve solo para diferenciar visualmente
   * cuáles tienen fondo inicial declarado.
   */
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

  // Se cuentan todas las monedas habilitadas en config del POS — incluye
  // aquellas en las que la caja no abrió pero pudieron entrar pagos.
  const currenciesToCount = ctx.currencies
    .filter((c) => ctx.posConfig.enabledCurrencies.includes(c.code))
    .map((c) => c.code);
  const openSet = new Set(openCurrencies);

  useEffect(() => {
    if (!open) return;
    setByCurrency(
      Object.fromEntries(
        currenciesToCount.map((c) => [c, { countedDeclared: 0, detail: null }])
      )
    );
    setError(null);
    setClosureId(null);
    setSummary(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currenciesToCount.join(',')]);

  const handleClose = () => {
    setError(null);
    // State trabaja en major units (decimal); DB guarda en minor — convertimos al enviar.
    const balances = currenciesToCount.map((c) => {
      const cur = ctx.currencies.find((cc) => cc.code === c);
      const dp = cur?.decimalPlaces ?? 0;
      const s = byCurrency[c];
      return {
        currencyCode: c,
        countedDeclared: Math.round((s?.countedDeclared ?? 0) * Math.pow(10, dp)),
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
              {currenciesToCount.map((code) => {
                const c = ctx.currencies.find((cc) => cc.code === code);
                const s = byCurrency[code] ?? { countedDeclared: 0, detail: null };
                const wasOpened = openSet.has(code);
                if (!c) return null;
                return (
                  <div key={code} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {code} <span className="text-xs text-muted-foreground">({c.name})</span>
                      </span>
                      {!wasOpened && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          sin apertura
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-end gap-2">
                      <label className="flex-1 text-sm">
                        <span className="block mb-1 text-xs text-muted-foreground">
                          Contado físico ({c.symbol})
                        </span>
                        <MoneyInput
                          value={s.countedDeclared || null}
                          onChange={(v) =>
                            setByCurrency((b) => ({
                              ...b,
                              [code]: { ...s, countedDeclared: v ?? 0 },
                            }))
                          }
                          decimalPlaces={c.decimalPlaces}
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
                    {summary.balances.map((b) => {
                      const dp = getCurrencyDecimalPlaces(b.currencyCode);
                      const toMajor = (v: number | string | null | undefined) =>
                        v == null ? 0 : Number(v) / Math.pow(10, dp);
                      const diffMajor = toMajor(b.diff);
                      return (
                        <tr key={b.id} className="border-t">
                          <td className="font-mono">{b.currencyCode}</td>
                          <td className="text-right font-mono">
                            {formatAmount(toMajor(b.openingDeclared), b.currencyCode)}
                          </td>
                          <td className="text-right font-mono">
                            {formatAmount(toMajor(b.expected), b.currencyCode)}
                          </td>
                          <td className="text-right font-mono">
                            {formatAmount(toMajor(b.countedDeclared), b.currencyCode)}
                          </td>
                          <td
                            className={`text-right font-mono ${
                              diffMajor === 0 ? 'text-green-700' : 'text-amber-700'
                            }`}
                          >
                            {diffMajor > 0 ? '+' : ''}
                            {formatAmount(diffMajor, b.currencyCode)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="rounded-md border p-3">
                <div className="font-medium">Ventas por método</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  Convertido a {ctx.primaryCurrency} (consultá el detalle de caja para verlo en la moneda original)
                </div>
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
                            {formatAmount(Number(m.valueNumeric ?? 0), ctx.primaryCurrency)}
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
        const dp = c.decimalPlaces;
        return (
          <DenominationCounter
            open
            currencyCode={c.code}
            currencySymbol={c.symbol}
            // Counter en minor units; state aquí en major.
            declaredAmount={Math.round(s.countedDeclared * Math.pow(10, dp))}
            onClose={() => setCounterFor(null)}
            onConfirm={(t) => {
              setByCurrency((b) => ({
                ...b,
                [c.code]: {
                  countedDeclared: t.countedTotal / Math.pow(10, dp),
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
