'use client';

import { Button } from '@/components/ui/button';
import type { PosTenantContext } from './PosShell';

type Props = {
  totals: {
    subtotal: number;
    generalDiscountAmount: number;
    surchargeAmount: number;
    total: number;
  };
  ctx: PosTenantContext;
  customCurrency: string | null;
  canCheckout: boolean;
  onCheckout: () => void;
};

export function CartTotals({ totals, ctx, customCurrency, canCheckout, onCheckout }: Props) {
  const primary = customCurrency ?? ctx.primaryCurrency;
  const primaryCfg = ctx.currencies.find((c) => c.code === primary);

  // Equivalentes en otras monedas habilitadas para display
  const otherDisplays = ctx.currencies
    .filter(
      (c) =>
        c.code !== primary &&
        ctx.posConfig.pricingDisplayCurrencies.includes(c.code) &&
        c.currentSellRate
    )
    .map((c) => {
      // Si primary es la primary del tenant: total / sellRate = monto en moneda secundaria
      // Si primary es override (otra moneda secundaria), conversión más compleja — para MVP simple skip
      if (primary !== ctx.primaryCurrency) return null;
      const rate = Number(c.currentSellRate);
      if (!rate) return null;
      const amount = totals.total / rate;
      return {
        code: c.code,
        symbol: c.symbol,
        amount: amount.toFixed(c.decimalPlaces),
      };
    })
    .filter((x): x is { code: string; symbol: string; amount: string } => x !== null);

  return (
    <div className="border-t bg-muted/40 p-3 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Subtotal</span>
        <span className="font-mono">{totals.subtotal.toLocaleString('es-PY')}</span>
      </div>
      {totals.generalDiscountAmount > 0 && (
        <div className="flex justify-between text-amber-700">
          <span>Descuento general</span>
          <span className="font-mono">−{totals.generalDiscountAmount.toLocaleString('es-PY')}</span>
        </div>
      )}
      {totals.surchargeAmount > 0 && (
        <div className="flex justify-between text-blue-700">
          <span>Aumento</span>
          <span className="font-mono">+{totals.surchargeAmount.toLocaleString('es-PY')}</span>
        </div>
      )}
      <div className="mt-2 flex items-baseline justify-between border-t pt-2">
        <span className="font-medium">Total ({primary})</span>
        <span className="font-mono text-2xl font-bold">
          {primaryCfg?.symbol} {totals.total.toLocaleString('es-PY')}
        </span>
      </div>
      {otherDisplays.length > 0 && (
        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {otherDisplays.map((d) => (
            <div key={d.code} className="flex justify-between">
              <span>≈ {d.code}</span>
              <span className="font-mono">
                {d.symbol} {Number(d.amount).toLocaleString('es-PY')}
              </span>
            </div>
          ))}
        </div>
      )}
      <Button
        size="lg"
        className="mt-3 w-full"
        disabled={!canCheckout || totals.total === 0}
        onClick={onCheckout}
      >
        Cobrar (F12)
      </Button>
      {!canCheckout && (
        <p className="mt-1 text-center text-xs text-amber-700">Abrí caja para cobrar</p>
      )}
    </div>
  );
}
