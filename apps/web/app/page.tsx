import { getCurrentTenant } from '@/lib/tenant';

export default async function Home() {
  const tenant = await getCurrentTenant().catch(() => null);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">FRC E-commerce SaaS</h1>
        <p className="mt-2 text-zinc-600">Plataforma multi-tenant en construcción</p>
      </div>

      <div className="rounded-lg border border-zinc-200 p-6 max-w-md w-full">
        <h2 className="font-semibold mb-2">Tenant context</h2>
        {tenant ? (
          <dl className="text-sm space-y-1">
            <div>
              <dt className="inline font-medium">Nombre: </dt>
              <dd className="inline">{tenant.name}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Slug: </dt>
              <dd className="inline font-mono">{tenant.slug}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Plan: </dt>
              <dd className="inline">{tenant.plan}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-zinc-500">
            Sin tenant resuelto. Configurá <code className="text-xs bg-zinc-100 px-1 rounded">DEV_TENANT_SLUG</code>{' '}
            o accedé vía subdominio.
          </p>
        )}
      </div>

      <div className="text-xs text-zinc-500 text-center">
        <p>
          Health: <a href="/api/health" className="underline">/api/health</a>
        </p>
      </div>
    </main>
  );
}
