import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentTenant } from '@/lib/tenant';
import { getSession } from '@/lib/auth/guards';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SignOutButton } from '@/components/storefront/sign-out-button';

export default async function CuentaPage() {
  const tenant = await getCurrentTenant().catch(() => null);
  if (!tenant) notFound();

  const session = await getSession();

  if (!session) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="mb-4 text-2xl font-bold">Mi cuenta</h1>
        <p className="mb-6 text-muted-foreground">Iniciá sesión para ver tu cuenta y pedidos.</p>
        <div className="flex items-center justify-center gap-3">
          <Button asChild>
            <Link href="/login">Ingresar</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/register">Crear cuenta</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { user } = session;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Mi cuenta</h1>

      <div className="space-y-4">
        {/* Info del usuario */}
        <Card>
          <CardHeader>
            <CardTitle>Datos personales</CardTitle>
            <CardDescription>Tu información de cuenta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="w-20 shrink-0 font-medium text-muted-foreground">Nombre</span>
              <span className="break-all">{user.name}</span>
            </div>
            <div className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="w-20 shrink-0 font-medium text-muted-foreground">Email</span>
              <span className="break-all">{user.email}</span>
            </div>
          </CardContent>
        </Card>

        {/* Mis pedidos */}
        <Card>
          <CardHeader>
            <CardTitle>Mis pedidos</CardTitle>
            <CardDescription>Historial de tus compras</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/cuenta/pedidos"
              className="text-sm text-primary hover:underline"
            >
              Ver mis pedidos →
            </Link>
            {/* TODO: /cuenta/pedidos route to be implemented */}
          </CardContent>
        </Card>

        {/* Acción: cerrar sesión */}
        <div className="flex justify-end">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
