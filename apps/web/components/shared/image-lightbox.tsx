'use client';

import { useCallback, useEffect, useState } from 'react';
import { SafeImage } from '@/components/storefront/safe-image';

export interface LightboxImage {
  id: string;
  url: string;
  alt?: string | null;
}

export function ImageLightbox({
  images,
  startIndex,
  onClose,
}: {
  images: LightboxImage[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const total = images.length;

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + total) % total);
  }, [total]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % total);
  }, [total]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose, goPrev, goNext]);

  if (total === 0) return null;
  const current = images[index];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        aria-label="Cerrar"
      >
        ✕
      </button>

      {total > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
          {index + 1} / {total}
        </div>
      )}

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Anterior"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Siguiente"
          >
            ›
          </button>
        </>
      )}

      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <SafeImage
          src={current.url}
          alt={current.alt ?? 'Imagen'}
          width={1400}
          height={1400}
          className="max-h-[90vh] max-w-[90vw] object-contain"
        />
      </div>

      {total > 1 && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2 rounded-full bg-white/5 p-2"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-12 w-12 overflow-hidden rounded-md border-2 transition-all ${
                i === index ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <SafeImage src={img.url} alt={img.alt ?? ''} width={48} height={48} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
