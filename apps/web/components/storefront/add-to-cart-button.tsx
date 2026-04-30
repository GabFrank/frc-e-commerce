'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { VariantSelector, type VariantOption } from './variant-selector';
import { addToCart } from '@/lib/actions/cart';

export interface AddToCartButtonProps {
  variants: VariantOption[];
  /** Base price in minor currency units (used for new cart lines) */
  unitPrice: number;
}

export function AddToCartButton({ variants, unitPrice }: AddToCartButtonProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(variants[0]?.id ?? '');
  const [selectedQty, setSelectedQty] = useState(1);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const handleVariantChange = (variantId: string, qty: number) => {
    setSelectedVariantId(variantId);
    setSelectedQty(qty);
    setStatus('idle');
    setMessage(null);
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

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const outOfStock = !selectedVariant || selectedVariant.stock === 0;

  return (
    <div className="space-y-4">
      <VariantSelector variants={variants} onVariantChange={handleVariantChange} />

      <Button
        onClick={handleAddToCart}
        disabled={status === 'loading' || outOfStock}
        className="w-full sm:w-auto"
        size="lg"
      >
        {status === 'loading'
          ? 'Agregando...'
          : outOfStock
            ? 'Sin stock'
            : 'Agregar al carrito'}
      </Button>

      {message && (
        <p
          className={`text-sm ${
            status === 'success' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
