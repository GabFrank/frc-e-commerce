'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Package, AlertTriangle, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { AdminOverrideDialog } from '@/components/admin/AdminOverrideDialog';
import { usePosCart, calcLineTotal, type DiscountValue } from '@/lib/stores/usePosCart';
import type { PosVariantOption } from '@/lib/actions/pos-search';
import type { PosTenantContext } from './PosShell';

type Props = {
  variant: PosVariantOption;
  ctx: PosTenantContext;
  onClose: () => void;
};

export function LineDetailDialog({ variant, ctx, onClose }: Props) {
  const addLine = usePosCart((s) => s.addLine);
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState(variant.price);
  const [discountKind, setDiscountKind] = useState<'none' | 'pct' | 'amount'>('none');
  const [discountValue, setDiscountValue] = useState(0);
  const [isComplimentary, setIsComplimentary] = useState(false);
  const [authorizedBy, setAuthorizedBy] = useState<{ userId: string; name: string } | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);

  const discount: DiscountValue | null =
    discountKind === 'none' ? null : { kind: discountKind, value: Number(discountValue) || 0 };

  const lineTotalPreview = isComplimentary
    ? 0
    : calcLineTotal({
        id: 'preview',
        variantId: variant.variantId,
        productId: variant.productId,
        productName: variant.productName,
        variantName: variant.variantName,
        color: variant.color,
        size: variant.size,
        sizeKind: variant.sizeKind,
        attributesLabel: variant.attributesLabel,
        sku: variant.sku,
        imageUrl: variant.imageUrl,
        availableStock: variant.stock,
        unitPrice,
        unitCost: null,
        quantity: qty,
        discount,
        isComplimentary: false,
        complimentaryAuthorizedBy: null,
        complimentaryAuthorizedByName: null,
      });

  const stockWarning = qty > variant.stock;

  const handleConfirm = () => {
    addLine({
      variantId: variant.variantId,
      productId: variant.productId,
      productName: variant.productName,
      variantName: variant.variantName,
      color: variant.color,
      size: variant.size,
      sizeKind: variant.sizeKind,
      attributesLabel: variant.attributesLabel,
      sku: variant.sku,
      imageUrl: variant.imageUrl,
      availableStock: variant.stock,
      unitPrice,
      unitCost: null,
      quantity: qty,
      discount,
      isComplimentary,
      complimentaryAuthorizedBy: authorizedBy?.userId ?? null,
      complimentaryAuthorizedByName: authorizedBy?.name ?? null,
    });
    onClose();
  };

  const handleToggleComplimentary = () => {
    if (isComplimentary) {
      setIsComplimentary(false);
      setAuthorizedBy(null);
      return;
    }
    if (ctx.canMarkComplimentary) {
      setIsComplimentary(true);
    } else {
      setOverrideOpen(true);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle de línea</DialogTitle>
          </DialogHeader>

          <div className="flex gap-3">
            {variant.imageUrl ? (
              <Image
                src={variant.imageUrl}
                alt={variant.variantName}
                width={96}
                height={96}
                className="h-24 w-24 rounded object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded bg-muted text-muted-foreground">
                <Package className="h-6 w-6" />
              </div>
            )}
            <div className="flex-1 text-sm">
              <div className="font-medium">{variant.productName}</div>
              <div className="text-muted-foreground">{variant.variantName}</div>
              {variant.attributesLabel && (
                <div className="text-xs text-muted-foreground">{variant.attributesLabel}</div>
              )}
              <div className="text-xs text-muted-foreground">
                SKU {variant.sku} · stock {variant.stock}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block mb-1 font-medium">Cantidad</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                >
                  −
                </Button>
                <Input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                  className="text-center"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQty((q) => q + 1)}
                >
                  +
                </Button>
              </div>
              {stockWarning && (
                <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3" /> stock insuficiente ({variant.stock})
                </div>
              )}
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">
                Precio unitario {!ctx.canEditPrice && <span className="text-xs text-muted-foreground">(solo lectura)</span>}
              </span>
              <Input
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                disabled={!ctx.canEditPrice}
              />
            </label>
          </div>

          <div>
            <span className="text-sm font-medium">Descuento de línea (F5)</span>
            <RadioGroup
              value={discountKind}
              onValueChange={(v) => setDiscountKind(v as 'none' | 'pct' | 'amount')}
              className="mt-1 grid grid-cols-3 gap-2"
            >
              <label className="flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer">
                <RadioGroupItem value="none" /> Sin descuento
              </label>
              <label className="flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer">
                <RadioGroupItem value="pct" /> %
              </label>
              <label className="flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer">
                <RadioGroupItem value="amount" /> Monto
              </label>
            </RadioGroup>
            {discountKind !== 'none' && (
              <Input
                type="number"
                placeholder={discountKind === 'pct' ? '10 (= 10%)' : '5.000'}
                value={discountValue || ''}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                className="mt-2"
              />
            )}
          </div>

          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Brindis (no se cobra)</span>
              </div>
              <Button
                type="button"
                variant={isComplimentary ? 'default' : 'outline'}
                size="sm"
                onClick={handleToggleComplimentary}
              >
                {isComplimentary ? 'Sí (autorizado)' : 'Marcar brindis'}
              </Button>
            </div>
            {isComplimentary && authorizedBy && (
              <div className="mt-1 text-xs text-muted-foreground">
                Autorizado por: {authorizedBy.name}
              </div>
            )}
          </div>

          {ctx.canSeeCost && variant.price && (
            <div className="text-xs text-muted-foreground">
              Costo unitario: pendiente (M5 cuando avg_cost esté en DB)
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
            <span className="text-sm font-medium">Total línea</span>
            <span className="text-lg font-semibold">
              {lineTotalPreview.toLocaleString('es-PY')}
            </span>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm}>Agregar al carrito</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminOverrideDialog
        open={overrideOpen}
        onClose={() => setOverrideOpen(false)}
        requiredCapability="pos.mark_complimentary"
        title="Autorización para marcar brindis"
        description="Esta línea no es brindis por default. Un admin/manager debe autorizar."
        onSuccess={(by) => {
          setAuthorizedBy(by);
          setIsComplimentary(true);
          setOverrideOpen(false);
        }}
      />
    </>
  );
}
