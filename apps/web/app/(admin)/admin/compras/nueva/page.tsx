import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tenantCurrency, currency, posConfig } from '@frc-e-commerce/db/schema';
import { getCurrentTenant } from '@/lib/tenant';
import { requireSession, getMembership } from '@/lib/auth/guards';
import { hasCapability } from '@/lib/auth/permissions';
import { listSuppliers } from '@/lib/actions/supplier';
import { getDraftForEdit } from '@/lib/actions/purchase-order';
import { CreatePoForm } from '@/components/admin/compras/CreatePoForm';

export const dynamic = 'force-dynamic';

type SearchParams = { draftId?: string };

export default async function NuevaCompraPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect('/mis-tiendas');
  const session = await requireSession();
  const membership = await getMembership(session.user.id, tenant.id);
  if (!membership || !hasCapability(membership.role, 'purchase.write')) {
    redirect('/admin/compras');
  }

  const { draftId } = await searchParams;

  const [suppliers, currencies, draftRes, cfgRow] = await Promise.all([
    listSuppliers(),
    db
      .select({
        code: tenantCurrency.currencyCode,
        symbol: currency.symbol,
        name: currency.name,
        isPrimary: tenantCurrency.isPrimary,
      })
      .from(tenantCurrency)
      .innerJoin(currency, eq(currency.code, tenantCurrency.currencyCode))
      .where(and(eq(tenantCurrency.tenantId, tenant.id), eq(tenantCurrency.isActive, true))),
    draftId ? getDraftForEdit(draftId) : Promise.resolve(null),
    db.select({ marginFormula: posConfig.marginFormula }).from(posConfig).where(eq(posConfig.tenantId, tenant.id)).limit(1),
  ]);
  const marginFormula: 'markup' | 'gross' =
    cfgRow[0]?.marginFormula === 'gross' ? 'gross' : 'markup';

  if (draftId && (!draftRes || !draftRes.ok)) {
    notFound();
  }
  const initialDraft = draftRes && draftRes.ok ? draftRes.draft : null;

  const primaryCurrencyCode = currencies.find((c) => c.isPrimary)?.code ?? 'PYG';
  const activeSuppliers = suppliers.filter((s) => s.isActive);
  const currencyList = currencies.map(({ code, symbol, name }) => ({ code, symbol, name }));

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-xl font-semibold sm:text-2xl">
            {initialDraft ? `Editar borrador · ${initialDraft.poNumber}` : 'Nueva orden de compra'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {initialDraft
              ? 'Editando borrador. Guardá los cambios o promové a "Pedida" para confirmar la orden.'
              : 'La PO se crea en estado "placed". La recepción (que actualiza stock y costos) se hace después con el botón Recibir.'}
          </p>
        </div>
        <Link href="/admin/compras" className="text-sm text-muted-foreground hover:underline">
          ← Volver a compras
        </Link>
      </div>

      <CreatePoForm
        suppliers={activeSuppliers}
        currencies={currencyList}
        primaryCurrencyCode={primaryCurrencyCode}
        marginFormula={marginFormula}
        draftScopeKey={`${tenant.id}:${session.user.id}`}
        initialDraft={initialDraft}
      />
    </div>
  );
}
