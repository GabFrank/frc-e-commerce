import { z } from 'zod';

export const paymentMethodEnum = z.enum(['transferencia', 'contraentrega', 'efectivo', 'stripe']);

export const shippingAddressSchema = z.object({
  street: z.string().min(1, 'La calle es requerida'),
  city: z.string().min(1, 'La ciudad es requerida'),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().min(1, 'El país es requerido'),
});

export const checkoutSchema = z.object({
  customerName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  customerEmail: z.string().email('Email inválido'),
  customerPhone: z.string().optional(),
  shippingAddress: shippingAddressSchema,
  paymentMethod: paymentMethodEnum,
  notes: z.string().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;
