import { getCurrentTenant } from '@/lib/tenant';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

export default async function ConfiguracionPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Configuración</h1>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la tienda</CardTitle>
          <CardDescription>Información básica que aparece en el storefront</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
            <dt className="text-zinc-500">Nombre</dt>
            <dd>{tenant.name}</dd>
            <dt className="text-zinc-500">Slug (URL)</dt>
            <dd className="font-mono">{tenant.slug}.frc-ecommerce.com</dd>
            <dt className="text-zinc-500">Plan</dt>
            <dd className="capitalize">{tenant.plan}</dd>
            <dt className="text-zinc-500">Estado</dt>
            <dd className="capitalize">{tenant.status}</dd>
            <dt className="text-zinc-500">Slogan</dt>
            <dd>{tenant.slogan ?? <span className="text-zinc-400">— sin slogan</span>}</dd>
            <dt className="text-zinc-500">Moneda base</dt>
            <dd>{tenant.defaultCurrency}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Colores aplicados al storefront</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 text-xs">
            <div>
              <div
                className="h-12 w-12 rounded-md border"
                style={{ backgroundColor: tenant.primaryColor ?? '#1f2937' }}
              />
              <p className="mt-1">Primary</p>
              <p className="font-mono text-zinc-500">{tenant.primaryColor}</p>
            </div>
            <div>
              <div
                className="h-12 w-12 rounded-md border"
                style={{ backgroundColor: tenant.secondaryColor ?? '#6b7280' }}
              />
              <p className="mt-1">Secondary</p>
              <p className="font-mono text-zinc-500">{tenant.secondaryColor}</p>
            </div>
            <div>
              <div
                className="h-12 w-12 rounded-md border"
                style={{ backgroundColor: tenant.accentColor ?? '#3b82f6' }}
              />
              <p className="mt-1">Accent</p>
              <p className="font-mono text-zinc-500">{tenant.accentColor}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            ⏳ Editor de branding y logo upload llegan en Fase 6.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Métodos de pago</CardTitle>
          <CardDescription>Configuración de medios habilitados (próximamente editable)</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-1">
            <li>✓ Transferencia bancaria (manual)</li>
            <li>✓ Pago contra entrega (manual)</li>
            <li>✓ Efectivo (POS)</li>
            <li className="text-zinc-400">⏳ Stripe (post-MVP, requiere SDK)</li>
            <li className="text-zinc-400">⏳ Bancard (post-MVP)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
