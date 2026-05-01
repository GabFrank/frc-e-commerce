import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { requireSession, getMembership } from '@/lib/auth/guards';
import { getCurrentTenant } from '@/lib/tenant';
import { hasCapability } from '@/lib/auth/permissions';
import {
  posConfig,
  tenantCurrency,
  currency,
  exchangeRate,
  cashSession,
  cashSessionBalance,
} from '@frc-e-commerce/db/schema';
import { PosShell, type PosTenantContext } from '@/components/pos/PosShell';

export const dynamic = 'force-dynamic';

export default async function PosPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect('/mis-tiendas');
  const session = await requireSession();
  const membership = await getMembership(session.user.id, tenant.id);
  if (!membership || !hasCapability(membership.role, 'pos.sell')) redirect('/admin');

  // Cargar pos_config (crear default si no existe)
  let [cfg] = await db
    .select()
    .from(posConfig)
    .where(eq(posConfig.tenantId, tenant.id))
    .limit(1);
  if (!cfg) {
    const [created] = await db
      .insert(posConfig)
      .values({
        tenantId: tenant.id,
        enabledCurrencies: [tenant.defaultCurrency],
        pricingDisplayCurrencies: [tenant.defaultCurrency],
        paymentMethods: ['efectivo'],
      })
      .returning();
    cfg = created!;
  }

  // Monedas configuradas activas
  const tcs = await db
    .select({
      currencyCode: tenantCurrency.currencyCode,
      isPrimary: tenantCurrency.isPrimary,
      isActive: tenantCurrency.isActive,
      symbol: currency.symbol,
      decimalPlaces: currency.decimalPlaces,
      name: currency.name,
    })
    .from(tenantCurrency)
    .innerJoin(currency, eq(currency.code, tenantCurrency.currencyCode))
    .where(and(eq(tenantCurrency.tenantId, tenant.id), eq(tenantCurrency.isActive, true)));

  const rates = await db
    .select({
      currencyCode: exchangeRate.currencyCode,
      buyRate: exchangeRate.buyRate,
      sellRate: exchangeRate.sellRate,
    })
    .from(exchangeRate)
    .where(eq(exchangeRate.tenantId, tenant.id))
    .orderBy(desc(exchangeRate.effectiveFrom));
  const currentRates = new Map<string, { buyRate: string; sellRate: string }>();
  for (const r of rates) {
    if (!currentRates.has(r.currencyCode))
      currentRates.set(r.currencyCode, { buyRate: r.buyRate, sellRate: r.sellRate });
  }

  const primaryCurrency = tcs.find((t) => t.isPrimary)?.currencyCode ?? tenant.defaultCurrency;

  const ctx: PosTenantContext = {
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    cashierName: session.user.name ?? session.user.email,
    cashierEmail: session.user.email,
    role: membership.role,
    primaryCurrency,
    currencies: tcs.map((t) => ({
      code: t.currencyCode,
      name: t.name,
      symbol: t.symbol,
      decimalPlaces: t.decimalPlaces,
      isPrimary: t.isPrimary,
      currentBuyRate: currentRates.get(t.currencyCode)?.buyRate ?? null,
      currentSellRate: currentRates.get(t.currencyCode)?.sellRate ?? null,
    })),
    posConfig: {
      enabledCurrencies: cfg.enabledCurrencies,
      pricingDisplayCurrencies: cfg.pricingDisplayCurrencies,
      paymentMethods: cfg.paymentMethods,
      searchShowImages: cfg.searchShowImages,
      showCostToAdmin: cfg.showCostToAdmin,
      strictStock: cfg.strictStock,
    },
    canSeeCost: hasCapability(membership.role, 'pos.see_cost') && cfg.showCostToAdmin,
    canChangeCurrency: hasCapability(membership.role, 'pos.change_currency'),
    canMarkComplimentary: hasCapability(membership.role, 'pos.mark_complimentary'),
    canEditPrice: hasCapability(membership.role, 'product.write'),
  };

  // Sesión activa del cashier
  const [active] = await db
    .select()
    .from(cashSession)
    .where(
      and(
        eq(cashSession.tenantId, tenant.id),
        eq(cashSession.cashierId, session.user.id),
        eq(cashSession.status, 'open')
      )
    )
    .limit(1);
  let openCurrencies: string[] = [];
  if (active) {
    const balances = await db
      .select({ currencyCode: cashSessionBalance.currencyCode })
      .from(cashSessionBalance)
      .where(eq(cashSessionBalance.cashSessionId, active.id));
    openCurrencies = balances.map((b) => b.currencyCode);
  }

  return (
    <>
      <PosHeader ctx={ctx} session={active} />
      <PosShell
        ctx={ctx}
        activeSession={
          active
            ? { id: active.id, openedAt: active.openedAt, openCurrencies }
            : null
        }
      />
    </>
  );
}

function PosHeader({
  ctx,
  session,
}: {
  ctx: PosTenantContext;
  session: { openedAt: Date } | null;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b bg-card px-4 text-sm">
      <div className="flex items-center gap-4">
        <span className="font-semibold">{ctx.tenantName} · POS</span>
        <span className="text-muted-foreground">
          Cajero: <strong className="text-foreground">{ctx.cashierName}</strong> ({ctx.role})
        </span>
        {session ? (
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900">
            Caja abierta {new Date(session.openedAt).toLocaleString('es-PY')}
          </span>
        ) : (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
            Sin caja abierta
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs">
        <Link href="/admin" className="text-muted-foreground hover:underline">
          ← Volver a admin
        </Link>
      </div>
    </header>
  );
}
