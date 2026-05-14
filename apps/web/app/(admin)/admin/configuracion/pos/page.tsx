import Link from 'next/link';
import { redirect } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tenantCurrency, currency } from '@frc-e-commerce/db/schema';
import { getPosConfig } from '@/lib/actions/pos-config';
import { getCurrentTenant } from '@/lib/tenant';
import { PosConfigClient } from '@/components/admin/configuracion/PosConfigClient';

export default async function PosConfigPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect('/mis-tiendas');

  const cfg = await getPosConfig();
  const currencies = await db
    .select({
      code: tenantCurrency.currencyCode,
      isPrimary: tenantCurrency.isPrimary,
      symbol: currency.symbol,
      name: currency.name,
    })
    .from(tenantCurrency)
    .innerJoin(currency, eq(currency.code, tenantCurrency.currencyCode))
    .where(and(eq(tenantCurrency.tenantId, tenant.id), eq(tenantCurrency.isActive, true)));

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">Configuración del POS</h1>
          <p className="text-sm text-muted-foreground">
            Personalizá el comportamiento del POS para esta tienda. Los cambios afectan a todos los cashiers.
          </p>
        </div>
        <Link href="/admin/configuracion" className="text-sm text-muted-foreground hover:underline">
          ← Volver
        </Link>
      </div>
      <PosConfigClient
        initial={cfg}
        availableCurrencies={currencies}
      />
    </div>
  );
}
