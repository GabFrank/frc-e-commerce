import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(60),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Solo a-z, 0-9 y guiones (no al inicio/fin)'),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']),
});
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
