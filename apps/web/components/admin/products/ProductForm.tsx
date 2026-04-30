'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { createProductSchema } from '@/lib/validators/product';
import { createProduct, updateProduct } from '@/lib/actions/product';
import { slugify } from '@frc-e-commerce/shared-utils';
import type { Category, Product } from '@frc-e-commerce/db/schema';
import { z } from 'zod';

// Concrete form values type (all fields fully required for the form itself)
type ProductFormValues = {
  name: string;
  slug: string;
  description: string;
  status: 'draft' | 'active' | 'archived';
  categoryId: string;
  basePrice: number;
  currency: string;
  taxIncluded: boolean;
};

interface ProductFormProps {
  /** When provided the form is in edit mode */
  product?: Product;
  categories: Category[];
}

export function ProductForm({ product: initial, categories }: ProductFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEditing = !!initial;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<ProductFormValues>({
    resolver: zodResolver(createProductSchema) as any,
    defaultValues: {
      name: initial?.name ?? '',
      slug: initial?.slug ?? '',
      description: initial?.description ?? '',
      status: initial?.status ?? 'draft',
      categoryId: initial?.categoryId ?? '',
      basePrice: initial?.basePrice ?? 0,
      currency: initial?.currency ?? 'PYG',
      taxIncluded: initial?.taxIncluded ?? false,
    },
  });

  const nameValue = watch('name');

  const onSubmit: SubmitHandler<ProductFormValues> = async (data) => {
    setServerError(null);

    // Normalize empty strings to undefined for optional fields
    const payload: z.infer<typeof createProductSchema> = {
      name: data.name,
      slug: data.slug,
      description: data.description || undefined,
      status: data.status,
      categoryId: data.categoryId || undefined,
      basePrice: data.basePrice,
      currency: data.currency,
      taxIncluded: data.taxIncluded,
    };

    if (isEditing) {
      const res = await updateProduct(initial.id, payload);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      router.refresh();
    } else {
      const res = await createProduct(payload);
      if (!res.ok) {
        setServerError(res.error);
        return;
      }
      router.push(`/admin/productos/${res.productId}`);
      router.refresh();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? 'Editar producto' : 'Nuevo producto'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              {...register('name')}
              onBlur={(e) => {
                if (!watch('slug')) {
                  setValue('slug', slugify(e.target.value));
                }
              }}
            />
            {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug (URL)</Label>
            <Input
              id="slug"
              placeholder={slugify(nameValue ?? '')}
              {...register('slug')}
            />
            {errors.slug && <p className="text-xs text-red-600">{errors.slug.message}</p>}
            <p className="text-xs text-zinc-500">Identificador único en la URL del producto.</p>
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" rows={4} {...register('description')} />
            {errors.description && (
              <p className="text-xs text-red-600">{errors.description.message}</p>
            )}
          </div>

          {/* Estado */}
          <div className="space-y-1.5">
            <Label htmlFor="status">Estado</Label>
            <Select id="status" {...register('status')}>
              <option value="draft">Borrador</option>
              <option value="active">Activo</option>
              <option value="archived">Archivado</option>
            </Select>
            {errors.status && <p className="text-xs text-red-600">{errors.status.message}</p>}
          </div>

          {/* Categoría */}
          {categories.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="categoryId">Categoría</Label>
              <Select id="categoryId" {...register('categoryId')}>
                <option value="">Sin categoría</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {/* Precio base */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="basePrice">Precio base (centavos)</Label>
              <Input
                id="basePrice"
                type="number"
                min={1}
                {...register('basePrice', { valueAsNumber: true })}
              />
              {errors.basePrice && (
                <p className="text-xs text-red-600">{errors.basePrice.message}</p>
              )}
              <p className="text-xs text-zinc-500">
                En la unidad mínima de la moneda. Para PYG: guaraníes enteros.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="currency">Moneda</Label>
              <Select id="currency" {...register('currency')}>
                <option value="PYG">PYG — Guaraní</option>
                <option value="USD">USD — Dólar</option>
                <option value="ARS">ARS — Peso Arg.</option>
                <option value="BRL">BRL — Real</option>
              </Select>
            </div>
          </div>

          {/* Impuesto incluido */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="taxIncluded"
              className="h-4 w-4 rounded border-input"
              {...register('taxIncluded')}
            />
            <Label htmlFor="taxIncluded" className="cursor-pointer">
              Precio incluye impuesto
            </Label>
          </div>

          {serverError && <p className="text-sm text-red-600">{serverError}</p>}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? isEditing
                ? 'Guardando...'
                : 'Creando...'
              : isEditing
                ? 'Guardar cambios'
                : 'Crear producto'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
