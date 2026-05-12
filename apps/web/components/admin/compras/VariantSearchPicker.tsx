'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { ChevronDown, ChevronRight, Loader2, Package, Plus, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  searchVariantsForPurchase,
  type PurchaseVariantOption,
} from '@/lib/actions/purchase-search';
import { formatAmount, formatNumber } from '@frc-e-commerce/shared-utils';

type Props = {
  open: boolean;
  supplierId: string | null;
  currencyCode: string;
  /** IDs ya en la PO (para mostrar checkmark "ya agregada" en lugar de checkbox). */
  alreadyAddedIds: Set<string>;
  onClose: () => void;
  onPick: (variants: PurchaseVariantOption[]) => void;
  onRequestCreateProduct: (initialName: string) => void;
};

const DEBOUNCE_MS = 200;
const fmt = (n: number) => formatNumber(n, 0);

export function VariantSearchPicker({
  open,
  supplierId,
  currencyCode,
  alreadyAddedIds,
  onClose,
  onPick,
  onRequestCreateProduct,
}: Props) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<PurchaseVariantOption[]>([]);
  const [pending, startTransition] = useTransition();
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Búsqueda al cambiar query debounced o supplier/currency — siempre desde offset 0
  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      setError(null);
      const res = await searchVariantsForPurchase({
        query: debounced,
        supplierId: supplierId ?? undefined,
        currencyCode,
        limit: 20,
        offset: 0,
      });
      if (res.ok) {
        setResults(res.results);
        setHasMore(res.hasMore);
      } else {
        setError(res.error);
        setResults([]);
        setHasMore(false);
      }
    });
  }, [debounced, supplierId, currencyCode, open]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const res = await searchVariantsForPurchase({
      query: debounced,
      supplierId: supplierId ?? undefined,
      currencyCode,
      limit: 20,
      offset: results.length,
    });
    setLoadingMore(false);
    if (res.ok) {
      // Dedupe por variantId por si el orden de DB cambió entre páginas
      setResults((prev) => {
        const have = new Set(prev.map((v) => v.variantId));
        return [...prev, ...res.results.filter((v) => !have.has(v.variantId))];
      });
      setHasMore(res.hasMore);
    } else {
      setError(res.error);
    }
  };

  // Auto-foco + reset al abrir
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(new Set());
      setHasMore(false);
      // Delay para que el dialog termine de montar
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const toggleVariant = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const picked = results.filter((v) => selected.has(v.variantId));
    if (picked.length === 0) return;
    onPick(picked);
    setSelected(new Set());
  };

  const selectedCount = selected.size;
  const showEmpty = !pending && results.length === 0;
  const hasQuery = debounced.trim().length >= 2;

  // Agrupa los resultados por producto preservando orden de aparición.
  type ProductGroup = {
    productId: string;
    productName: string;
    imageUrl: string | null;
    variants: PurchaseVariantOption[];
  };
  const groups = useMemo<ProductGroup[]>(() => {
    const map = new Map<string, ProductGroup>();
    for (const v of results) {
      let g = map.get(v.productId);
      if (!g) {
        g = {
          productId: v.productId,
          productName: v.productName,
          imageUrl: v.imageUrl,
          variants: [],
        };
        map.set(v.productId, g);
      } else if (!g.imageUrl && v.imageUrl) {
        g.imageUrl = v.imageUrl;
      }
      g.variants.push(v);
    }
    return Array.from(map.values());
  }, [results]);

  // Estado de expansión por productId
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Auto-expansión: cuando hay query, expandir todos. Sin query → colapsado.
  useEffect(() => {
    if (hasQuery && groups.length > 0) {
      setExpanded(new Set(groups.map((g) => g.productId)));
    } else if (!hasQuery) {
      setExpanded(new Set());
    }
  }, [hasQuery, groups]);

  const toggleGroup = (productId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const toggleAllInGroup = (group: ProductGroup) => {
    setSelected((prev) => {
      const next = new Set(prev);
      // Si todas (no ya-agregadas) están seleccionadas → des-seleccionar todas
      const selectable = group.variants.filter((v) => !alreadyAddedIds.has(v.variantId));
      const allSelected =
        selectable.length > 0 && selectable.every((v) => next.has(v.variantId));
      if (allSelected) {
        for (const v of selectable) next.delete(v.variantId);
      } else {
        for (const v of selectable) next.add(v.variantId);
      }
      return next;
    });
  };

  const groupStats = (g: ProductGroup) => {
    const totalStock = g.variants.reduce((acc, v) => acc + (v.currentStock || 0), 0);
    const selectableCount = g.variants.filter((v) => !alreadyAddedIds.has(v.variantId)).length;
    const selectedCountInGroup = g.variants.filter((v) => selected.has(v.variantId)).length;
    return { totalStock, selectableCount, selectedCountInGroup };
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>Agregar variantes al pedido</DialogTitle>
          <DialogDescription>
            Buscá por SKU, nombre del producto o color. Las archivadas no aparecen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Buscar SKU, nombre o color…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 pl-9"
            />
            {pending && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {query.trim() === '' && !pending && results.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Mostrando los <strong>{results.length}</strong> más comprados de los últimos 90 días.
            </p>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="max-h-[50vh] overflow-y-auto rounded-md border">
            {showEmpty ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
                <Package className="h-8 w-8 opacity-50" />
                <p>
                  {hasQuery
                    ? `No encontramos resultados para "${debounced}"`
                    : 'Sin resultados.'}
                </p>
                {hasQuery && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onRequestCreateProduct(debounced)}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Crear producto nuevo
                  </Button>
                )}
              </div>
            ) : (
              <ul className="divide-y">
                {groups.map((g) => {
                  const isExpanded = expanded.has(g.productId);
                  const { totalStock, selectableCount, selectedCountInGroup } = groupStats(g);
                  const allSelected =
                    selectableCount > 0 && selectedCountInGroup === selectableCount;
                  return (
                    <li key={g.productId}>
                      {/* Header del grupo */}
                      <div
                        className={`flex items-center gap-3 px-3 py-2 transition-colors ${
                          isExpanded ? 'bg-muted/30' : 'hover:bg-muted/40'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleGroup(g.productId)}
                          className="flex flex-1 items-center gap-3 text-left"
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          {g.imageUrl ? (
                            <Image
                              src={g.imageUrl}
                              alt={g.productName}
                              width={36}
                              height={36}
                              className="h-9 w-9 shrink-0 rounded object-cover"
                            />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-muted">
                              <Package className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium">{g.productName}</div>
                            <div className="text-xs text-muted-foreground">
                              {g.variants.length}{' '}
                              {g.variants.length === 1 ? 'variante' : 'variantes'}
                              {' · stock '}
                              <strong className="text-foreground">{fmt(totalStock)}</strong>
                              {selectedCountInGroup > 0 && (
                                <span className="ml-2 text-primary">
                                  {selectedCountInGroup} seleccionada
                                  {selectedCountInGroup === 1 ? '' : 's'}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                        {selectableCount > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleAllInGroup(g)}
                            className={`shrink-0 rounded border px-2 py-1 text-xs transition-colors ${
                              allSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border hover:border-primary hover:text-primary'
                            }`}
                            title={allSelected ? 'Deseleccionar todas' : 'Seleccionar todas'}
                          >
                            {allSelected ? '✓ Todas' : '+ Todas'}
                          </button>
                        )}
                      </div>

                      {/* Variantes del grupo */}
                      {isExpanded && (
                        <ul className="divide-y border-t bg-background/40">
                          {g.variants.map((v) => {
                            const isSelected = selected.has(v.variantId);
                            const isAlready = alreadyAddedIds.has(v.variantId);
                            const disabled = isAlready;
                            return (
                              <li key={v.variantId}>
                                <button
                                  type="button"
                                  onClick={() => !disabled && toggleVariant(v.variantId)}
                                  disabled={disabled}
                                  className={`flex w-full items-start gap-3 py-1.5 pl-12 pr-3 text-left transition-colors ${
                                    disabled
                                      ? 'cursor-not-allowed opacity-50'
                                      : isSelected
                                        ? 'bg-primary/10 hover:bg-primary/15'
                                        : 'hover:bg-muted/40'
                                  }`}
                                >
                                  <div
                                    className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                      isSelected
                                        ? 'border-primary bg-primary text-primary-foreground'
                                        : disabled
                                          ? 'border-muted-foreground/30 bg-muted'
                                          : 'border-border'
                                    }`}
                                  >
                                    {(isSelected || isAlready) && (
                                      <svg
                                        viewBox="0 0 16 16"
                                        className="h-3 w-3 fill-none stroke-current stroke-[2.5]"
                                      >
                                        <path
                                          d="M3 8l3.5 3.5L13 5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {v.color && (
                                        <span className="rounded border bg-secondary/40 px-1.5 py-0.5 text-xs font-medium">
                                          {v.color}
                                        </span>
                                      )}
                                      {v.size && (
                                        <span className="rounded border bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
                                          {v.size}
                                        </span>
                                      )}
                                      <span className="font-mono text-xs text-muted-foreground">
                                        {v.sku}
                                      </span>
                                      {isAlready && (
                                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                          Ya agregada
                                        </span>
                                      )}
                                    </div>
                                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                                      <span>
                                        Stock:{' '}
                                        <strong className="text-foreground">
                                          {fmt(v.currentStock)}
                                        </strong>
                                      </span>
                                      {v.avgCostInPrimary > 0 && (
                                        <span>
                                          Avg:{' '}
                                          <strong className="text-foreground">
                                            {fmt(v.avgCostInPrimary)}
                                          </strong>
                                        </span>
                                      )}
                                      {v.lastUnitCost && (
                                        <span>
                                          Último:{' '}
                                          <strong className="text-foreground">
                                            {formatAmount(v.lastUnitCost.value, v.lastUnitCost.currencyCode)}
                                          </strong>
                                          {v.lastUnitCost.receivedAt && (
                                            <span className="text-muted-foreground/70">
                                              {' '}
                                              ·{' '}
                                              {new Date(v.lastUnitCost.receivedAt).toLocaleDateString(
                                                'es-PY',
                                                { day: '2-digit', month: 'short' }
                                              )}
                                            </span>
                                          )}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {hasMore && (
              <div className="border-t bg-muted/20 px-3 py-2 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={loadMore}
                  disabled={loadingMore || pending}
                  className="text-xs"
                >
                  {loadingMore ? 'Cargando…' : 'Cargar más resultados'}
                </Button>
              </div>
            )}
          </div>

          {!showEmpty && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                {results.length} {results.length === 1 ? 'variante' : 'variantes'} en{' '}
                {groups.length} {groups.length === 1 ? 'producto' : 'productos'}
                {hasMore && ' (hay más — refiná o "Cargar más")'}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRequestCreateProduct(query.trim())}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Crear producto nuevo
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={pending || selectedCount === 0}>
            {selectedCount === 0
              ? 'Agregar al pedido'
              : `Agregar ${selectedCount} ${selectedCount === 1 ? 'variante' : 'variantes'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
