import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { formatAmount } from '@frc-e-commerce/shared-utils';
import { db } from '@/lib/db';
import { supplier } from '@frc-e-commerce/db/schema';
import { getCurrentTenant } from '@/lib/tenant';
import { requireSession, getMembership } from '@/lib/auth/guards';
import { hasCapability } from '@/lib/auth/permissions';
import { getPurchaseOrderDetail } from '@/lib/actions/purchase-order';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PoDetailActions } from '@/components/admin/compras/PoDetailActions';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' | 'outline' }> = {
  draft: { label: 'Borrador', variant: 'secondary' },
  placed: { label: 'Pedida', variant: 'warning' },
  partially_received: { label: 'Parcial', variant: 'info' },
  received: { label: 'Recibida', variant: 'success' },
  cancelled: { label: 'Cancelada', variant: 'destructive' },
};

const MOVEMENT_LABEL: Record<string, string> = {
  purchase: 'Compra',
  purchase_return: 'Devolución compra',
  purchase_cancel: 'Cancelación compra',
};

export default async function PoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  if (!tenant) redirect('/mis-tiendas');
  const session = await requireSession();
  const membership = await getMembership(session.user.id, tenant.id);
  if (!membership || !hasCapability(membership.role, 'purchase.view')) {
    redirect('/admin/compras');
  }

  const detail = await getPurchaseOrderDetail(id);
  if (!detail) notFound();
  const { po, lines, extras, movements, primaryCurrency } = detail;

  const [supplierRow] = await db
    .select({ name: supplier.name })
    .from(supplier)
    .where(eq(supplier.id, po.supplierId))
    .limit(1);
  const supplierName = supplierRow?.name ?? '—';

  const status = STATUS_LABEL[po.status] ?? { label: po.status, variant: 'outline' as const };
  const hasReceived = po.status === 'received' || po.status === 'partially_received';
  const showRate =
    po.currencyCode !== primaryCurrency && po.exchangeRateSnapshot != null;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/admin/compras"
            className="mb-2 inline-block text-sm text-muted-foreground hover:underline"
          >
            ← Compras
          </Link>
          <h1 className="break-all font-mono text-xl font-semibold sm:text-2xl">{po.poNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {supplierName} ·{' '}
            {new Intl.DateTimeFormat('es-PY', {
              dateStyle: 'long',
              timeStyle: 'short',
            }).format(new Date(po.createdAt))}
          </p>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Información</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Proveedor</span>
              <span>{supplierName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Moneda</span>
              <span className="font-mono">{po.currencyCode}</span>
            </div>
            {showRate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cotización al recibir</span>
                <span className="font-mono">
                  {Number(po.exchangeRateSnapshot)} {primaryCurrency} / {po.currencyCode}
                </span>
              </div>
            )}
            {po.placedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Confirmada</span>
                <span>
                  {new Intl.DateTimeFormat('es-PY', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(new Date(po.placedAt))}
                </span>
              </div>
            )}
            {po.receivedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recibida</span>
                <span>
                  {new Intl.DateTimeFormat('es-PY', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }).format(new Date(po.receivedAt))}
                </span>
              </div>
            )}
            {po.notes && (
              <div className="mt-2 rounded bg-muted/50 p-2 text-xs">
                <div className="text-muted-foreground">Notas</div>
                <div>{po.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Totales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal líneas</span>
              <span className="font-mono">
                {formatAmount(po.subtotalInCurrency, po.currencyCode)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Extras</span>
              <span className="font-mono">
                {formatAmount(po.extrasTotalInCurrency, po.currencyCode)}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-t pt-1 font-medium">
              <span>Total</span>
              <span className="font-mono text-lg">
                {formatAmount(po.totalInCurrency, po.currencyCode)}
              </span>
            </div>
            {po.totalInPrimary != null && po.currencyCode !== primaryCurrency && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>≈ en {primaryCurrency}</span>
                <span className="font-mono">
                  {formatAmount(po.totalInPrimary, primaryCurrency)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Líneas ({lines.length})</CardTitle>
          <CardDescription>
            Variantes solicitadas con cantidad, costo unitario y, post-recepción, costo landed.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Variante</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Costo unit</th>
                <th className="px-3 py-2 text-right">Total línea</th>
                <th className="px-3 py-2 text-right">Landed unit</th>
                {hasReceived && (
                  <th className="px-3 py-2 text-right">Landed {primaryCurrency}</th>
                )}
                <th className="px-3 py-2 text-right">Precio venta</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.variantName}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {l.variantSku}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {l.quantity}
                    {(l.returnedQuantity > 0 || l.cancelledQuantity > 0) && (
                      <div className="text-[10px] text-muted-foreground">
                        {l.receivedQuantity > 0 && `recibida: ${l.receivedQuantity}`}
                        {l.returnedQuantity > 0 && ` · dev: ${l.returnedQuantity}`}
                        {l.cancelledQuantity > 0 && ` · canc: ${l.cancelledQuantity}`}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatAmount(l.unitCostInCurrency, po.currencyCode)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatAmount(l.totalCostInCurrency, po.currencyCode)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {l.landedUnitCostInCurrency != null
                      ? formatAmount(l.landedUnitCostInCurrency, po.currencyCode)
                      : '—'}
                  </td>
                  {hasReceived && (
                    <td className="px-3 py-2 text-right font-mono">
                      {l.landedUnitCostInPrimary != null
                        ? formatAmount(l.landedUnitCostInPrimary, primaryCurrency)
                        : '—'}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right font-mono">
                    {l.sellPriceInPrimary != null
                      ? formatAmount(l.sellPriceInPrimary, primaryCurrency)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {extras.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gastos extras ({extras.length})</CardTitle>
            <CardDescription>
              Se prorratean a las líneas según la estrategia configurada al recibir.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Descripción</th>
                  <th className="px-3 py-2 text-left">Estrategia</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {extras.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="px-3 py-2">{e.description}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground capitalize">
                      {e.allocationStrategy}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatAmount(e.amountInCurrency, po.currencyCode)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {movements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Movimientos de stock</CardTitle>
            <CardDescription>
              Generados al recibir, devolver o cancelar la PO.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Costo unit ({primaryCurrency})</th>
                  <th className="px-3 py-2 text-right">Total ({primaryCurrency})</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => {
                  const variantInfo = lines.find((l) => l.variantId === m.variantId);
                  return (
                    <tr key={m.id} className="border-t">
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat('es-PY', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(new Date(m.createdAt))}
                      </td>
                      <td className="px-3 py-2">
                        <div>{MOVEMENT_LABEL[m.kind] ?? m.kind}</div>
                        {variantInfo && (
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {variantInfo.variantSku}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{m.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {m.unitCostSnapshot != null
                          ? formatAmount(m.unitCostSnapshot, primaryCurrency)
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {m.totalCostInPrimary != null
                          ? formatAmount(m.totalCostInPrimary, primaryCurrency)
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <PoDetailActions
        poId={po.id}
        poNumber={po.poNumber}
        status={po.status}
      />
    </div>
  );
}
