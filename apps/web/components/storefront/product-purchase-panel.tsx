'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { VariantSelector, type VariantOption } from './variant-selector';
import { addToCart } from '@/lib/actions/cart';
import { formatMoney } from '@frc-e-commerce/shared-utils';
import type { CurrencyCode } from '@frc-e-commerce/shared-utils';

export interface ProductPurchasePanelProps {
  variants: VariantOption[];
  /** Fallback price si el variante seleccionado no tiene price */
  basePrice: number;
  currency: string;
  onSelectedVariantChange?: (variantId: string | null) => void;
}

export function ProductPurchasePanel({
  variants,
  basePrice,
  currency,
  onSelectedVariantChange,
}: ProductPurchasePanelProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(variants[0]?.id ?? '');
  const [selectedQty, setSelectedQty] = useState(1);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const unitPrice = selectedVariant?.price ?? basePrice;
  const outOfStock = !selectedVariant || selectedVariant.stock === 0;

  const handleVariantChange = (variantId: string, qty: number) => {
    setSelectedVariantId(variantId);
    setSelectedQty(qty);
    setStatus('idle');
    setMessage(null);
    onSelectedVariantChange?.(variantId || null);
  };

  const handleAddToCart = async () => {
    if (!selectedVariantId) return;
    setStatus('loading');
    setMessage(null);
    const result = await addToCart(selectedVariantId, selectedQty, unitPrice);
    if (result.ok) {
      setStatus('success');
      setMessage('Producto agregado al carrito');
    } else {
      setStatus('error');
      setMessage(result.error);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-2xl font-semibold text-primary">
        {formatMoney({ amount: unitPrice, currency: currency as CurrencyCode })}
      </p>

      {variants.length > 0 && (
        <VariantSelector variants={variants} onVariantChange={handleVariantChange} />
      )}

      <Button
        onClick={handleAddToCart}
        disabled={status === 'loading' || outOfStock || variants.length === 0}
        className="w-full sm:w-auto"
        size="lg"
      >
        {status === 'loading'
          ? 'Agregando...'
          : variants.length === 0
            ? 'Sin variantes disponibles'
            : outOfStock
              ? 'Sin stock'
              : 'Agregar al carrito'}
      </Button>

      {message && (
        <p
          className={`text-sm ${
            status === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
