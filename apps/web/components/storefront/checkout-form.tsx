'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { checkoutSchema, type CheckoutInput } from '@/lib/validators/checkout';
import { createOrderFromCart } from '@/lib/actions/order';

const PAYMENT_METHODS = [
  { value: 'transferencia' as const, label: 'Transferencia bancaria' },
  { value: 'contraentrega' as const, label: 'Pago contra entrega' },
  { value: 'efectivo' as const, label: 'Efectivo' },
] as const;

interface CheckoutFormProps {
  tenantName: string;
}

export function CheckoutForm({ tenantName }: CheckoutFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      shippingAddress: { country: 'PY' },
      paymentMethod: 'transferencia',
    },
  });

  const paymentMethod = watch('paymentMethod');

  const onSubmit = async (data: CheckoutInput) => {
    setServerError(null);
    try {
      const result = await createOrderFromCart({
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        shippingAddress: data.shippingAddress,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
      });
      if (!result.ok) throw new Error(result.error);
      router.push(`/cuenta/pedidos/${result.orderId}`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Error al procesar el pedido');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Paso 1: Datos del cliente */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">1. Datos del cliente</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="customerName">Nombre completo *</Label>
            <Input
              id="customerName"
              {...register('customerName')}
              placeholder="Juan Pérez"
              autoComplete="name"
            />
            {errors.customerName && (
              <p className="text-xs text-destructive">{errors.customerName.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="customerEmail">Email *</Label>
            <Input
              id="customerEmail"
              type="email"
              {...register('customerEmail')}
              placeholder="juan@ejemplo.com"
              autoComplete="email"
            />
            {errors.customerEmail && (
              <p className="text-xs text-destructive">{errors.customerEmail.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="customerPhone">Teléfono</Label>
            <Input
              id="customerPhone"
              type="tel"
              {...register('customerPhone')}
              placeholder="+595 981 000 000"
              autoComplete="tel"
            />
          </div>
        </div>
      </section>

      {/* Paso 2: Dirección de envío */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">2. Dirección de envío</h2>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="street">Calle y número *</Label>
            <Input
              id="street"
              {...register('shippingAddress.street')}
              placeholder="Av. Mariscal López 2345"
              autoComplete="street-address"
            />
            {errors.shippingAddress?.street && (
              <p className="text-xs text-destructive">{errors.shippingAddress.street.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="city">Ciudad *</Label>
              <Input
                id="city"
                {...register('shippingAddress.city')}
                placeholder="Asunción"
                autoComplete="address-level2"
              />
              {errors.shippingAddress?.city && (
                <p className="text-xs text-destructive">{errors.shippingAddress.city.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="state">Departamento</Label>
              <Input
                id="state"
                {...register('shippingAddress.state')}
                placeholder="Central"
                autoComplete="address-level1"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="zip">Código postal</Label>
              <Input
                id="zip"
                {...register('shippingAddress.zip')}
                placeholder="1209"
                autoComplete="postal-code"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="country">País</Label>
              <Input
                id="country"
                {...register('shippingAddress.country')}
                defaultValue="PY"
                readOnly
                className="bg-muted/50 cursor-default"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Paso 3: Método de pago */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">3. Método de pago</h2>

        <div className="space-y-2">
          {PAYMENT_METHODS.map(({ value, label }) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                value={value}
                {...register('paymentMethod')}
                className="accent-primary"
              />
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}
          {errors.paymentMethod && (
            <p className="text-xs text-destructive">{errors.paymentMethod.message}</p>
          )}
        </div>

        {/* Instrucciones según método */}
        {paymentMethod === 'transferencia' && (
          <div className="rounded-lg bg-primary/10 p-4 text-sm text-primary">
            <p className="font-medium">Instrucciones de transferencia</p>
            <p className="mt-1 text-primary">
              Una vez confirmado el pedido, recibirás los datos bancarios por email para
              realizar la transferencia.
            </p>
          </div>
        )}
        {paymentMethod === 'contraentrega' && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-4 text-sm text-emerald-700 dark:text-emerald-300">
            <p className="font-medium">Pago al recibir</p>
            <p className="mt-1 text-emerald-600 dark:text-emerald-400">
              Pagás en efectivo o con tarjeta al momento de recibir tu pedido.
            </p>
          </div>
        )}
        {paymentMethod === 'efectivo' && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-700 dark:text-amber-300">
            <p className="font-medium">Pago en efectivo</p>
            <p className="mt-1 text-amber-600 dark:text-amber-400">
              Podés abonar en nuestros locales o coordinar el pago con nuestro equipo.
            </p>
          </div>
        )}
      </section>

      {/* Notas */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notas adicionales</Label>
        <textarea
          id="notes"
          {...register('notes')}
          rows={3}
          placeholder="Indicaciones especiales para el pedido o la entrega..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
      </div>

      {serverError && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{serverError}</p>
      )}

      <Button type="submit" disabled={isSubmitting} size="lg" className="w-full sm:w-auto">
        {isSubmitting ? 'Procesando pedido...' : 'Confirmar pedido'}
      </Button>

      <p className="text-xs text-muted-foreground">
        Al confirmar aceptás los términos y condiciones de {tenantName}.
      </p>
    </form>
  );
}
