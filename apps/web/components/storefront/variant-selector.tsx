'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils/cn';

export interface VariantOption {
  id: string;
  sku: string;
  name: string;
  stock: number;
  /** Precio del variante en la unidad mínima de la moneda */
  price: number;
  /** Color canónico (texto libre) o null. */
  color?: string | null;
  /** Talle canónico ('M', '10', etc.) o null. */
  size?: string | null;
  /** Padrón del talle: 'letter_adult' | 'number_kids' */
  sizeKind?: string | null;
  attributes?: Record<string, string>;
}

interface VariantSelectorProps {
  variants: VariantOption[];
  onVariantChange: (variantId: string, qty: number) => void;
}

export function VariantSelector({ variants, onVariantChange }: VariantSelectorProps) {
  const colors = useMemo(() => {
    const set = new Set<string>();
    for (const v of variants) if (v.color) set.add(v.color);
    return Array.from(set);
  }, [variants]);

  const initial = variants[0];
  const [selectedColor, setSelectedColor] = useState<string | null>(initial?.color ?? null);
  const [selectedId, setSelectedId] = useState<string>(initial?.id ?? '');
  const [qty, setQty] = useState(1);

  // Variantes filtradas por color seleccionado (o todas si no hay colores)
  const variantsForColor = useMemo(() => {
    if (colors.length === 0) return variants;
    return variants.filter((v) => (v.color ?? null) === selectedColor);
  }, [variants, colors, selectedColor]);

  // selectedId efectivo: si el seleccionado actual no está en el color actual,
  // usamos el primero del color sin disparar setState.
  const effectiveSelectedId =
    variantsForColor.find((v) => v.id === selectedId)?.id ?? variantsForColor[0]?.id ?? '';

  const selected = variants.find((v) => v.id === effectiveSelectedId);
  const maxStock = selected?.stock ?? 0;

  const handleSelectColor = (color: string) => {
    setSelectedColor(color);
    const next = variants.find((v) => v.color === color);
    if (next) {
      setSelectedId(next.id);
      setQty(1);
      onVariantChange(next.id, 1);
    }
  };

  const handleSelectVariant = (id: string) => {
    setSelectedId(id);
    setQty(1);
    onVariantChange(id, 1);
  };

  const handleQtyChange = (next: number) => {
    const clamped = Math.max(1, Math.min(next, maxStock));
    setQty(clamped);
    onVariantChange(effectiveSelectedId, clamped);
  };

  if (variants.length === 0) return null;

  return (
    <div className="space-y-4">
      {colors.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium">Color</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleSelectColor(c)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm transition-colors',
                  selectedColor === c
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:border-primary hover:text-primary'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {variantsForColor.length > 1 && (
        <div>
          <p className="mb-2 text-sm font-medium">
            {variantsForColor.some((v) => v.size) ? 'Talle' : 'Variante'}
          </p>
          <div className="flex flex-wrap gap-2">
            {variantsForColor.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => handleSelectVariant(v.id)}
                disabled={v.stock === 0}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm transition-colors',
                  v.stock === 0 && 'cursor-not-allowed opacity-40 line-through',
                  effectiveSelectedId === v.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:border-primary hover:text-primary'
                )}
              >
                {v.size ? (
                  <span className="font-mono font-semibold">{v.size}</span>
                ) : (
                  v.name
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div>
          <p className="mb-2 text-sm font-medium">Cantidad</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleQtyChange(qty - 1)}
              disabled={qty <= 1}
              className="flex h-8 w-8 items-center justify-center rounded border text-sm disabled:opacity-40 hover:bg-muted/50 transition-colors"
              aria-label="Disminuir cantidad"
            >
              -
            </button>
            <span className="w-10 text-center text-sm font-medium">{qty}</span>
            <button
              type="button"
              onClick={() => handleQtyChange(qty + 1)}
              disabled={qty >= maxStock}
              className="flex h-8 w-8 items-center justify-center rounded border text-sm disabled:opacity-40 hover:bg-muted/50 transition-colors"
              aria-label="Aumentar cantidad"
            >
              +
            </button>
            <span className="ml-2 text-xs text-muted-foreground">
              {maxStock > 0 ? `${maxStock} disponibles` : 'Sin stock'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
