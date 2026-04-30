'use client';

import { useState } from 'react';
import { SafeImage } from './safe-image';
import { ImageLightbox, type LightboxImage } from '@/components/shared/image-lightbox';

export function ProductGallery({
  images,
  productName,
}: {
  images: LightboxImage[];
  productName: string;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-zinc-100">
        <div className="flex h-full items-center justify-center text-zinc-300">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="96"
            height="96"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
        </div>
      </div>
    );
  }

  const main = images[activeIndex];

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setLightboxIndex(activeIndex)}
        className="group relative block aspect-square w-full overflow-hidden rounded-xl bg-zinc-100"
        aria-label="Ampliar imagen"
      >
        <SafeImage
          src={main.url}
          alt={main.alt ?? productName}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
        <div className="absolute top-3 right-3 rounded-full bg-white/80 px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
          🔍 Ampliar
        </div>
      </button>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-md border-2 transition-all ${
                i === activeIndex
                  ? 'border-primary'
                  : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <SafeImage
                src={img.url}
                alt={img.alt ?? productName}
                fill
                className="object-cover"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <ImageLightbox
          images={images}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
