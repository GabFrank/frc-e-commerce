'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { addProductImage, deleteProductImage } from '@/lib/actions/product';
import { presignProductImageUpload } from '@/lib/actions/upload';
import type { ProductImage } from '@frc-e-commerce/db/schema';
import { SafeImage } from '@/components/storefront/safe-image';
import { ImageLightbox } from '@/components/shared/image-lightbox';

interface ImageUploaderProps {
  productId: string;
  tenantSlug: string;
  images: ProductImage[];
}

export function ImageUploader({ productId, tenantSlug, images: initialImages }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ProductImage[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        // 1. Pedir presigned URL al backend
        const presign = await presignProductImageUpload(file.name, file.type, file.size);
        if (!presign.ok) {
          setError(presign.error);
          continue;
        }

        // 2. PUT directo a R2 desde el browser
        const putRes = await fetch(presign.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
        if (!putRes.ok) {
          setError(`Error subiendo a R2: ${putRes.status} ${putRes.statusText}`);
          continue;
        }

        // 3. Persistir registro en DB
        const res = await addProductImage(productId, {
          r2Key: presign.key,
          url: presign.publicUrl,
          alt: file.name,
          position: images.length,
        });

        if (!res.ok) {
          setError(res.error);
          continue;
        }

        setImages((prev) => [
          ...prev,
          {
            id: res.imageId,
            productId,
            tenantId: '',
            r2Key: presign.key,
            url: presign.publicUrl,
            alt: file.name,
            position: prev.length,
          },
        ]);
      }
    } catch (err) {
      console.error('[ImageUploader] upload error:', err);
      setError(err instanceof Error ? err.message : 'Error al subir la imagen');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async (imageId: string) => {
    const res = await deleteProductImage(productId, imageId);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setImages((prev) => prev.filter((img) => img.id !== imageId));
    setConfirmDeleteId(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {images.map((img, i) => (
          <div
            key={img.id}
            className="group relative aspect-square overflow-hidden rounded-lg border bg-muted/50"
          >
            <button
              type="button"
              onClick={() => setLightboxIndex(i)}
              className="block h-full w-full"
              aria-label="Ampliar imagen"
            >
              <SafeImage
                src={img.url}
                alt={img.alt ?? 'Imagen del producto'}
                fill
                className="object-cover transition-transform duration-200 group-hover:scale-105"
              />
            </button>

            {/* Botón eliminar — esquina superior derecha */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDeleteId(img.id);
              }}
              className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-foreground/80 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-white"
              aria-label="Eliminar imagen"
              title="Eliminar"
            >
              ✕
            </button>

            {/* Indicador de posición */}
            <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
              #{i + 1}
            </div>
          </div>
        ))}

        {/* Card "Subir imagen" */}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="group flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/50 text-muted-foreground hover:border-primary hover:bg-muted hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <>
              <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              <span className="text-xs">Subiendo…</span>
            </>
          ) : (
            <>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M12 8v8M8 12h8" />
              </svg>
              <span className="text-xs font-medium">Subir imagen</span>
              <span className="text-[10px] text-muted-foreground/80">JPG, PNG, WEBP</span>
            </>
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      {lightboxIndex !== null && (
        <ImageLightbox
          images={images.map((img) => ({ id: img.id, url: img.url, alt: img.alt }))}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-card text-card-foreground p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Eliminar imagen</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              ¿Seguro que querés eliminar esta imagen? La acción no se puede deshacer.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" size="sm" onClick={() => handleDelete(confirmDeleteId)}>
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
