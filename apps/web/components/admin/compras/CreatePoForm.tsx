'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Check, Package, Plus, RotateCcw, Trash2, UserPlus, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  createPurchaseOrder,
  saveDraftPurchaseOrder,
  type DraftForEdit,
} from '@/lib/actions/purchase-order';
import type { Supplier } from '@frc-e-commerce/db/schema';
import type { PurchaseVariantOption } from '@/lib/actions/purchase-search';
import { VariantSearchPicker } from './VariantSearchPicker';
import { NewSupplierDialog } from './NewSupplierDialog';
import { NewProductInlineDialog } from './NewProductInlineDialog';
import {
  usePoDraft,
  useRelativeTime,
  type PoDraftExtra,
  type PoDraftLine,
} from './usePoDraft';

type Currency = { code: string; symbol: string; name: string };

type Line = PoDraftLine;
type ExtraDraft = PoDraftExtra;

const genId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const fmt = (n: number) => n.toLocaleString('es-PY');

export function CreatePoForm({
  suppliers: initialSuppliers,
  currencies,
  primaryCurrencyCode,
  draftScopeKey,
  initialDraft,
}: {
  suppliers: Supplier[];
  currencies: Currency[];
  primaryCurrencyCode: string;
  draftScopeKey: string;
  initialDraft: DraftForEdit | null;
}) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [pending, startTransition] = useTransition();
  const [draftSaving, setDraftSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(
    initialDraft?.id ?? null
  );
  const [currentPoNumber, setCurrentPoNumber] = useState<string | null>(
    initialDraft?.poNumber ?? null
  );
  const [dbDraftSavedAt, setDbDraftSavedAt] = useState<number | null>(null);

  const [supplierId, setSupplierId] = useState(
    initialDraft?.supplierId ?? initialSuppliers[0]?.id ?? ''
  );
  const [currencyCode, setCurrencyCode] = useState(
    initialDraft?.currencyCode ?? currencies[0]?.code ?? primaryCurrencyCode
  );
  const [notes, setNotes] = useState(initialDraft?.notes ?? '');
  const [lines, setLines] = useState<Line[]>(initialDraft?.lines ?? []);
  const [extras, setExtras] = useState<ExtraDraft[]>(initialDraft?.extras ?? []);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [newProductOpen, setNewProductOpen] = useState(false);
  const [newProductInitialName, setNewProductInitialName] = useState('');

  // Auto-save a localStorage (debounced 500ms). Si hay un draft en local al
  // montar, se ofrece recuperar via banner; no se aplica automáticamente.
  const { draftFound, lastSavedAt, save, clear, dismissBanner } = usePoDraft(draftScopeKey);
  const savedAgo = useRelativeTime(lastSavedAt);
  const dbSavedAgo = useRelativeTime(dbDraftSavedAt);

  // Dispara save cada vez que cambia algo relevante
  useEffect(() => {
    save({ supplierId, currencyCode, notes, lines, extras });
  }, [supplierId, currencyCode, notes, lines, extras, save]);

  const recoverDraft = () => {
    if (!draftFound) return;
    // Solo aplica supplierId si todavía existe en la lista actual
    if (draftFound.supplierId && suppliers.some((s) => s.id === draftFound.supplierId)) {
      setSupplierId(draftFound.supplierId);
    }
    setCurrencyCode(draftFound.currencyCode || currencyCode);
    setNotes(draftFound.notes || '');
    setLines(draftFound.lines || []);
    setExtras(draftFound.extras || []);
    dismissBanner();
  };

  const discardDraft = () => {
    clear();
  };

  const alreadyAddedIds = useMemo(
    () => new Set(lines.map((l) => l.variant.variantId)),
    [lines]
  );

  const addVariantsAsLines = (variants: PurchaseVariantOption[]) => {
    setLines((prev) => {
      const existing = new Map(prev.map((l) => [l.variant.variantId, l]));
      const next: Line[] = [...prev];
      for (const v of variants) {
        if (existing.has(v.variantId)) continue;
        const suggestedCost =
          v.lastUnitCost && v.lastUnitCost.currencyCode === currencyCode
            ? v.lastUnitCost.value
            : 0;
        next.push({
          id: genId(),
          variant: v,
          quantity: 1,
          unitCost: suggestedCost,
          sellPrice: null,
        });
      }
      return next;
    });
  };

  const subtotal = lines.reduce((acc, l) => acc + l.quantity * l.unitCost, 0);
  const extrasTotal = extras.reduce((acc, e) => acc + e.amount, 0);
  const total = subtotal + extrasTotal;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!supplierId) {
      setError('Elegí un proveedor');
      return;
    }
    if (lines.length === 0) {
      setError('Agregá al menos una variante al pedido');
      return;
    }
    if (lines.some((l) => l.quantity <= 0)) {
      setError('Todas las cantidades deben ser mayores a 0');
      return;
    }
    if (lines.some((l) => l.unitCost < 0)) {
      setError('Los costos no pueden ser negativos');
      return;
    }

    startTransition(async () => {
      const res = await createPurchaseOrder({
        supplierId,
        currencyCode,
        notes: notes.trim() || undefined,
        lines: lines.map((l) => ({
          variantId: l.variant.variantId,
          quantity: Math.floor(l.quantity),
          unitCostInCurrency: Math.floor(l.unitCost),
          sellPriceInPrimary:
            l.sellPrice != null && l.sellPrice >= 0 ? Math.floor(l.sellPrice) : undefined,
        })),
        extras: extras
          .filter((e) => e.amount > 0)
          .map((e) => ({
            description: e.description.trim() || 'Extra',
            amountInCurrency: Math.floor(e.amount),
            allocationStrategy: e.strategy,
          })),
        promoteFromDraftId: currentDraftId ?? undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      clear();
      router.push('/admin/compras');
      router.refresh();
    });
  };

  const handleSaveDraft = async () => {
    setError(null);
    if (!supplierId) {
      setError('Elegí un proveedor antes de guardar el borrador');
      return;
    }
    setDraftSaving(true);
    const res = await saveDraftPurchaseOrder({
      draftId: currentDraftId ?? undefined,
      supplierId,
      currencyCode,
      notes: notes.trim() || undefined,
      lines: lines.map((l) => ({
        variantId: l.variant.variantId,
        quantity: Math.max(1, Math.floor(l.quantity)),
        unitCostInCurrency: Math.max(0, Math.floor(l.unitCost)),
        sellPriceInPrimary:
          l.sellPrice != null && l.sellPrice >= 0 ? Math.floor(l.sellPrice) : undefined,
      })),
      extras: extras
        .filter((e) => e.amount > 0)
        .map((e) => ({
          description: e.description.trim() || 'Extra',
          amountInCurrency: Math.floor(e.amount),
          allocationStrategy: e.strategy,
        })),
    });
    setDraftSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Si era un draft nuevo, actualizo URL y guardo el id para próximas saves
    if (!currentDraftId) {
      setCurrentDraftId(res.draftId);
      setCurrentPoNumber(res.poNumber);
      // replace en lugar de push para no contaminar history
      router.replace(`/admin/compras/nueva?draftId=${res.draftId}`);
    }
    setDbDraftSavedAt(Date.now());
    // El localStorage queda como backup adicional pero el draft está seguro en DB
  };

  const draftSummary = draftFound
    ? `${draftFound.lines.length} ${draftFound.lines.length === 1 ? 'línea' : 'líneas'}${
        draftFound.lines.length > 0
          ? ` (${draftFound.lines.reduce((acc, l) => acc + (l.quantity || 0), 0)}u)`
          : ''
      }`
    : '';
  const draftDate = draftFound
    ? new Date(draftFound.savedAt).toLocaleString('es-PY', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short',
      })
    : '';

  // Cuando se está editando un draft de DB, el banner de "recuperar local" no
  // tiene sentido (el form ya fue hidratado del DB). Lo suprimimos.
  const showRecoverBanner = !initialDraft && draftFound;

  return (
    <>
      {showRecoverBanner && (
        <div className="flex flex-col items-start gap-2 rounded-md border-2 border-primary/40 bg-primary/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Tenés un borrador local sin guardar</p>
            <p className="text-xs text-muted-foreground">
              {draftDate} · {draftSummary}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={discardDraft}>
              <X className="mr-1 h-3.5 w-3.5" /> Descartar
            </Button>
            <Button type="button" size="sm" onClick={recoverDraft}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Recuperar
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {currentDraftId && (
            <div className="flex items-center gap-1">
              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span>
                Borrador <strong className="font-mono">{currentPoNumber}</strong> en DB
                {dbDraftSavedAt && <span className="ml-1">· {dbSavedAgo}</span>}
              </span>
            </div>
          )}
          {lastSavedAt && (
            <div className="flex items-center gap-1">
              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span>Backup local {savedAgo}</span>
            </div>
          )}
        </div>


        {/* Cabecera */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cabecera</CardTitle>
            <CardDescription>Proveedor y moneda de la compra.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="po-supplier">Proveedor</Label>
              <div className="flex gap-2">
                <Select
                  id="po-supplier"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="flex-1"
                >
                  {suppliers.length === 0 && <option value="">— sin proveedores —</option>}
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewSupplierOpen(true)}
                  title="Crear proveedor nuevo"
                >
                  <UserPlus className="mr-1 h-3.5 w-3.5" /> Nuevo
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="po-currency">Moneda</Label>
              <Select
                id="po-currency"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol}) — {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Líneas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Líneas ({lines.length})</CardTitle>
              <CardDescription>Variantes a comprar, con cantidad y costo unitario.</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Buscar / agregar variantes
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {lines.length === 0 ? (
              <div className="m-4 rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
                Aún no agregaste variantes. Hacé click en
                <strong className="mx-1 text-foreground">+ Buscar / agregar variantes</strong>
                para empezar.
              </div>
            ) : (
              <div className="border-y">
                <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <div className="w-8 shrink-0" />
                  <div className="flex-1">Producto</div>
                  <div className="w-16 shrink-0 text-right">Cant.</div>
                  <div className="w-28 shrink-0 text-right">Costo unit</div>
                  <div className="w-28 shrink-0 text-right">
                    Precio venta <span className="opacity-60">({primaryCurrencyCode})</span>
                  </div>
                  <div className="w-16 shrink-0 text-right" title="Margen sobre precio venta">
                    Margen
                  </div>
                  <div className="w-24 shrink-0 text-right">Subtotal</div>
                  <div className="w-7 shrink-0" />
                </div>
                <div className="divide-y">
                  {lines.map((line) => (
                    <LineRow
                      key={line.id}
                      line={line}
                      currencyCode={currencyCode}
                      primaryCurrencyCode={primaryCurrencyCode}
                      onChange={(patch) =>
                        setLines((prev) =>
                          prev.map((x) => (x.id === line.id ? { ...x, ...patch } : x))
                        )
                      }
                      onRemove={() => setLines((prev) => prev.filter((x) => x.id !== line.id))}
                    />
                  ))}
                </div>
                <p className="border-t bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground">
                  Tip: <strong>Tab</strong> o <strong>Enter</strong> salta cantidad → costo →
                  precio venta → próxima línea. El precio de venta solo se aplica al{' '}
                  <strong>recibir</strong> la PO; si lo dejás vacío, no se modifica.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Extras */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Gastos extras</CardTitle>
              <CardDescription>Flete, aduana, comisiones — se prorratean al recibir.</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setExtras((e) => [
                  ...e,
                  { id: genId(), description: '', amount: 0, strategy: 'cost' },
                ])
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Agregar extra
            </Button>
          </CardHeader>
          {extras.length > 0 && (
            <CardContent className="space-y-2">
              {extras.map((e) => (
                <div key={e.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                  <Input
                    value={e.description}
                    onChange={(ev) =>
                      setExtras((prev) =>
                        prev.map((x) => (x.id === e.id ? { ...x, description: ev.target.value } : x))
                      )
                    }
                    placeholder="Descripción (flete, aduana, etc.)"
                    className="h-9 text-sm"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={e.amount || ''}
                    onChange={(ev) =>
                      setExtras((prev) =>
                        prev.map((x) =>
                          x.id === e.id ? { ...x, amount: Number(ev.target.value) || 0 } : x
                        )
                      )
                    }
                    className="h-9 w-32 text-right text-sm"
                    placeholder="Monto"
                  />
                  <Select
                    value={e.strategy}
                    onChange={(ev) =>
                      setExtras((prev) =>
                        prev.map((x) =>
                          x.id === e.id
                            ? { ...x, strategy: ev.target.value as ExtraDraft['strategy'] }
                            : x
                        )
                      )
                    }
                    className="h-9 text-xs"
                  >
                    <option value="cost">Prop. al costo</option>
                    <option value="equal">Equitativo</option>
                    <option value="qty">Prop. a cantidad</option>
                    <option value="manual">Manual</option>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setExtras((prev) => prev.filter((x) => x.id !== e.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          )}
        </Card>

        {/* Notas + Totales */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1.5">
              <Label htmlFor="po-notes">Notas (opcional)</Label>
              <Input
                id="po-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Comentarios sobre la PO"
              />
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span>Subtotal líneas</span>
                <span className="font-mono">{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Extras</span>
                <span className="font-mono">{fmt(extrasTotal)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 text-base font-medium">
                <span>Total ({currencyCode})</span>
                <span className="font-mono">{fmt(total)}</span>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/admin/compras')}
                disabled={pending || draftSaving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleSaveDraft}
                disabled={pending || draftSaving || suppliers.length === 0}
                title="Guarda en DB como status='draft' (compartible, persistente, sin afectar stock)"
              >
                {draftSaving
                  ? 'Guardando…'
                  : currentDraftId
                    ? 'Actualizar borrador'
                    : 'Guardar como borrador'}
              </Button>
              <Button type="submit" disabled={pending || draftSaving || suppliers.length === 0}>
                {pending
                  ? 'Procesando…'
                  : currentDraftId
                    ? 'Confirmar orden (placed)'
                    : 'Crear orden'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <VariantSearchPicker
        open={pickerOpen}
        supplierId={supplierId || null}
        currencyCode={currencyCode}
        alreadyAddedIds={alreadyAddedIds}
        onClose={() => setPickerOpen(false)}
        onPick={(variants) => {
          addVariantsAsLines(variants);
          setPickerOpen(false);
        }}
        onRequestCreateProduct={(initialName) => {
          setNewProductInitialName(initialName);
          setPickerOpen(false);
          setNewProductOpen(true);
        }}
      />

      <NewSupplierDialog
        open={newSupplierOpen}
        onClose={() => setNewSupplierOpen(false)}
        onCreated={(supplier) => {
          setSuppliers((prev) => [supplier, ...prev]);
          setSupplierId(supplier.id);
          setNewSupplierOpen(false);
        }}
      />

      <NewProductInlineDialog
        open={newProductOpen}
        initialName={newProductInitialName}
        primaryCurrencyCode={primaryCurrencyCode}
        onClose={() => setNewProductOpen(false)}
        onCreated={(variants) => {
          addVariantsAsLines(variants);
          setNewProductOpen(false);
        }}
      />
    </>
  );
}

function focusNextPoInput(current: HTMLInputElement) {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('[data-po-input]')
  ).filter((el) => !el.disabled);
  const idx = inputs.indexOf(current);
  if (idx < 0) return;
  const next = inputs[idx + 1];
  if (next) {
    next.focus();
    next.select();
  } else {
    current.blur();
  }
}

function handlePoInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') {
    e.preventDefault();
    focusNextPoInput(e.currentTarget);
  }
}

function LineRow({
  line,
  currencyCode,
  primaryCurrencyCode,
  onChange,
  onRemove,
}: {
  line: Line;
  currencyCode: string;
  primaryCurrencyCode: string;
  onChange: (patch: Partial<Line>) => void;
  onRemove: () => void;
}) {
  const v = line.variant;

  // Sugerencias: solo aplicables si la currency matchea (último cost en misma currency, o avg en primary).
  const suggestions: Array<{ label: string; value: number; title: string }> = [];
  if (v.lastUnitCost && v.lastUnitCost.currencyCode === currencyCode) {
    const dateStr = v.lastUnitCost.receivedAt
      ? new Date(v.lastUnitCost.receivedAt).toLocaleDateString('es-PY', {
          day: '2-digit',
          month: 'short',
        })
      : '';
    suggestions.push({
      label: `${fmt(v.lastUnitCost.value)}`,
      value: v.lastUnitCost.value,
      title: `Último costo${dateStr ? ` (${dateStr})` : ''} — click para aplicar`,
    });
  }
  if (v.avgCostInPrimary > 0 && currencyCode === primaryCurrencyCode) {
    suggestions.push({
      label: `avg ${fmt(v.avgCostInPrimary)}`,
      value: v.avgCostInPrimary,
      title: 'Costo promedio ponderado — click para aplicar',
    });
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-sm">
      {v.imageUrl ? (
        <Image
          src={v.imageUrl}
          alt={v.productName}
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
          <Package className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1">
          <span className="truncate font-medium">{v.productName}</span>
          {v.color && (
            <span className="rounded border bg-secondary/40 px-1 py-0 text-[10px] font-medium">
              {v.color}
            </span>
          )}
          {v.size && (
            <span className="rounded border bg-primary/10 px-1 py-0 font-mono text-[10px] font-semibold text-primary">
              {v.size}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] text-muted-foreground">
          <span className="truncate">{v.sku}</span>
          <span>Stock: {fmt(v.currentStock)}</span>
        </div>
      </div>

      <Input
        type="number"
        min={1}
        value={line.quantity}
        onChange={(e) => onChange({ quantity: Number(e.target.value) || 0 })}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={handlePoInputKeyDown}
        data-po-input="qty"
        aria-label="Cantidad"
        className="h-8 w-16 shrink-0 text-right font-mono text-sm"
      />

      <div className="flex shrink-0 flex-col items-stretch gap-0.5">
        <Input
          type="number"
          min={0}
          value={line.unitCost || ''}
          onChange={(e) => onChange({ unitCost: Number(e.target.value) || 0 })}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={handlePoInputKeyDown}
          data-po-input="cost"
          aria-label={`Costo unitario en ${currencyCode}`}
          placeholder={`Costo ${currencyCode}`}
          className="h-8 w-28 text-right font-mono text-sm"
        />
        {suggestions.length > 0 && (
          <div className="flex justify-end gap-1">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onChange({ unitCost: s.value })}
                title={s.title}
                className="rounded bg-muted/40 px-1 py-0 text-[10px] text-muted-foreground hover:bg-muted hover:text-primary"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <SellPriceCell
        line={line}
        currencyCode={currencyCode}
        primaryCurrencyCode={primaryCurrencyCode}
        onChange={onChange}
      />

      <MarginCell
        line={line}
        currencyCode={currencyCode}
        primaryCurrencyCode={primaryCurrencyCode}
      />

      <div className="w-24 shrink-0 text-right font-mono text-sm">
        {fmt(line.quantity * line.unitCost)}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-destructive"
        onClick={onRemove}
        title="Quitar línea"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

/** Input de precio de venta. Vacío = no cambiar (null). Setea sellPrice en la línea. */
function SellPriceCell({
  line,
  currencyCode,
  primaryCurrencyCode,
  onChange,
}: {
  line: Line;
  currencyCode: string;
  primaryCurrencyCode: string;
  onChange: (patch: Partial<Line>) => void;
}) {
  const v = line.variant;
  const current = v.currentSellPrice;
  // El input usa "" cuando sellPrice es null para distinguir "sin cambio" de "0"
  const inputValue = line.sellPrice == null ? '' : String(line.sellPrice);
  const hasNewPrice = line.sellPrice != null && line.sellPrice !== current;
  const sameCurrency = currencyCode === primaryCurrencyCode;

  return (
    <div className="flex shrink-0 flex-col items-stretch gap-0.5">
      <Input
        type="number"
        min={0}
        value={inputValue}
        onChange={(e) =>
          onChange({
            sellPrice: e.target.value === '' ? null : Number(e.target.value) || 0,
          })
        }
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={handlePoInputKeyDown}
        data-po-input="sellPrice"
        aria-label={`Precio de venta en ${primaryCurrencyCode}`}
        placeholder="(sin cambio)"
        title={
          sameCurrency
            ? 'Si lo dejás vacío, el precio actual no se modifica al recibir.'
            : `Precio en ${primaryCurrencyCode} — moneda primary del tenant.`
        }
        className={`h-8 w-28 text-right font-mono text-sm ${
          hasNewPrice ? 'border-primary/60' : ''
        }`}
      />
      {current > 0 && (
        <div className="flex justify-end text-[10px] text-muted-foreground">
          {hasNewPrice ? (
            <span className="font-mono">
              <span className="line-through opacity-60">{fmt(current)}</span>
              <span className="mx-0.5">→</span>
              <span className="font-semibold text-primary">{fmt(line.sellPrice!)}</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onChange({ sellPrice: current })}
              title="Aplicar precio actual (lo hace explícito en la PO)"
              className="rounded bg-muted/40 px-1 py-0 hover:bg-muted hover:text-primary"
            >
              actual: <span className="font-mono">{fmt(current)}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Indicador visual de margen sobre precio venta. */
function MarginCell({
  line,
  currencyCode,
  primaryCurrencyCode,
}: {
  line: Line;
  currencyCode: string;
  primaryCurrencyCode: string;
}) {
  // Margen solo computable cuando la PO está en moneda primary (costo y precio en misma unidad).
  if (currencyCode !== primaryCurrencyCode) {
    return (
      <div
        className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground"
        title="No se puede calcular: la PO está en moneda distinta a primary"
      >
        —
      </div>
    );
  }

  // Precio efectivo: el nuevo si fue setado, sino el actual del producto
  const price = line.sellPrice != null ? line.sellPrice : line.variant.currentSellPrice;
  const cost = line.unitCost;

  if (price <= 0 || cost <= 0) {
    return (
      <div
        className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground"
        title="Cargá costo y precio para ver el margen"
      >
        —
      </div>
    );
  }

  const marginPct = ((price - cost) / price) * 100;
  const tone =
    marginPct < 0
      ? 'text-destructive'
      : marginPct < 20
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-emerald-700 dark:text-emerald-400';
  const label = `${marginPct.toFixed(0)}%`;

  return (
    <div
      className={`w-16 shrink-0 text-right font-mono text-sm ${tone}`}
      title={`Margen ${marginPct.toFixed(1)}% sobre precio venta · costo ${fmt(cost)} / venta ${fmt(price)}`}
    >
      {label}
    </div>
  );
}
