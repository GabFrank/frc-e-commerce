'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Minus, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { bulkCreateVariantsByMatrix } from '@/lib/actions/product';
import { ADULT_SIZES, KIDS_SIZES, type SizeKind } from '@/lib/clothing/sizes';

type Props = {
  open: boolean;
  productId: string;
  /** Catálogo derivado del género del producto — se usa como default del toggle Adulto/Infantil. */
  sizeCatalog: { kind: SizeKind; values: readonly string[] };
  knownColors: string[];
  onClose: () => void;
};

type Override = { price?: number; stock?: number };

const SIZE_CATALOGS: Record<SizeKind, readonly string[]> = {
  letter_adult: ADULT_SIZES,
  number_kids: KIDS_SIZES,
};

export function MatrixVariantDialog({
  open,
  productId,
  sizeCatalog,
  knownColors,
  onClose,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [sizeKind, setSizeKind] = useState<SizeKind>(sizeCatalog.kind);
  const sizeValues = SIZE_CATALOGS[sizeKind];

  const [colors, setColors] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [colorInput, setColorInput] = useState('');
  const [basePrice, setBasePrice] = useState(0);
  const [baseStock, setBaseStock] = useState(0);
  const [skuPrefix, setSkuPrefix] = useState('');

  const [advanced, setAdvanced] = useState(false);
  const [expandedColors, setExpandedColors] = useState<Set<string>>(new Set());
  // key = `${color}||${size}` → override values
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  // key = `${color}||${size}` → excluida de la generación
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const reset = () => {
    setSizeKind(sizeCatalog.kind);
    setColors([]);
    setSizes([]);
    setColorInput('');
    setBasePrice(0);
    setBaseStock(0);
    setSkuPrefix('');
    setAdvanced(false);
    setExpandedColors(new Set());
    setOverrides({});
    setExcluded(new Set());
    setError(null);
  };

  // Al cambiar de Adulto/Infantil limpio talles seleccionados (los códigos no se solapan, pero por claridad).
  useEffect(() => {
    setSizes([]);
    setOverrides({});
    setExcluded(new Set());
  }, [sizeKind]);

  const addColor = (raw: string) => {
    const c = raw.trim();
    if (!c) return;
    if (colors.some((x) => x.toLowerCase() === c.toLowerCase())) {
      setColorInput('');
      return;
    }
    setColors((prev) => [...prev, c]);
    setColorInput('');
  };

  const toggleSize = (s: string) => {
    setSizes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const grossCombinations =
    Math.max(colors.length, 1) * Math.max(sizes.length, 1) -
    (colors.length === 0 && sizes.length === 0 ? 1 : 0);

  // Exclusiones sólo aplican cuando hay matriz real (≥1 color y ≥1 talle); si no, ignoradas.
  const validExclusions = useMemo(() => {
    if (colors.length === 0 || sizes.length === 0) return 0;
    let n = 0;
    for (const c of colors) for (const s of sizes) if (excluded.has(`${c}||${s}`)) n += 1;
    return n;
  }, [colors, sizes, excluded]);

  const totalCombinations = grossCombinations - validExclusions;

  const overrideCount = useMemo(
    () =>
      Object.entries(overrides).filter(([key, o]) => {
        if (excluded.has(key)) return false;
        return o.price !== undefined || o.stock !== undefined;
      }).length,
    [overrides, excluded]
  );

  const isExcluded = (color: string, size: string) => excluded.has(`${color}||${size}`);

  const toggleExclude = (color: string, size: string) => {
    const key = `${color}||${size}`;
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const updateOverride = (color: string, size: string, patch: Partial<Override>) => {
    const key = `${color}||${size}`;
    setOverrides((prev) => {
      const next = { ...prev };
      const merged = { ...(prev[key] ?? {}), ...patch };
      if (merged.price === undefined && merged.stock === undefined) {
        delete next[key];
      } else {
        next[key] = merged;
      }
      return next;
    });
  };

  const removeOverride = (color: string, size: string) => {
    const key = `${color}||${size}`;
    setOverrides((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const isOverrideActive = (color: string, size: string) =>
    Boolean(overrides[`${color}||${size}`]);

  /** Copia los precios/stocks overrideados de este color a los otros colores, misma talla. */
  const applyColorToAll = (sourceColor: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      for (const size of sizes) {
        const src = prev[`${sourceColor}||${size}`];
        if (!src) continue;
        for (const targetColor of colors) {
          if (targetColor === sourceColor) continue;
          next[`${targetColor}||${size}`] = { ...src };
        }
      }
      return next;
    });
  };

  const toggleExpand = (color: string) => {
    setExpandedColors((prev) => {
      const next = new Set(prev);
      if (next.has(color)) next.delete(color);
      else next.add(color);
      return next;
    });
  };

  const handleConfirm = () => {
    // Auto-commit del color pendiente en el input para no perderlo si el usuario olvidó Enter
    const pending = colorInput.trim();
    const colorsEffective =
      pending && !colors.some((x) => x.toLowerCase() === pending.toLowerCase())
        ? [...colors, pending]
        : colors;
    if (pending) {
      setColors(colorsEffective);
      setColorInput('');
    }

    if (colorsEffective.length === 0 && sizes.length === 0) {
      setError('Indicá al menos un color o un talle');
      return;
    }
    const totalEff =
      Math.max(colorsEffective.length, 1) * Math.max(sizes.length, 1) -
      (colorsEffective.length === 0 && sizes.length === 0 ? 1 : 0) -
      validExclusions;
    if (totalEff <= 0) {
      setError('Excluiste todas las combinaciones — no hay nada para crear');
      return;
    }
    setError(null);

    const overridesPayload = advanced
      ? Object.entries(overrides).flatMap(([key, val]) => {
          if (excluded.has(key)) return [];
          const [c, s] = key.split('||');
          if (val.price === undefined && val.stock === undefined) return [];
          return [
            {
              color: c || null,
              size: s || null,
              ...(val.price !== undefined && { price: Math.max(0, Math.floor(val.price)) }),
              ...(val.stock !== undefined && { stock: Math.max(0, Math.floor(val.stock)) }),
            },
          ];
        })
      : undefined;

    const excludePayload =
      colorsEffective.length > 0 && sizes.length > 0 && excluded.size > 0
        ? Array.from(excluded).flatMap((key) => {
            const [c, s] = key.split('||');
            if (!c || !s) return [];
            // Sólo enviamos las exclusiones que pertenezcan a colores/talles actualmente seleccionados.
            if (!colorsEffective.includes(c) || !sizes.includes(s)) return [];
            return [{ color: c, size: s }];
          })
        : undefined;

    startTransition(async () => {
      const res = await bulkCreateVariantsByMatrix({
        productId,
        colors: colorsEffective,
        sizes,
        sizeKind: sizes.length > 0 ? sizeKind : null,
        basePrice: Math.max(0, Math.floor(basePrice)),
        baseStock: Math.max(0, Math.floor(baseStock)),
        skuPrefix: skuPrefix.trim() || undefined,
        overrides: overridesPayload,
        exclude: excludePayload,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Solo avisamos cuando hubo SKUs duplicados (un evento inesperado para el usuario).
      // Las exclusiones explícitas ya están reflejadas visualmente en la grilla.
      if (res.duplicatesSkipped > 0) {
        alert(
          `Variantes creadas: ${res.created}. ${res.duplicatesSkipped} omitidas por SKU duplicado con variantes existentes en el catálogo.\nProbá un prefix SKU distinto si querés que esos combos se generen.`
        );
      }
      reset();
      onClose();
      router.refresh();
    });
  };

  const knownColorsFiltered = useMemo(
    () => knownColors.filter((c) => !colors.some((x) => x.toLowerCase() === c.toLowerCase())),
    [knownColors, colors]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generar matriz de variantes</DialogTitle>
          <DialogDescription>
            Combiná colores × talles para crear todas las variantes en un paso. Las
            duplicadas se omiten silenciosamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Colores */}
          <div className="space-y-1.5">
            <Label>Colores</Label>
            {colors.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {colors.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 rounded-md border bg-primary/10 px-2 py-1 text-xs font-medium"
                  >
                    {c}
                    <button
                      type="button"
                      onClick={() => setColors((prev) => prev.filter((x) => x !== c))}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Quitar ${c}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                list="matrix-known-colors"
                placeholder="Escribí un color y presioná Enter"
                value={colorInput}
                onChange={(e) => setColorInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addColor(colorInput);
                  }
                }}
                onBlur={() => {
                  if (colorInput.trim()) addColor(colorInput);
                }}
                disabled={pending}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addColor(colorInput)}
              >
                + Agregar
              </Button>
            </div>
            {knownColorsFiltered.length > 0 && (
              <datalist id="matrix-known-colors">
                {knownColorsFiltered.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            )}
          </div>

          {/* Toggle Adulto / Infantil */}
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <button
              type="button"
              onClick={() => setSizeKind('letter_adult')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                sizeKind === 'letter_adult'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Adulto (XS–XXXL)
            </button>
            <button
              type="button"
              onClick={() => setSizeKind('number_kids')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                sizeKind === 'number_kids'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Infantil (2–16)
            </button>
          </div>

          {/* Talles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Talles</Label>
              {sizes.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  Seleccionados:{' '}
                  <span className="font-mono font-semibold text-foreground">
                    {sizes.join(', ')}
                  </span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sizeValues.map((s) => {
                const active = sizes.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSize(s)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-mono transition-all ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground ring-2 ring-primary/40 scale-105'
                        : 'border-border hover:border-primary hover:text-primary'
                    }`}
                    disabled={pending}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Combinaciones a crear (con exclusión por celda) */}
          {colors.length > 0 && sizes.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Combinaciones a crear</Label>
                {validExclusions > 0 && (
                  <button
                    type="button"
                    onClick={() => setExcluded(new Set())}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Restaurar {validExclusions} excluida{validExclusions === 1 ? '' : 's'}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {colors.flatMap((color) =>
                  sizes.map((size) => {
                    const out = isExcluded(color, size);
                    return (
                      <button
                        key={`${color}||${size}`}
                        type="button"
                        onClick={() => toggleExclude(color, size)}
                        title={out ? 'Click para incluir' : 'Click para excluir'}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                          out
                            ? 'border-dashed border-muted-foreground/40 bg-muted/30 text-muted-foreground line-through'
                            : 'border-primary/40 bg-primary/10 hover:border-destructive/60 hover:text-destructive'
                        }`}
                        disabled={pending}
                      >
                        <span>
                          {color} · <span className="font-mono font-semibold">{size}</span>
                        </span>
                        {out ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                      </button>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Click en una combinación para excluirla; volvé a hacer click para restaurarla.
              </p>
            </div>
          )}

          {/* Precio / stock base + SKU */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="matrix-price">Precio base</Label>
              <Input
                id="matrix-price"
                type="number"
                min={0}
                value={basePrice || ''}
                onChange={(e) => setBasePrice(Number(e.target.value))}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="matrix-stock">Stock por variante</Label>
              <Input
                id="matrix-stock"
                type="number"
                min={0}
                value={baseStock || ''}
                onChange={(e) => setBaseStock(Number(e.target.value))}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="matrix-prefix">Prefix SKU (opcional)</Label>
              <Input
                id="matrix-prefix"
                placeholder="Auto desde slug"
                value={skuPrefix}
                onChange={(e) => setSkuPrefix(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>

          {/* Precio avanzado */}
          {colors.length > 0 && sizes.length > 0 && (
            <div
              className={`rounded-md border-2 p-3 transition-colors ${
                advanced ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/20'
              }`}
            >
              <label
                htmlFor="advanced-pricing"
                className="flex cursor-pointer items-center justify-between"
              >
                <div>
                  <span className="text-sm font-medium">Precio avanzado por variante</span>
                  <p className="text-xs text-muted-foreground">
                    Override de precio y/o stock por color × talle. Lo que no overrideas usa el base.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium ${
                      advanced ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {advanced ? 'ON' : 'OFF'}
                  </span>
                  <Switch
                    id="advanced-pricing"
                    checked={advanced}
                    onCheckedChange={setAdvanced}
                    disabled={pending}
                    className="border border-border data-[state=unchecked]:bg-muted-foreground/30"
                  />
                </div>
              </label>

              {advanced && (
                <div className="mt-3 space-y-2">
                  {colors.map((color) => {
                    const isOpen = expandedColors.has(color);
                    const overridesInColor = sizes.filter((s) => isOverrideActive(color, s)).length;
                    return (
                      <div key={color} className="rounded-md border bg-background">
                        <button
                          type="button"
                          onClick={() => toggleExpand(color)}
                          className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted/40"
                        >
                          <span className="flex items-center gap-2">
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <span className="font-medium">{color}</span>
                            {overridesInColor > 0 && (
                              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                                {overridesInColor} override
                                {overridesInColor === 1 ? '' : 's'}
                              </span>
                            )}
                          </span>
                          {isOpen && colors.length > 1 && overridesInColor > 0 && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                applyColorToAll(color);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  applyColorToAll(color);
                                }
                              }}
                              className="rounded border border-border px-2 py-0.5 text-xs hover:bg-primary hover:text-primary-foreground"
                            >
                              Aplicar a otros colores
                            </span>
                          )}
                        </button>

                        {isOpen && (
                          <div className="border-t px-3 py-2 space-y-1.5">
                            {sizes.map((size) => {
                              const active = isOverrideActive(color, size);
                              const out = isExcluded(color, size);
                              const ov = overrides[`${color}||${size}`];
                              return (
                                <div
                                  key={size}
                                  className={`grid grid-cols-[auto_auto_1fr_1fr] items-center gap-2 ${
                                    out ? 'opacity-50' : ''
                                  }`}
                                >
                                  <input
                                    id={`ov-${color}-${size}`}
                                    type="checkbox"
                                    checked={active && !out}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        updateOverride(color, size, {
                                          price: basePrice,
                                          stock: baseStock,
                                        });
                                      } else {
                                        removeOverride(color, size);
                                      }
                                    }}
                                    disabled={out || pending}
                                    className="h-4 w-4 accent-primary"
                                  />
                                  <label
                                    htmlFor={`ov-${color}-${size}`}
                                    className={`min-w-[2.5rem] cursor-pointer font-mono text-sm ${
                                      out ? 'line-through' : ''
                                    }`}
                                  >
                                    {size}
                                  </label>
                                  <Input
                                    type="number"
                                    min={0}
                                    placeholder={`Precio (${basePrice || 0})`}
                                    value={ov?.price ?? ''}
                                    disabled={!active || out || pending}
                                    onChange={(e) =>
                                      updateOverride(color, size, {
                                        price: e.target.value === '' ? undefined : Number(e.target.value),
                                      })
                                    }
                                    className="h-8 text-sm"
                                  />
                                  <Input
                                    type="number"
                                    min={0}
                                    placeholder={`Stock (${baseStock || 0})`}
                                    value={ov?.stock ?? ''}
                                    disabled={!active || out || pending}
                                    onChange={(e) =>
                                      updateOverride(color, size, {
                                        stock: e.target.value === '' ? undefined : Number(e.target.value),
                                      })
                                    }
                                    className="h-8 text-sm"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
            Se crearán <strong>{totalCombinations}</strong>{' '}
            {totalCombinations === 1 ? 'variante' : 'variantes'} ({colors.length || 1} ×{' '}
            {sizes.length || 1}
            {validExclusions > 0 && (
              <>
                {' '}
                − <strong>{validExclusions}</strong> excluida{validExclusions === 1 ? '' : 's'}
              </>
            )}
            )
            {advanced && overrideCount > 0 && (
              <>
                {' '}
                — <strong>{overrideCount}</strong> con precio/stock personalizado
              </>
            )}
            .
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={pending}>
            {pending ? 'Generando…' : 'Generar variantes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
