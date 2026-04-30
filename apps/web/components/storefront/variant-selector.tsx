'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';

// Local interface — Agent A will provide the real type from @frc-e-commerce/db/schema
export interface VariantOption {
  id: string;
  sku: string;
  name: string;
  stock: number;
  attributes?: Record<string, string>; // e.g. { color: 'Rojo', talla: 'M' }
}

interface VariantSelectorProps {
  variants: VariantOption[];
  onVariantChange: (variantId: string, qty: number) => void;
}

export function VariantSelector({ variants, onVariantChange }: VariantSelectorProps) {
  const [selectedId, setSelectedId] = useState<string>(variants[0]?.id ?? '');
  const [qty, setQty] = useState(1);

  const selected = variants.find((v) => v.id === selectedId);
  const maxStock = selected?.stock ?? 0;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setQty(1);
    onVariantChange(id, 1);
  };

  const handleQtyChange = (next: number) => {
    const clamped = Math.max(1, Math.min(next, maxStock));
    setQty(clamped);
    onVariantChange(selectedId, clamped);
  };

  if (variants.length === 0) return null;

  return (
    <div className="space-y-4">
      {variants.length > 1 && (
        <div>
          <p className="mb-2 text-sm font-medium">Variante</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => handleSelect(v.id)}
                disabled={v.stock === 0}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm transition-colors',
                  v.stock === 0 && 'cursor-not-allowed opacity-40',
                  selectedId === v.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:border-primary hover:text-primary'
                )}
              >
                {v.name}
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
              className="flex h-8 w-8 items-center justify-center rounded border text-sm disabled:opacity-40 hover:bg-zinc-50 transition-colors"
              aria-label="Disminuir cantidad"
            >
              -
            </button>
            <span className="w-10 text-center text-sm font-medium">{qty}</span>
            <button
              type="button"
              onClick={() => handleQtyChange(qty + 1)}
              disabled={qty >= maxStock}
              className="flex h-8 w-8 items-center justify-center rounded border text-sm disabled:opacity-40 hover:bg-zinc-50 transition-colors"
              aria-label="Aumentar cantidad"
            >
              +
            </button>
            <span className="ml-2 text-xs text-zinc-500">
              {maxStock > 0 ? `${maxStock} disponibles` : 'Sin stock'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
