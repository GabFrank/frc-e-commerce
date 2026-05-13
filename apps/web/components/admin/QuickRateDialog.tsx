'use client';

import { useEffect, useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { formatRate } from '@frc-e-commerce/shared-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MoneyInput } from '@/components/ui/money-input';
import {
  listTenantCurrenciesView,
  setExchangeRate,
  type TenantCurrencyView,
} from '@/lib/actions/currency';

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

type EditState = Record<string, { buy: number | null; sell: number | null }>;

function buildEditState(rows: TenantCurrencyView[]): EditState {
  const initial: EditState = {};
  for (const r of rows) {
    initial[r.currency.code] = {
      buy: r.currentRate?.buyRate ? Number(r.currentRate.buyRate) : null,
      sell: r.currentRate?.sellRate ? Number(r.currentRate.sellRate) : null,
    };
  }
  return initial;
}

export function QuickRateDialog({ open, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<TenantCurrencyView[]>([]);
  /**
   * Cantidad de decimales de la moneda primary del tenant. El rate expresa
   * cuánto vale 1 unidad de la moneda secundaria EN la primary, así que los
   * decimales corresponden a la primary (PYG=0, USD=2, etc.).
   */
  const [primaryDecimalPlaces, setPrimaryDecimalPlaces] = useState(0);
  const [edits, setEdits] = useState<EditState>({});
  const [note, setNote] = useState('');
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setSavedCount(null);
    setError(null);
    setLoading(true);
    listTenantCurrenciesView()
      .then((view) => {
        const primary = view.find((v) => v.isPrimary);
        setPrimaryDecimalPlaces(primary?.currency.decimalPlaces ?? 0);
        const secondaries = view.filter((v) => v.isActive && !v.isPrimary);
        setRows(secondaries);
        setEdits(buildEditState(secondaries));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error cargando monedas'))
      .finally(() => setLoading(false));
  }, [open]);

  const updateField = (code: string, field: 'buy' | 'sell', value: number | null) => {
    setEdits((prev) => ({ ...prev, [code]: { ...prev[code]!, [field]: value } }));
  };

  const hasChanges = (code: string) => {
    const r = rows.find((x) => x.currency.code === code);
    if (!r) return false;
    const e = edits[code];
    if (!e) return false;
    const currentBuy = r.currentRate?.buyRate ? Number(r.currentRate.buyRate) : null;
    const currentSell = r.currentRate?.sellRate ? Number(r.currentRate.sellRate) : null;
    return e.buy !== currentBuy || e.sell !== currentSell;
  };

  const onSubmit = () => {
    setError(null);
    const changed = rows.filter((r) => hasChanges(r.currency.code));
    if (changed.length === 0) {
      setError('No hay cambios para guardar');
      return;
    }
    startSubmit(async () => {
      let okCount = 0;
      for (const r of changed) {
        const e = edits[r.currency.code]!;
        if (e.buy === null || e.sell === null) {
          setError(`${r.currency.code}: completá compra y venta`);
          break;
        }
        const res = await setExchangeRate({
          currencyCode: r.currency.code,
          buyRate: String(e.buy),
          sellRate: String(e.sell),
          note: note.trim() || undefined,
        });
        if (res.ok) {
          okCount++;
        } else {
          setError(`${r.currency.code}: ${res.error}`);
          break;
        }
      }
      if (okCount > 0) {
        setSavedCount(okCount);
        onSaved?.();
        // refrescar para mostrar los nuevos rates
        const view = await listTenantCurrenciesView();
        const primary = view.find((v) => v.isPrimary);
        setPrimaryDecimalPlaces(primary?.currency.decimalPlaces ?? 0);
        const secondaries = view.filter((v) => v.isActive && !v.isPrimary);
        setRows(secondaries);
        setEdits(buildEditState(secondaries));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Cotizaciones</DialogTitle>
          <DialogDescription>
            Actualizá las cotizaciones de las monedas secundarias. La principal queda en 1.0.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
            No hay monedas secundarias configuradas. Activá monedas en
            <span className="font-mono"> Configuración → Monedas</span>.
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground">
              <span>Moneda</span>
              <span>Compra</span>
              <span>Venta</span>
            </div>
            {rows.map((r) => {
              const e = edits[r.currency.code]!;
              const changed = hasChanges(r.currency.code);
              return (
                <div
                  key={r.currency.code}
                  className={`grid grid-cols-[1fr_1fr_1fr] items-center gap-2 rounded-md border p-2 ${
                    changed ? 'border-primary/60 bg-primary/5' : ''
                  }`}
                >
                  <div className="text-sm">
                    <div className="font-medium">{r.currency.code}</div>
                    <div className="text-xs text-muted-foreground">{r.currency.name}</div>
                    {r.currentRate && (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        Actual: {formatRate(r.currentRate.buyRate, primaryDecimalPlaces)}
                        {' / '}
                        {formatRate(r.currentRate.sellRate, primaryDecimalPlaces)}
                      </div>
                    )}
                  </div>
                  <MoneyInput
                    value={e.buy}
                    onChange={(v) => updateField(r.currency.code, 'buy', v)}
                    decimalPlaces={primaryDecimalPlaces}
                    placeholder="0"
                  />
                  <MoneyInput
                    value={e.sell}
                    onChange={(v) => updateField(r.currency.code, 'sell', v)}
                    decimalPlaces={primaryDecimalPlaces}
                    placeholder="0"
                  />
                </div>
              );
            })}

            <div className="space-y-1.5">
              <Label htmlFor="rate-note" className="text-xs">
                Nota (opcional)
              </Label>
              <Textarea
                id="rate-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Cotización del día, fuente, etc."
              />
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}
        {savedCount !== null && !error && (
          <div className="rounded-md bg-emerald-100 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
            {savedCount === 1
              ? '1 cotización actualizada'
              : `${savedCount} cotizaciones actualizadas`}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cerrar
          </Button>
          {rows.length > 0 && (
            <Button type="button" onClick={onSubmit} disabled={submitting || loading}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando…
                </>
              ) : (
                'Guardar cotizaciones'
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
