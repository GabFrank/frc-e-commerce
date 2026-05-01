import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tenant, tenantMember, user } from '@frc-e-commerce/db/schema';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AddMemberForm } from '@/components/super/add-member-form';
import { RemoveMemberButton } from '@/components/super/remove-member-button';
import { ManageTenantButton } from '@/components/super/manage-tenant-button';
import { requireSuperAdmin } from '@/lib/auth/guards';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TenantDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { session, user: currentUser } = await requireSuperAdmin();

  const [t] = await db.select().from(tenant).where(eq(tenant.id, id)).limit(1);
  if (!t) notFound();

  const [currentMembership] = await db
    .select()
    .from(tenantMember)
    .where(and(eq(tenantMember.tenantId, t.id), eq(tenantMember.userId, session.user.id)))
    .limit(1);

  const memberships = await db
    .select({
      id: tenantMember.id,
      userId: tenantMember.userId,
      role: tenantMember.role,
      createdAt: tenantMember.createdAt,
      userName: user.name,
      userEmail: user.email,
    })
    .from(tenantMember)
    .innerJoin(user, eq(user.id, tenantMember.userId))
    .where(eq(tenantMember.tenantId, t.id))
    .orderBy(tenantMember.createdAt);

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/super/tenants" className="text-sm text-muted-foreground hover:underline">
        ← Volver a tiendas
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t.name}</h1>
          <p className="text-sm text-muted-foreground font-mono">{t.slug}.frc-ecommerce.com</p>
        </div>
        <ManageTenantButton
          tenantId={t.id}
          tenantName={t.name}
          hasMembership={!!currentMembership}
          currentUserEmail={currentUser.email}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos generales</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Plan</dt>
            <dd className="capitalize">{t.plan}</dd>
            <dt className="text-muted-foreground">Estado</dt>
            <dd className="capitalize">{t.status}</dd>
            <dt className="text-muted-foreground">Moneda</dt>
            <dd>{t.defaultCurrency}</dd>
            <dt className="text-muted-foreground">Creada</dt>
            <dd>{new Date(t.createdAt).toLocaleDateString('es-PY')}</dd>
            <dt className="text-muted-foreground">Onboarding</dt>
            <dd>{t.onboardingCompleted ? '✓ Completado' : `Paso ${t.onboardingStep}`}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipo de la tienda</CardTitle>
          <CardDescription>
            Usuarios con acceso al admin de <span className="font-medium">{t.name}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {memberships.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay miembros.</p>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="p-2.5">Usuario</th>
                    <th className="p-2.5">Email</th>
                    <th className="p-2.5">Rol</th>
                    <th className="p-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {memberships.map((m) => (
                    <tr key={m.id} className="border-t">
                      <td className="p-2.5 font-medium">{m.userName}</td>
                      <td className="p-2.5 text-muted-foreground">{m.userEmail}</td>
                      <td className="p-2.5 capitalize">{m.role}</td>
                      <td className="p-2.5 text-right">
                        <RemoveMemberButton tenantId={t.id} membershipId={m.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium mb-3">Agregar miembro</h3>
            <AddMemberForm tenantId={t.id} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
