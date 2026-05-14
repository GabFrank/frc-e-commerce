import Link from 'next/link';
import { listTenantCurrenciesView } from '@/lib/actions/currency';
import { MonedasClient } from '@/components/admin/configuracion/MonedasClient';

export default async function MonedasPage() {
  const view = await listTenantCurrenciesView();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold sm:text-2xl">Monedas y cotizaciones</h1>
          <p className="text-sm text-muted-foreground">
            Activá las monedas que vas a usar, marcá una como principal y mantené las cotizaciones
            actualizadas. La moneda principal queda con cotización 1.0 implícita.
          </p>
        </div>
        <Link
          href="/admin/configuracion"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Volver a configuración
        </Link>
      </div>

      <MonedasClient initial={view} />
    </div>
  );
}
