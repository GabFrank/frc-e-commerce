'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createTenant } from '@/lib/actions/tenant';
import { createTenantSchema, type CreateTenantInput } from '@/lib/validators/tenant';
import { slugify } from '@frc-e-commerce/shared-utils';

export default function NewTenantPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateTenantInput>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: { plan: 'free' },
  });

  const name = watch('name');

  const onSubmit = async (data: CreateTenantInput) => {
    setServerError(null);
    const res = await createTenant(data);
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    router.push('/super/tenants');
    router.refresh();
  };

  return (
    <div className="max-w-md space-y-4">
      <Link href="/super/tenants" className="text-sm text-muted-foreground hover:underline">
        ← Volver
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Nueva tienda</CardTitle>
          <CardDescription>Crear un tenant en la plataforma</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre comercial</Label>
              <Input
                id="name"
                {...register('name')}
                onBlur={(e) => {
                  if (!watch('slug')) setValue('slug', slugify(e.target.value));
                }}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">Slug (subdominio)</Label>
              <Input id="slug" placeholder={slugify(name ?? '')} {...register('slug')} />
              {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
              <p className="text-xs text-muted-foreground">URL: <span className="font-mono">{watch('slug') || '<slug>'}.frc-ecommerce.com</span></p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan">Plan</Label>
              <select
                id="plan"
                {...register('plan')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Creando...' : 'Crear tienda'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
