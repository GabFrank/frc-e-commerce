'use client';

import { useState, useTransition } from 'react';
import { Star } from 'lucide-react';
import { formatRate } from '@frc-e-commerce/shared-utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
import {
  toggleTenantCurrency,
  setPrimaryCurrency,
  setExchangeRate,
  type TenantCurrencyView,
} from '@/lib/actions/currency';

type Props = {
  initial: TenantCurrencyView[];
};

export function MonedasClient({ initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rateDialog, setRateDialog] = useState<TenantCurrencyView | null>(null);
  // Los rates se expresan en moneda primary — los decimales son los de ella.
  const primary = initial.find((x) => x.isPrimary);
  const primaryDecimalPlaces = primary?.currency.decimalPlaces ?? 0;

  const onToggle = (currencyCode: string, isActive: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await toggleTenantCurrency({ currencyCode, isActive });
      if (!res.ok) setError(res.error);
    });
  };

  const onSetPrimary = (currencyCode: string) => {
    setError(null);
    startTransition(async () => {
      const res = await setPrimaryCurrency({ currencyCode });
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <>
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Monedas configuradas</CardTitle>
          <CardDescription>
            Activá las que vas a usar en este tenant. Una y solo una puede ser principal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {initial.map((tc) => (
            <div
              key={tc.currency.code}
              className="flex items-center gap-4 rounded-md border p-3"
            >
              <div className="flex flex-1 items-center gap-3">
                <span className="font-mono text-lg">{tc.currency.symbol}</span>
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    {tc.currency.code}
                    {tc.isPrimary && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        <Star className="h-3 w-3 fill-current" />
                        Principal
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{tc.currency.name}</div>
                </div>
              </div>

              {/* Cotización vigente (solo secundarias activas) */}
              {tc.isActive && !tc.isPrimary && (
                <div className="text-right text-xs">
                  {tc.currentRate ? (
                    <>
                      <div className="font-mono">
                        compra <strong>{formatRate(tc.currentRate.buyRate, primaryDecimalPlaces)}</strong>
                        {' / '}
                        venta <strong>{formatRate(tc.currentRate.sellRate, primaryDecimalPlaces)}</strong>
                      </div>
                      <div className="text-muted-foreground">
                        {new Date(tc.currentRate.effectiveFrom).toLocaleString('es-PY')}
                      </div>
                    </>
                  ) : (
                    <span className="text-destructive">sin cotización</span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                {tc.isActive && !tc.isPrimary && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRateDialog(tc)}
                    disabled={pending}
                  >
                    {tc.currentRate ? 'Actualizar cotización' : 'Establecer cotización'}
                  </Button>
                )}

                {tc.isActive && !tc.isPrimary && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSetPrimary(tc.currency.code)}
                    disabled={pending}
                  >
                    Marcar como principal
                  </Button>
                )}

                <div className="flex flex-col items-end gap-1">
                  <Switch
                    checked={tc.isActive}
                    onCheckedChange={(v) => onToggle(tc.currency.code, v)}
                    disabled={pending || tc.isPrimary}
                    aria-label={`Activar ${tc.currency.code}`}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {tc.isActive ? 'activa' : 'inactiva'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {rateDialog && (
        <SetRateDialog
          tc={rateDialog}
          primaryDecimalPlaces={primaryDecimalPlaces}
          onClose={() => setRateDialog(null)}
          onError={setError}
        />
      )}
    </>
  );
}

function SetRateDialog({
  tc,
  primaryDecimalPlaces,
  onClose,
  onError,
}: {
  tc: TenantCurrencyView;
  primaryDecimalPlaces: number;
  onClose: () => void;
  onError: (msg: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [buyRate, setBuyRate] = useState<number | null>(
    tc.currentRate?.buyRate ? Number(tc.currentRate.buyRate) : null
  );
  const [sellRate, setSellRate] = useState<number | null>(
    tc.currentRate?.sellRate ? Number(tc.currentRate.sellRate) : null
  );
  const [note, setNote] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onError(null);
    if (buyRate === null || sellRate === null) {
      onError('Completá compra y venta');
      return;
    }
    startTransition(async () => {
      const res = await setExchangeRate({
        currencyCode: tc.currency.code,
        buyRate: String(buyRate),
        sellRate: String(sellRate),
        note: note.trim() || undefined,
      });
      if (!res.ok) onError(res.error);
      else onClose();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Cotización {tc.currency.code} ({tc.currency.symbol})
          </DialogTitle>
          <DialogDescription>
            Cuántas unidades de la moneda principal del tenant equivalen a 1 unidad de {tc.currency.code}.
            Cada cambio queda versionado por timestamp; la cotización vigente es la más reciente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block mb-1 font-medium">Compra (buy)</span>
              <MoneyInput
                value={buyRate}
                onChange={setBuyRate}
                decimalPlaces={primaryDecimalPlaces}
                placeholder="7300"
              />
              <span className="text-xs text-muted-foreground">cuánto pagás por 1 {tc.currency.code}</span>
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Venta (sell)</span>
              <MoneyInput
                value={sellRate}
                onChange={setSellRate}
                decimalPlaces={primaryDecimalPlaces}
                placeholder="7350"
              />
              <span className="text-xs text-muted-foreground">cuánto cobrás por 1 {tc.currency.code}</span>
            </label>
          </div>
          <label className="text-sm block">
            <span className="block mb-1 font-medium">Nota (opcional)</span>
            <Input
              type="text"
              placeholder="Ajuste por suba del dólar"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar cotización'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
