import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { requireSession } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { tenant, tenantMember, user as userTable } from '@frc-e-commerce/db/schema';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EnterTenantButton } from '@/components/account/enter-tenant-button';
import { SignOutButton } from '@/components/storefront/sign-out-button';

export default async function MisTiendasPage() {
  const session = await requireSession();

  const [u] = await db
    .select({ isSuperAdmin: userTable.isSuperAdmin })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);
  const isSuperAdmin = !!u?.isSuperAdmin;

  const memberships = await db
    .select({
      membershipId: tenantMember.id,
      role: tenantMember.role,
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      tenantStatus: tenant.status,
    })
    .from(tenantMember)
    .innerJoin(tenant, eq(tenant.id, tenantMember.tenantId))
    .where(eq(tenantMember.userId, session.user.id));

  // Atajo super: si es super y no tiene memberships, va al panel super
  if (isSuperAdmin && memberships.length === 0) redirect('/super');

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:py-12">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-baseline">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">Mis tiendas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hola <span className="font-medium">{session.user.name}</span> — elegí qué tienda
            querés administrar.
          </p>
        </div>
        <SignOutButton />
      </div>

      {memberships.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aún no tenés tiendas asignadas</CardTitle>
            <CardDescription>
              Pedile al administrador del SaaS que te invite como miembro de una tienda, o creá una nueva si tu plan lo permite.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/" className="text-sm text-primary underline">
              Ir al sitio público
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {memberships.map((m) => (
            <Card key={m.membershipId}>
              <CardContent className="flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <h2 className="font-semibold">{m.tenantName}</h2>
                  <p className="break-all font-mono text-xs text-muted-foreground">
                    {m.tenantSlug}.frc-ecommerce.com
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Rol: <span className="font-medium capitalize">{m.role}</span>
                    {m.tenantStatus !== 'active' && (
                      <span className="ml-2 text-amber-600 dark:text-amber-400">({m.tenantStatus})</span>
                    )}
                  </p>
                </div>
                <EnterTenantButton tenantId={m.tenantId} tenantName={m.tenantName} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isSuperAdmin && (
        <div className="border-t pt-4">
          <Link href="/super">
            <Button variant="outline" size="sm">
              Ir al panel Super Admin →
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
