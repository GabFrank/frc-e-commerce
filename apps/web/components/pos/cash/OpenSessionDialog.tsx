'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { openCashSession } from '@/lib/actions/cash-session';
import { DenominationCounter, type DenominationCount } from './DenominationCounter';
import type { PosTenantContext } from '../PosShell';

type CurrencyState = {
  enabled: boolean;
  declared: number;
  detail: DenominationCount[] | null;
};

export function OpenSessionDialog({
  ctx,
  onSuccess,
}: {
  ctx: PosTenantContext;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [counterFor, setCounterFor] = useState<string | null>(null);
  const [byCurrency, setByCurrency] = useState<Record<string, CurrencyState>>(() =>
    Object.fromEntries(
      ctx.currencies
        .filter((c) => ctx.posConfig.enabledCurrencies.includes(c.code))
        // Por default todas las monedas habilitadas en config quedan abiertas
        // con declared=0. El cajero ajusta el monto si tiene fondo inicial en esa moneda.
        .map((c) => [c.code, { enabled: true, declared: 0, detail: null }])
    )
  );

  const handleOpen = () => {
    setError(null);
    // El UI tipea en unidades mayores (191,30 BRL); en DB se guarda en
    // unidades mínimas (19130 centavos) — uniforme con cash_movement.
    const balances = Object.entries(byCurrency)
      .filter(([, s]) => s.enabled)
      .map(([currencyCode, s]) => {
        const cur = ctx.currencies.find((c) => c.code === currencyCode);
        const dp = cur?.decimalPlaces ?? 0;
        return {
          currencyCode,
          openingDeclared: Math.round(s.declared * Math.pow(10, dp)),
          denominations: s.detail ?? [],
        };
      });
    if (balances.length === 0) {
      setError('Activá al menos una moneda');
      return;
    }
    startTransition(async () => {
      const res = await openCashSession({ balances });
      if (!res.ok) setError(res.error);
      else {
        onSuccess();
        router.refresh();
      }
    });
  };

  return (
    <>
      <Dialog
        open
        onOpenChange={(o) => {
          if (!o) router.push('/admin');
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Abrir caja</DialogTitle>
            <DialogDescription>
              Para empezar a vender necesitás abrir caja declarando el saldo inicial por moneda.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {ctx.currencies
              .filter((c) => ctx.posConfig.enabledCurrencies.includes(c.code))
              .map((c) => {
                const s = byCurrency[c.code]!;
                return (
                  <div key={c.code} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{c.code}</span>{' '}
                        <span className="text-sm text-muted-foreground">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {s.enabled ? 'Activa' : 'Inactiva'}
                        </span>
                        <Switch
                          checked={s.enabled}
                          disabled={c.isPrimary}
                          onCheckedChange={(v) =>
                            setByCurrency((b) => ({
                              ...b,
                              [c.code]: { ...s, enabled: v },
                            }))
                          }
                        />
                      </div>
                    </div>
                    {s.enabled && (
                      <div className="mt-2 flex items-end gap-2">
                        <label className="flex-1 text-sm">
                          <span className="block mb-1 text-xs text-muted-foreground">
                            Monto declarado ({c.symbol})
                          </span>
                          <MoneyInput
                            value={s.declared || null}
                            onChange={(v) =>
                              setByCurrency((b) => ({
                                ...b,
                                [c.code]: { ...s, declared: v ?? 0 },
                              }))
                            }
                            decimalPlaces={c.decimalPlaces}
                          />
                        </label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCounterFor(c.code)}
                        >
                          {s.detail ? 'Re-contar' : 'Contar'}
                        </Button>
                        {s.detail && (
                          <span className="text-xs text-green-700">✓ contado</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => router.push('/admin')}
              disabled={pending}
            >
              Salir
            </Button>
            <Button onClick={handleOpen} disabled={pending}>
              {pending ? 'Abriendo…' : 'Abrir caja'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {counterFor && (() => {
        const c = ctx.currencies.find((cc) => cc.code === counterFor)!;
        const s = byCurrency[counterFor]!;
        const dp = c.decimalPlaces;
        return (
          <DenominationCounter
            open
            currencyCode={c.code}
            currencySymbol={c.symbol}
            // El counter trabaja en minor units (las denominaciones lo están),
            // pero el state aquí está en major — convertimos en ambos sentidos.
            declaredAmount={Math.round(s.declared * Math.pow(10, dp))}
            onClose={() => setCounterFor(null)}
            onConfirm={(t) => {
              setByCurrency((b) => ({
                ...b,
                [c.code]: {
                  ...s,
                  declared: t.countedTotal / Math.pow(10, dp),
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
