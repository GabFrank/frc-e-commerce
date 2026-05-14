import { redirect } from 'next/navigation';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { requireSession, getMembership } from '@/lib/auth/guards';
import { getCurrentTenant } from '@/lib/tenant';
import { hasCapability } from '@/lib/auth/permissions';
import {
  cashSession,
  cashClosure,
  user,
} from '@frc-e-commerce/db/schema';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CajaRowActions } from '@/components/admin/financiero/CajaRowActions';
import { formatNumber } from '@frc-e-commerce/shared-utils';

export const dynamic = 'force-dynamic';

export default async function CajasPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect('/mis-tiendas');
  const session = await requireSession();
  const membership = await getMembership(session.user.id, tenant.id);
  if (!membership || !hasCapability(membership.role, 'reports.financial')) {
    redirect('/admin');
  }

  const sessions = await db
    .select({
      id: cashSession.id,
      status: cashSession.status,
      openedAt: cashSession.openedAt,
      closedAt: cashSession.closedAt,
      cashierName: user.name,
      cashierEmail: user.email,
      totalSalesInPrimary: cashClosure.totalSalesInPrimary,
      totalReturnsInPrimary: cashClosure.totalReturnsInPrimary,
      totalCancellationsInPrimary: cashClosure.totalCancellationsInPrimary,
      totalTransactions: cashClosure.totalTransactions,
    })
    .from(cashSession)
    .innerJoin(user, eq(user.id, cashSession.cashierId))
    .leftJoin(cashClosure, eq(cashClosure.cashSessionId, cashSession.id))
    .where(eq(cashSession.tenantId, tenant.id))
    .orderBy(desc(cashSession.openedAt))
    .limit(200);

  const [counts] = await db
    .select({
      open: sql<number>`count(*) filter (where ${cashSession.status} = 'open')`.mapWith(Number),
      closed: sql<number>`count(*) filter (where ${cashSession.status} = 'closed')`.mapWith(Number),
    })
    .from(cashSession)
    .where(eq(cashSession.tenantId, tenant.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Cajas</h1>
        <p className="text-sm text-muted-foreground">
          Sesiones de caja del POS — apertura, cobros, devoluciones y cierre con conteo físico.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Abiertas</CardDescription>
            <CardTitle className="text-2xl">{counts?.open ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cerradas</CardDescription>
            <CardTitle className="text-2xl">{counts?.closed ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
          <CardDescription>Últimas 200 sesiones</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Cajero</th>
                <th className="px-3 py-2 text-left">Apertura</th>
                <th className="px-3 py-2 text-left">Cierre</th>
                <th className="px-3 py-2 text-right">Ventas</th>
                <th className="px-3 py-2 text-right">Devol.</th>
                <th className="px-3 py-2 text-right">Cancel.</th>
                <th className="px-3 py-2 text-right">Tx</th>
                <th className="px-3 py-2 text-right" />
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                    Aún no hay sesiones de caja registradas.
                  </td>
                </tr>
              )}
              {sessions.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2">
                    {s.status === 'open' ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-900">
                        Abierta
                      </span>
                    ) : (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        Cerrada
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div>{s.cashierName ?? s.cashierEmail}</div>
                    {s.cashierName && (
                      <div className="text-xs text-muted-foreground">{s.cashierEmail}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {new Date(s.openedAt).toLocaleString('es-PY')}
                  </td>
                  <td className="px-3 py-2">
                    {s.closedAt ? new Date(s.closedAt).toLocaleString('es-PY') : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {s.totalSalesInPrimary != null ? formatNumber(Number(s.totalSalesInPrimary), 0) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {s.totalReturnsInPrimary != null ? formatNumber(Number(s.totalReturnsInPrimary), 0) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {s.totalCancellationsInPrimary != null ? formatNumber(Number(s.totalCancellationsInPrimary), 0) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {s.totalTransactions ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <CajaRowActions cashSessionId={s.id} status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
