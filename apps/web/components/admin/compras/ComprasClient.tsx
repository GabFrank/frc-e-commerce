'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  createPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
} from '@/lib/actions/purchase-order';
import type { Supplier, PurchaseOrder } from '@frc-e-commerce/db/schema';

type POView = PurchaseOrder & { supplierName: string };

type LineDraft = {
  id: string;
  variantId: string;
  variantLabel: string;
  quantity: number;
  unitCost: number;
};

type ExtraDraft = {
  id: string;
  description: string;
  amount: number;
  strategy: 'cost' | 'equal' | 'qty' | 'manual';
};

const genId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function ComprasClient({
  initial,
  suppliers,
  currencies,
}: {
  initial: POView[];
  suppliers: Supplier[];
  currencies: Array<{ code: string; symbol: string; name: string }>;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)} disabled={suppliers.length === 0}>
          <Plus className="mr-1 h-4 w-4" /> Nueva orden de compra
        </Button>
      </div>

      {suppliers.length === 0 && (
        <div className="rounded-md bg-amber-100 p-3 text-sm text-amber-900">
          Cargá al menos un proveedor en /admin/proveedores antes de crear órdenes.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{initial.length} órdenes</CardTitle>
        </CardHeader>
        <CardContent>
          {initial.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin órdenes todavía.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-left">PO</th>
                  <th className="text-left">Proveedor</th>
                  <th className="text-left">Estado</th>
                  <th className="text-right">Total</th>
                  <th className="text-left">Moneda</th>
                  <th className="text-left">Creada</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {initial.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="py-2 font-mono text-xs">{p.poNumber}</td>
                    <td>{p.supplierName}</td>
                    <td>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{p.status}</span>
                    </td>
                    <td className="text-right font-mono">
                      {Number(p.totalInCurrency).toLocaleString('es-PY')}
                    </td>
                    <td>{p.currencyCode}</td>
                    <td className="text-xs text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString('es-PY')}
                    </td>
                    <td className="text-right">
                      <POActions po={p} onRefresh={() => router.refresh()} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {creating && (
        <CreatePOForm
          suppliers={suppliers}
          currencies={currencies}
          onClose={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function POActions({ po, onRefresh }: { po: POView; onRefresh: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onReceive = () => {
    setError(null);
    if (!confirm(`¿Recibir PO ${po.poNumber}? Esto suma stock y actualiza costos.`)) return;
    startTransition(async () => {
      const res = await receivePurchaseOrder({ purchaseOrderId: po.id });
      if (!res.ok) {
        setError(res.error);
        alert(res.error);
      } else onRefresh();
    });
  };
  const onCancel = () => {
    if (!confirm(`¿Cancelar PO ${po.poNumber}? Si ya estaba recibida, se revertirá el stock.`)) return;
    startTransition(async () => {
      const res = await cancelPurchaseOrder(po.id);
      if (!res.ok) alert(res.error);
      else onRefresh();
    });
  };

  return (
    <div className="flex gap-1">
      {po.status === 'placed' && (
        <Button size="sm" variant="outline" onClick={onReceive} disabled={pending}>
          Recibir
        </Button>
      )}
      {(po.status === 'placed' || po.status === 'received') && (
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      )}
    </div>
  );
}

function CreatePOForm({
  suppliers,
  currencies,
  onClose,
}: {
  suppliers: Supplier[];
  currencies: Array<{ code: string; symbol: string; name: string }>;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [currencyCode, setCurrencyCode] = useState(currencies[0]?.code ?? 'PYG');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [extras, setExtras] = useState<ExtraDraft[]>([]);

  const addLine = () =>
    setLines((ls) => [
      ...ls,
      { id: genId(), variantId: '', variantLabel: '', quantity: 1, unitCost: 0 },
    ]);
  const addExtra = () =>
    setExtras((es) => [...es, { id: genId(), description: '', amount: 0, strategy: 'cost' }]);

  const subtotal = lines.reduce((acc, l) => acc + l.quantity * l.unitCost, 0);
  const extrasTotal = extras.reduce((acc, e) => acc + e.amount, 0);
  const total = subtotal + extrasTotal;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!supplierId) {
      setError('Elegí un proveedor');
      return;
    }
    if (lines.length === 0 || lines.some((l) => !l.variantId || !l.quantity)) {
      setError('Agregá al menos una línea con variante y cantidad');
      return;
    }
    startTransition(async () => {
      const res = await createPurchaseOrder({
        supplierId,
        currencyCode,
        notes: notes || undefined,
        lines: lines.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
          unitCostInCurrency: l.unitCost,
        })),
        extras: extras
          .filter((e) => e.amount > 0)
          .map((e) => ({
            description: e.description || 'Extra',
            amountInCurrency: e.amount,
            allocationStrategy: e.strategy,
          })),
      });
      if (!res.ok) setError(res.error);
      else onClose();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva orden de compra</DialogTitle>
          <DialogDescription>
            Crea la PO en estado &quot;placed&quot;. El recibo (que actualiza stock + costos)
            se hace después con el botón Recibir.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block mb-1 font-medium">Proveedor</span>
              <select
                className="w-full rounded border bg-background px-2 py-1.5 text-sm"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Moneda de la compra</span>
              <select
                className="w-full rounded border bg-background px-2 py-1.5 text-sm"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Líneas</span>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="mr-1 h-3 w-3" /> Agregar línea
              </Button>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-left">Variant ID</th>
                  <th className="text-right">Cantidad</th>
                  <th className="text-right">Costo unitario</th>
                  <th className="text-right">Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td>
                      <Input
                        value={l.variantId}
                        onChange={(e) =>
                          setLines((ls) =>
                            ls.map((x) => (x.id === l.id ? { ...x, variantId: e.target.value } : x))
                          )
                        }
                        placeholder="UUID de variante"
                        className="h-7 font-mono text-xs"
                      />
                    </td>
                    <td>
                      <Input
                        type="number"
                        min={1}
                        value={l.quantity}
                        onChange={(e) =>
                          setLines((ls) =>
                            ls.map((x) =>
                              x.id === l.id ? { ...x, quantity: Number(e.target.value) || 0 } : x
                            )
                          )
                        }
                        className="h-7 ml-auto w-20 text-right"
                      />
                    </td>
                    <td>
                      <Input
                        type="number"
                        min={0}
                        value={l.unitCost || ''}
                        onChange={(e) =>
                          setLines((ls) =>
                            ls.map((x) =>
                              x.id === l.id ? { ...x, unitCost: Number(e.target.value) || 0 } : x
                            )
                          )
                        }
                        className="h-7 ml-auto w-28 text-right"
                      />
                    </td>
                    <td className="text-right font-mono text-xs">
                      {(l.quantity * l.unitCost).toLocaleString('es-PY')}
                    </td>
                    <td>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Gastos extras (flete, aduana, etc.)</span>
              <Button type="button" variant="outline" size="sm" onClick={addExtra}>
                <Plus className="mr-1 h-3 w-3" /> Agregar extra
              </Button>
            </div>
            {extras.length > 0 && (
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left">Descripción</th>
                    <th className="text-right">Monto</th>
                    <th className="text-left">Prorrateo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {extras.map((e) => (
                    <tr key={e.id} className="border-t">
                      <td>
                        <Input
                          value={e.description}
                          onChange={(ev) =>
                            setExtras((es) =>
                              es.map((x) =>
                                x.id === e.id ? { ...x, description: ev.target.value } : x
                              )
                            )
                          }
                          placeholder="Flete, aduana, etc."
                          className="h-7 text-xs"
                        />
                      </td>
                      <td>
                        <Input
                          type="number"
                          min={0}
                          value={e.amount || ''}
                          onChange={(ev) =>
                            setExtras((es) =>
                              es.map((x) =>
                                x.id === e.id ? { ...x, amount: Number(ev.target.value) || 0 } : x
                              )
                            )
                          }
                          className="h-7 ml-auto w-28 text-right"
                        />
                      </td>
                      <td>
                        <select
                          value={e.strategy}
                          onChange={(ev) =>
                            setExtras((es) =>
                              es.map((x) =>
                                x.id === e.id ? { ...x, strategy: ev.target.value as ExtraDraft['strategy'] } : x
                              )
                            )
                          }
                          className="rounded border bg-background px-1 py-0.5 text-xs"
                        >
                          <option value="cost">Proporcional al costo</option>
                          <option value="equal">Equitativo por línea</option>
                          <option value="qty">Proporcional a cantidad</option>
                          <option value="manual">Manual (no MVP)</option>
                        </select>
                      </td>
                      <td>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => setExtras((es) => es.filter((x) => x.id !== e.id))}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <Input
            placeholder="Notas (opcional)"
            value={notes}
            onChange={(ev) => setNotes(ev.target.value)}
          />

          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal líneas</span>
              <span className="font-mono">{subtotal.toLocaleString('es-PY')}</span>
            </div>
            <div className="flex justify-between">
              <span>Extras</span>
              <span className="font-mono">{extrasTotal.toLocaleString('es-PY')}</span>
            </div>
            <div className="mt-1 flex justify-between border-t pt-1 font-medium">
              <span>Total ({currencyCode})</span>
              <span className="font-mono">{total.toLocaleString('es-PY')}</span>
            </div>
          </div>

          {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creando…' : 'Crear PO'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
