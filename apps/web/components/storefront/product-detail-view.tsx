'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ProductGallery } from './product-gallery';
import { ProductPurchasePanel } from './product-purchase-panel';
import type { VariantOption } from './variant-selector';

export interface DetailImage {
  id: string;
  url: string;
  alt: string | null;
  variantId: string | null;
}

interface ProductDetailViewProps {
  productName: string;
  description?: string | null;
  images: DetailImage[];
  variants: VariantOption[];
  basePrice: number;
  currency: string;
}

export function ProductDetailView({
  productName,
  description,
  images,
  variants,
  basePrice,
  currency,
}: ProductDetailViewProps) {
  const initialVariantId = variants[0]?.id ?? null;
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(initialVariantId);

  const visibleImages = useMemo(() => {
    if (selectedVariantId) {
      const variantImages = images.filter((i) => i.variantId === selectedVariantId);
      if (variantImages.length > 0) return variantImages;
    }
    return images.filter((i) => i.variantId === null);
  }, [images, selectedVariantId]);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <ProductGallery images={visibleImages} productName={productName} />
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-bold">{productName}</h1>
        {description && (
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
        <ProductPurchasePanel
          variants={variants}
          basePrice={basePrice}
          currency={currency}
          onSelectedVariantChange={setSelectedVariantId}
        />
        <div className="pt-2">
          <Link href="/carrito" className="text-sm text-muted-foreground hover:underline">
            Ver carrito
          </Link>
        </div>
      </div>
    </div>
  );
}
