'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getCurrencyDecimalPlaces } from '@frc-e-commerce/shared-utils';
import { MoneyInput } from '@/components/ui/money-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { createProductSchema } from '@/lib/validators/product';
import { createProduct, updateProduct } from '@/lib/actions/product';
import { slugify } from '@frc-e-commerce/shared-utils';
import { GENDERS, type Gender } from '@/lib/clothing/sizes';
import type { Category, Product } from '@frc-e-commerce/db/schema';
import { z } from 'zod';

// Concrete form values type (all fields fully required for the form itself)
type ProductFormValues = {
  name: string;
  slug: string;
  description: string;
  status: 'draft' | 'active' | 'archived';
  categoryId?: string;
  gender: Gender;
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
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createProductSchema) as any,
    defaultValues: {
      name: initial?.name ?? '',
      slug: initial?.slug ?? '',
      description: initial?.description ?? '',
      status: initial?.status ?? 'draft',
      categoryId: initial?.categoryId ?? undefined,
      gender: (initial?.gender as Gender | undefined) ?? 'unisex',
      basePrice: initial?.basePrice ?? 0,
      currency: initial?.currency ?? 'PYG',
      taxIncluded: initial?.taxIncluded ?? false,
    },
  });

  const nameValue = watch('name');

  const onSubmit: SubmitHandler<ProductFormValues> = async (data) => {
    setServerError(null);

    // Build payload omitting empty optional fields (Server Actions strip
    // `undefined` values during serialization, but zod v4 distinguishes
    // between missing key and undefined — safest is to not include them).
    const payload: z.infer<typeof createProductSchema> = {
      name: data.name,
      slug: data.slug,
      status: data.status,
      gender: data.gender,
      basePrice: data.basePrice,
      currency: data.currency,
      taxIncluded: data.taxIncluded,
    };
    if (data.description?.trim()) payload.description = data.description.trim();
    if (data.categoryId) payload.categoryId = data.categoryId;

    try {
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
    } catch (err) {
      console.error('[ProductForm] submit error:', err);
      setServerError(err instanceof Error ? err.message : 'Error inesperado al enviar el formulario');
    }
  };

  const onInvalid = (formErrors: typeof errors) => {
    console.warn('[ProductForm] validation failed:', formErrors);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? 'Editar producto' : 'Nuevo producto'}</CardTitle>
      </CardHeader>
      <CardContent>
        {Object.keys(errors).length > 0 && (
          <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            <p className="font-medium">Revisá los siguientes campos:</p>
            <ul className="mt-1 list-disc list-inside text-xs">
              {Object.entries(errors).map(([field, fieldError]) => (
                <li key={field}>
                  <span className="font-medium">{field}:</span>{' '}
                  {(fieldError as { message?: string })?.message ?? 'inválido'}
                </li>
              ))}
            </ul>
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-5">
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
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug (URL)</Label>
            <Input
              id="slug"
              placeholder={slugify(nameValue ?? '')}
              {...register('slug')}
            />
            {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
            <p className="text-xs text-muted-foreground">Identificador único en la URL del producto.</p>
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción</Label>
            <Textarea id="description" rows={4} {...register('description')} />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* Estado y género */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="status">Estado</Label>
              <Select id="status" {...register('status')}>
                <option value="draft">Borrador</option>
                <option value="active">Activo</option>
                <option value="archived">Archivado</option>
              </Select>
              {errors.status && <p className="text-xs text-destructive">{errors.status.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gender">Género</Label>
              <Select id="gender" {...register('gender')}>
                {GENDERS.map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Define el set de talles disponibles en cada variante.
              </p>
            </div>
          </div>

          {/* Categoría */}
          {categories.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="categoryId">Categoría</Label>
              <Select
                id="categoryId"
                {...register('categoryId', {
                  setValueAs: (v) => (v === '' || v == null ? undefined : v),
                })}
              >
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
              <Label htmlFor="basePrice">Precio base</Label>
              <Controller
                control={control}
                name="basePrice"
                render={({ field }) => (
                  <MoneyInput
                    id="basePrice"
                    value={field.value ?? null}
                    onChange={(v) => field.onChange(v ?? 0)}
                    decimalPlaces={getCurrencyDecimalPlaces(watch('currency') ?? 'PYG')}
                  />
                )}
              />
              {errors.basePrice && (
                <p className="text-xs text-destructive">{errors.basePrice.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
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

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

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
