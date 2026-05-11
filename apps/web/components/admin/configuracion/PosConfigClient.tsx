'use client';

import { useState, useTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { updatePosConfig } from '@/lib/actions/pos-config';
import type { PosConfig } from '@frc-e-commerce/db/schema';

const ALL_METHODS = [
  { code: 'efectivo', label: 'Efectivo' },
  { code: 'transferencia', label: 'Transferencia' },
  { code: 'tarjeta_pos', label: 'Tarjeta (POS físico externo)' },
  { code: 'cheque', label: 'Cheque' },
];

type Currency = { code: string; isPrimary: boolean; symbol: string; name: string };

export function PosConfigClient({
  initial,
  availableCurrencies,
}: {
  initial: PosConfig | null;
  availableCurrencies: Currency[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const [enabledCurrencies, setEnabledCurrencies] = useState<string[]>(
    initial?.enabledCurrencies ?? availableCurrencies.map((c) => c.code)
  );
  const [pricingDisplayCurrencies, setPricingDisplayCurrencies] = useState<string[]>(
    initial?.pricingDisplayCurrencies ?? availableCurrencies.filter((c) => c.isPrimary).map((c) => c.code)
  );
  const [paymentMethods, setPaymentMethods] = useState<string[]>(
    initial?.paymentMethods ?? ['efectivo']
  );
  const [primaryPaymentMethod, setPrimaryPaymentMethod] = useState<string | null>(
    initial?.primaryPaymentMethod ?? (initial?.paymentMethods?.[0] ?? 'efectivo')
  );
  const [searchShowImages, setSearchShowImages] = useState(initial?.searchShowImages ?? true);
  const [showCostToAdmin, setShowCostToAdmin] = useState(initial?.showCostToAdmin ?? true);
  const [strictStock, setStrictStock] = useState(initial?.strictStock ?? false);
  const [ticketPrefix, setTicketPrefix] = useState(initial?.ticketPrefix ?? 'POS');
  const [receiptHeader, setReceiptHeader] = useState(initial?.receiptHeader ?? '');
  const [receiptFooter, setReceiptFooter] = useState(initial?.receiptFooter ?? '');

  const toggle = (
    list: string[],
    setList: (l: string[]) => void,
    code: string,
    on: boolean
  ) => {
    setList(on ? [...new Set([...list, code])] : list.filter((x) => x !== code));
  };

  const onSave = () => {
    setError(null);
    startTransition(async () => {
      const effectivePrimary =
        primaryPaymentMethod && paymentMethods.includes(primaryPaymentMethod)
          ? primaryPaymentMethod
          : (paymentMethods[0] ?? null);
      const res = await updatePosConfig({
        enabledCurrencies,
        pricingDisplayCurrencies,
        paymentMethods,
        primaryPaymentMethod: effectivePrimary,
        searchShowImages,
        showCostToAdmin,
        strictStock,
        ticketPrefix,
        receiptHeader: receiptHeader || undefined,
        receiptFooter: receiptFooter || undefined,
      });
      if (!res.ok) setError(res.error);
      else setSavedAt(new Date());
    });
  };

  return (
    <Tabs defaultValue="monedas">
      <TabsList>
        <TabsTrigger value="monedas">Monedas y métodos</TabsTrigger>
        <TabsTrigger value="pantalla">Pantalla</TabsTrigger>
        <TabsTrigger value="recibo">Recibo</TabsTrigger>
      </TabsList>

      <TabsContent value="monedas" className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle>Monedas habilitadas en POS</CardTitle>
            <CardDescription>
              Las que aparecen en el diálogo de cobro y para apertura/cierre de caja.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {availableCurrencies.map((c) => (
              <div key={c.code} className="flex items-center justify-between rounded-md border p-2">
                <div className="text-sm">
                  <span className="font-medium">{c.code}</span>{' '}
                  <span className="text-muted-foreground">{c.name}</span>
                  {c.isPrimary && (
                    <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                      Principal
                    </span>
                  )}
                </div>
                <Switch
                  checked={enabledCurrencies.includes(c.code)}
                  disabled={c.isPrimary}
                  onCheckedChange={(v) => toggle(enabledCurrencies, setEnabledCurrencies, c.code, v)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mostrar precio en estas monedas</CardTitle>
            <CardDescription>
              Equivalentes que aparecen junto al total del carrito para referencia.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {availableCurrencies.map((c) => (
              <div key={c.code} className="flex items-center justify-between rounded-md border p-2">
                <span className="text-sm font-medium">{c.code}</span>
                <Switch
                  checked={pricingDisplayCurrencies.includes(c.code)}
                  onCheckedChange={(v) =>
                    toggle(pricingDisplayCurrencies, setPricingDisplayCurrencies, c.code, v)
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Métodos de pago aceptados</CardTitle>
            <CardDescription>
              Los métodos que aparecen como opción al cobrar. Marcá uno como principal para
              precargarlo en el diálogo de cobro.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {ALL_METHODS.map((m) => {
              const enabled = paymentMethods.includes(m.code);
              const isPrimary = primaryPaymentMethod === m.code;
              return (
                <div key={m.code} className="flex items-center justify-between rounded-md border p-2">
                  <div className="flex items-center gap-3 text-sm">
                    <span>{m.label}</span>
                    {isPrimary && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                        Principal
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => enabled && setPrimaryPaymentMethod(m.code)}
                      disabled={!enabled}
                      className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                      title={enabled ? 'Marcar como principal' : 'Activá el método antes de marcarlo principal'}
                    >
                      {isPrimary ? '★ Principal' : 'Hacer principal'}
                    </button>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(v) => {
                        toggle(paymentMethods, setPaymentMethods, m.code, v);
                        if (!v && isPrimary) {
                          const fallback = paymentMethods.find((p) => p !== m.code) ?? null;
                          setPrimaryPaymentMethod(fallback);
                        }
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="pantalla" className="space-y-3">
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Mostrar imágenes en búsqueda</div>
                <div className="text-xs text-muted-foreground">
                  Útil con catálogos grandes para identificación visual rápida.
                </div>
              </div>
              <Switch checked={searchShowImages} onCheckedChange={setSearchShowImages} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Mostrar costo a admin/manager</div>
                <div className="text-xs text-muted-foreground">
                  Visible solo a roles con capability `pos.see_cost`. Cashier nunca lo ve.
                </div>
              </div>
              <Switch checked={showCostToAdmin} onCheckedChange={setShowCostToAdmin} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Bloqueo estricto de stock</div>
                <div className="text-xs text-muted-foreground">
                  Si está activado: no se puede agregar más unidades que el stock disponible.
                </div>
              </div>
              <Switch checked={strictStock} onCheckedChange={setStrictStock} />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="recibo" className="space-y-3">
        <Card>
          <CardContent className="space-y-3 pt-6">
            <label className="block text-sm">
              <span className="block mb-1 font-medium">Prefix de ticket</span>
              <Input value={ticketPrefix} onChange={(e) => setTicketPrefix(e.target.value)} maxLength={10} />
              <span className="mt-1 block text-xs text-muted-foreground">
                Ej: POS → genera correlativos `POS-tienda-000123`.
              </span>
            </label>
            <label className="block text-sm">
              <span className="block mb-1 font-medium">Encabezado del recibo (opcional)</span>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                rows={3}
                value={receiptHeader}
                onChange={(e) => setReceiptHeader(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="block mb-1 font-medium">Pie del recibo (opcional)</span>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                rows={2}
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
              />
            </label>
          </CardContent>
        </Card>
      </TabsContent>

      <div className="flex items-center justify-between border-t pt-3">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
        )}
        {savedAt && !error && (
          <div className="text-sm text-green-700">Guardado {savedAt.toLocaleTimeString('es-PY')}</div>
        )}
        <Button onClick={onSave} disabled={pending} className="ml-auto">
          {pending ? 'Guardando…' : 'Guardar configuración'}
        </Button>
      </div>
    </Tabs>
  );
}
