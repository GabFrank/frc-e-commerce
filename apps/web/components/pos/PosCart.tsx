'use client';

import Image from 'next/image';
import { Trash2, Pencil, Gift, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePosCart, calcLineTotal, type PosCartLine } from '@/lib/stores/usePosCart';

type Props = {
  canSeeCost: boolean;
  onEditLine: (line: PosCartLine) => void;
};

export function PosCart({ canSeeCost, onEditLine }: Props) {
  const { lines, removeLine, setQuantity } = usePosCart();

  if (lines.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        Carrito vacío. Buscá un producto (F2) o escaneá un código.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-2">
      {lines.map((l) => (
        <div key={l.id} className="flex gap-2 border-b py-2">
          {l.imageUrl ? (
            <Image
              src={l.imageUrl}
              alt={l.productName}
              width={48}
              height={48}
              className="h-12 w-12 rounded object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded bg-muted text-muted-foreground">
              <Package className="h-4 w-4" />
            </div>
          )}
          <div className="flex-1 text-sm">
            <div className="font-medium leading-tight">
              {l.productName}
              {l.isComplimentary && (
                <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900">
                  <Gift className="h-2.5 w-2.5" /> Brindis
                </span>
              )}
            </div>
            {l.variantName && (
              <div className="text-xs text-muted-foreground">{l.variantName}</div>
            )}
            <div className="mt-1 flex items-center gap-1 text-xs">
              <Button
                size="icon"
                variant="outline"
                className="h-6 w-6"
                onClick={() => setQuantity(l.id, l.quantity - 1)}
                disabled={l.quantity <= 1}
              >
                −
              </Button>
              <span className="w-6 text-center font-mono">{l.quantity}</span>
              <Button
                size="icon"
                variant="outline"
                className="h-6 w-6"
                onClick={() => setQuantity(l.id, l.quantity + 1)}
              >
                +
              </Button>
              <span className="ml-1 text-muted-foreground">
                × {l.unitPrice.toLocaleString('es-PY')}
              </span>
              {l.discount && (
                <span className="ml-1 text-amber-700">
                  − {l.discount.kind === 'pct' ? `${l.discount.value}%` : l.discount.value.toLocaleString('es-PY')}
                </span>
              )}
            </div>
            {canSeeCost && l.unitCost != null && (
              <div className="text-[10px] text-muted-foreground">
                costo: {l.unitCost.toLocaleString('es-PY')}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="text-sm font-semibold">
              {calcLineTotal(l).toLocaleString('es-PY')}
            </div>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => onEditLine(l)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => removeLine(l.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
