'use client';

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { createProductVariantSchema } from '@/lib/validators/product';
import { createProductVariant } from '@/lib/actions/product';
import type { ProductVariant } from '@frc-e-commerce/db/schema';

// Concrete form values type for react-hook-form
type VariantFormValues = {
  sku: string;
  name: string;
  price: number;
  compareAtPrice: number;
  stock: number;
  active: boolean;
};

interface VariantFormProps {
  productId: string;
  variants: ProductVariant[];
}

export function VariantForm({ productId, variants: initialVariants }: VariantFormProps) {
  const [variants, setVariants] = useState<ProductVariant[]>(initialVariants);
  const [showForm, setShowForm] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<VariantFormValues>({
    resolver: zodResolver(createProductVariantSchema) as any,
    defaultValues: { stock: 0, active: true, compareAtPrice: 0, price: 0 },
  });

  const onSubmit: SubmitHandler<VariantFormValues> = async (data) => {
    setServerError(null);
    const res = await createProductVariant(productId, {
      sku: data.sku,
      name: data.name,
      price: data.price,
      compareAtPrice: data.compareAtPrice || undefined,
      stock: data.stock,
      active: data.active,
      attributes: {},
    });
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    // Optimistic add with a temp object matching the DB shape
    const optimistic: ProductVariant = {
      id: res.variantId,
      productId,
      tenantId: '',
      sku: data.sku,
      name: data.name,
      price: data.price,
      compareAtPrice: data.compareAtPrice || null,
      stock: data.stock,
      attributes: {},
      active: data.active,
    };
    setVariants((prev) => [...prev, optimistic]);
    reset();
    setShowForm(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Variantes</CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : '+ Agregar variante'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing variants list */}
        {variants.length > 0 ? (
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-600 text-left">
                <tr>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Precio</th>
                  <th className="px-3 py-2">Stock</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{v.sku}</td>
                    <td className="px-3 py-2">{v.name}</td>
                    <td className="px-3 py-2">{v.price.toLocaleString('es-PY')}</td>
                    <td className="px-3 py-2">{v.stock}</td>
                    <td className="px-3 py-2">
                      <Badge variant={v.active ? 'success' : 'secondary'}>
                        {v.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Aún no hay variantes.</p>
        )}

        {/* New variant form */}
        {showForm && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" {...register('sku')} />
                {errors.sku && <p className="text-xs text-red-600">{errors.sku.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="variantName">Nombre de variante</Label>
                <Input id="variantName" {...register('name')} />
                {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="price">Precio</Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  {...register('price', { valueAsNumber: true })}
                />
                {errors.price && <p className="text-xs text-red-600">{errors.price.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="compareAtPrice">Precio comparación</Label>
                <Input
                  id="compareAtPrice"
                  type="number"
                  min={0}
                  {...register('compareAtPrice', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stock">Stock</Label>
                <Input
                  id="stock"
                  type="number"
                  min={0}
                  {...register('stock', { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="variantActive"
                className="h-4 w-4 rounded border-input"
                {...register('active')}
              />
              <Label htmlFor="variantActive" className="cursor-pointer">
                Variante activa
              </Label>
            </div>

            {serverError && <p className="text-sm text-red-600">{serverError}</p>}

            <Button type="submit" disabled={isSubmitting} size="sm">
              {isSubmitting ? 'Guardando...' : 'Guardar variante'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
