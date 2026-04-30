'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { addProductImage, deleteProductImage } from '@/lib/actions/product';
import { getPresignedUploadUrl } from '@/lib/r2';
import type { ProductImage } from '@frc-e-commerce/db/schema';

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const { publicUrl, key } = await getPresignedUploadUrl(
        tenantSlug,
        file.name,
        file.type
      );

      const res = await addProductImage(productId, {
        r2Key: key,
        url: publicUrl,
        alt: file.name,
        position: images.length,
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }

      // Optimistic local update — real data revalidated on next navigation
      setImages((prev) => [
        ...prev,
        {
          id: res.imageId,
          productId,
          tenantId: '',
          r2Key: key,
          url: publicUrl,
          alt: file.name,
          position: prev.length,
        },
      ]);
    } catch {
      setError('Error al subir la imagen');
    } finally {
      setUploading(false);
      // Reset file input so same file can be re-selected
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
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {images.map((img) => (
          <div key={img.id} className="relative group w-24 h-24 rounded-md border overflow-hidden">
            <Image
              src={img.url}
              alt={img.alt ?? 'Imagen del producto'}
              fill
              className="object-cover"
              unoptimized
            />
            <button
              type="button"
              onClick={() => handleDelete(img.id)}
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs"
            >
              Eliminar
            </button>
          </div>
        ))}
      </div>

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? 'Subiendo...' : 'Subir imagen'}
        </Button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
