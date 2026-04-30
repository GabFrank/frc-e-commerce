'use client';

import { useState } from 'react';
import { updateCartLine, removeCartLine } from '@/lib/actions/cart';

export interface CartLineControlsProps {
  lineId: string;
  initialQty: number;
  maxStock?: number;
}

export function CartLineControls({ lineId, initialQty, maxStock = 99 }: CartLineControlsProps) {
  const [qty, setQty] = useState(initialQty);
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (next: number) => {
    const clamped = Math.max(1, Math.min(next, maxStock));
    setLoading(true);
    try {
      await updateCartLine(lineId, clamped);
      setQty(clamped);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      await removeCartLine(lineId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => handleUpdate(qty - 1)}
        disabled={loading || qty <= 1}
        className="flex h-7 w-7 items-center justify-center rounded border text-sm disabled:opacity-40 hover:bg-zinc-50 transition-colors"
        aria-label="Disminuir cantidad"
      >
        -
      </button>
      <span className="w-8 text-center text-sm">{qty}</span>
      <button
        type="button"
        onClick={() => handleUpdate(qty + 1)}
        disabled={loading || qty >= maxStock}
        className="flex h-7 w-7 items-center justify-center rounded border text-sm disabled:opacity-40 hover:bg-zinc-50 transition-colors"
        aria-label="Aumentar cantidad"
      >
        +
      </button>
      <button
        type="button"
        onClick={handleRemove}
        disabled={loading}
        className="ml-2 text-xs text-red-500 hover:underline disabled:opacity-40"
        aria-label="Eliminar"
      >
        Eliminar
      </button>
    </div>
  );
}
