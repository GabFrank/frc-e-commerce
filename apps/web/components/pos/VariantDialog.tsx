'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { Loader2, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { getProductVariants, type PosVariantOption } from '@/lib/actions/pos-search';

type Props = {
  productId: string;
  productName: string;
  onClose: () => void;
  onPick: (v: PosVariantOption) => void;
};

export function VariantDialog({ productId, productName, onClose, onPick }: Props) {
  const [variants, setVariants] = useState<PosVariantOption[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startTransition(async () => {
      const res = await getProductVariants(productId);
      if (res.ok) {
        setVariants(res.variants);
        const firstColor = res.variants.find((v) => v.color)?.color ?? null;
        setSelectedColor(firstColor);
      } else {
        setError(res.error);
      }
    });
  }, [productId]);

  const colors = useMemo(() => {
    const set = new Set<string>();
    for (const v of variants) {
      if (v.color) set.add(v.color);
    }
    return Array.from(set);
  }, [variants]);

  const filteredVariants = useMemo(() => {
    if (colors.length === 0) return variants;
    if (selectedColor === null) return variants.filter((v) => !v.color);
    return variants.filter((v) => v.color === selectedColor);
  }, [variants, colors, selectedColor]);

  const handleColorChange = (c: string | null) => {
    setSelectedColor(c);
    setSelectedIdx(0);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(filteredVariants.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const v = filteredVariants[selectedIdx];
        if (v) onPick(v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filteredVariants, selectedIdx, onPick]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Elegir variante</DialogTitle>
          <DialogDescription>{productName}</DialogDescription>
        </DialogHeader>

        {pending && (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando variantes…
          </div>
        )}
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        {colors.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-xs text-muted-foreground">Color</div>
            <div className="flex flex-wrap gap-1.5">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleColorChange(c)}
                  className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                    selectedColor === c
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'hover:border-primary'
                  }`}
                >
                  {c}
                </button>
              ))}
              {variants.some((v) => !v.color) && (
                <button
                  type="button"
                  onClick={() => handleColorChange(null)}
                  className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                    selectedColor === null
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'hover:border-primary'
                  }`}
                >
                  Sin color
                </button>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {filteredVariants.map((v, i) => (
            <button
              key={v.variantId}
              onClick={() => onPick(v)}
              onMouseEnter={() => setSelectedIdx(i)}
              className={`flex flex-col gap-2 rounded-md border p-3 text-left transition ${
                i === selectedIdx ? 'border-primary bg-accent' : 'hover:bg-muted'
              }`}
            >
              {v.imageUrl ? (
                <Image
                  src={v.imageUrl}
                  alt={v.variantName}
                  width={120}
                  height={120}
                  className="h-24 w-full rounded object-cover"
                />
              ) : (
                <div className="flex h-24 w-full items-center justify-center rounded bg-muted text-muted-foreground">
                  <Package className="h-6 w-6" />
                </div>
              )}
              <div className="text-sm">
                <div className="font-medium leading-tight">
                  {v.size ? `Talle ${v.size}` : v.variantName}
                </div>
                {v.color && <div className="text-xs text-muted-foreground">{v.color}</div>}
                <div className="text-xs text-muted-foreground">
                  SKU: {v.sku} · stock: {v.stock}
                </div>
                <div className="mt-1 font-semibold">
                  {v.price.toLocaleString('es-PY')}
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
