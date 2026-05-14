import { notFound } from 'next/navigation';
import Link from 'next/link';
import { eq, inArray } from 'drizzle-orm';
import { formatMoney, formatAmount, getCurrencyDecimalPlaces } from '@frc-e-commerce/shared-utils';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getOrderDetail, markPaymentAsPaid, cancelOrder } from '@/lib/actions/order';
import { PosOrderActions } from '@/components/admin/pedidos/PosOrderActions';
import { db } from '@/lib/db';
import { productVariant } from '@frc-e-commerce/db/schema';
import type { OrderStatus, PaymentStatus } from '@frc-e-commerce/db/schema';
import type { CurrencyCode } from '@frc-e-commerce/shared-utils';

function orderStatusLabel(status: OrderStatus): { variant: BadgeProps['variant']; label: string } {
  const map: Record<OrderStatus, { variant: BadgeProps['variant']; label: string }> = {
    pending: { variant: 'warning', label: 'Pendiente' },
    confirmed: { variant: 'success', label: 'Confirmado' },
    processing: { variant: 'info', label: 'En proceso' },
    shipped: { variant: 'info', label: 'Enviado' },
    delivered: { variant: 'success', label: 'Entregado' },
    cancelled: { variant: 'destructive', label: 'Cancelado' },
    refunded: { variant: 'secondary', label: 'Reembolsado' },
  };
  return map[status] ?? { variant: 'outline', label: status };
}

function paymentStatusLabel(
  status: PaymentStatus
): { variant: BadgeProps['variant']; label: string } {
  const map: Record<PaymentStatus, { variant: BadgeProps['variant']; label: string }> = {
    pending: { variant: 'warning', label: 'Pendiente' },
    authorized: { variant: 'info', label: 'Autorizado' },
    captured: { variant: 'success', label: 'Pagado' },
    failed: { variant: 'destructive', label: 'Fallido' },
    refunded: { variant: 'secondary', label: 'Reembolsado' },
    cancelled: { variant: 'destructive', label: 'Cancelado' },
  };
  return map[status] ?? { variant: 'outline', label: status };
}

const KIND_LABELS: Record<'payment' | 'change' | 'discount' | 'surcharge', string> = {
  payment: 'Pago',
  change: 'Vuelto',
  discount: 'Descuento',
  surcharge: 'Aumento',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PedidoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const detail = await getOrderDetail(id);

  if (!detail) notFound();

  const { order: o, lines, payments, paymentDetails, reversalStockMovements, reversalCashMovements } = detail;
  const primaryPayment = payments[0] ?? null;
  const currency = o.currency as CurrencyCode;
  const hasReversals = reversalStockMovements.length > 0 || reversalCashMovements.length > 0;

  // Cargar info de variantes para mostrar nombre + SKU + permitir devoluciones
  const variantIds = lines.map((l) => l.variantId);
  const variants = variantIds.length
    ? await db
        .select({ id: productVariant.id, sku: productVariant.sku, name: productVariant.name })
        .from(productVariant)
        .where(inArray(productVariant.id, variantIds))
    : [];
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  const orderBadge = orderStatusLabel(o.status);
  const paymentBadge = primaryPayment ? paymentStatusLabel(primaryPayment.status) : null;

  const shippingAddress = o.shippingAddressJson as Record<string, string> | null;

  // A payment can be marked as paid when it's a manual method and still pending
  const manualMethods = ['transferencia', 'contraentrega', 'efectivo'];
  const canMarkAsPaid =
    primaryPayment &&
    primaryPayment.status === 'pending' &&
    manualMethods.includes(primaryPayment.method);

  const canCancel = !['cancelled', 'delivered', 'shipped'].includes(o.status);

  const formattedDate = new Intl.DateTimeFormat('es-PY', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(o.createdAt));

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <Link
            href="/admin/pedidos"
            className="mb-2 inline-block text-sm text-muted-foreground hover:underline"
          >
            Pedidos
          </Link>
          <h1 className="break-all font-mono text-xl font-semibold sm:text-2xl">{o.orderNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{formattedDate}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasReversals && o.status !== 'cancelled' && (
            <Badge variant="warning">Con devoluciones</Badge>
          )}
          <Badge variant={orderBadge.variant}>{orderBadge.label}</Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{o.customerName}</p>
            <p className="text-muted-foreground">{o.customerEmail}</p>
            {o.customerPhone && <p className="text-muted-foreground">{o.customerPhone}</p>}
            {o.notes && (
              <p className="mt-2 rounded bg-muted/50 p-2 text-foreground/80 text-xs">
                Nota: {o.notes}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Shipping address */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dirección de envío</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {shippingAddress ? (
              <div className="space-y-0.5">
                {shippingAddress.street && <p>{shippingAddress.street}</p>}
                {shippingAddress.city && <p>{shippingAddress.city}</p>}
                {shippingAddress.department && <p>{shippingAddress.department}</p>}
                {shippingAddress.postalCode && <p>CP: {shippingAddress.postalCode}</p>}
                {shippingAddress.country && <p>{shippingAddress.country}</p>}
                {shippingAddress.additionalInfo && (
                  <p className="text-muted-foreground/80">{shippingAddress.additionalInfo}</p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground/80">Sin información de dirección</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order lines */}
      <div className="mt-6">
        <h2 className="mb-3 text-base font-semibold">Productos</h2>
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variante</TableHead>
                <TableHead className="text-right">Precio unit.</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => {
                const v = variantMap.get(line.variantId);
                const netQty = line.quantity - line.returnedQuantity - line.cancelledQuantity;
                const netTotal = netQty * line.unitPrice;
                return (
                  <TableRow key={line.id}>
                    <TableCell>
                      {v ? (
                        <div className="space-y-0.5">
                          <div className="font-medium">{v.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{v.sku}</div>
                        </div>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">
                          {line.variantId}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney({ amount: line.unitPrice, currency })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div>{line.quantity}</div>
                      {line.returnedQuantity > 0 && (
                        <div className="text-xs text-amber-700">−{line.returnedQuantity} devuelta{line.returnedQuantity === 1 ? '' : 's'}</div>
                      )}
                      {line.cancelledQuantity > 0 && (
                        <div className="text-xs text-destructive">−{line.cancelledQuantity} cancelada{line.cancelledQuantity === 1 ? '' : 's'}</div>
                      )}
                      {(line.returnedQuantity > 0 || line.cancelledQuantity > 0) && (
                        <div className="text-xs font-medium">neto: {netQty}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <div className={netQty < line.quantity ? 'text-muted-foreground line-through' : ''}>
                        {formatMoney({ amount: line.totalPrice, currency })}
                      </div>
                      {netQty < line.quantity && (
                        <div className="text-xs font-medium text-foreground">
                          {formatMoney({ amount: netTotal, currency })}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Totals */}
        <div className="mt-3 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm sm:w-64">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatMoney({ amount: o.subtotal, currency })}</span>
            </div>
            {o.shippingCost > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Envío</span>
                <span>{formatMoney({ amount: o.shippingCost, currency })}</span>
              </div>
            )}
            {o.tax > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">IVA</span>
                <span>{formatMoney({ amount: o.tax, currency })}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1 font-semibold">
              <span>Total</span>
              <span>{formatMoney({ amount: o.total, currency })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment info */}
      {primaryPayment && (
        <div className="mt-6">
          <h2 className="mb-3 text-base font-semibold">Pago</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between text-sm">
                <div className="space-y-1">
                  <p>
                    <span className="text-muted-foreground">Método: </span>
                    <span className="font-medium capitalize">{primaryPayment.method}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Monto: </span>
                    <span className="font-medium">
                      {formatMoney({ amount: primaryPayment.amount, currency })}
                    </span>
                  </p>
                  {primaryPayment.externalId && (
                    <p>
                      <span className="text-muted-foreground">ID externo: </span>
                      <span className="font-mono text-xs">{primaryPayment.externalId}</span>
                    </p>
                  )}
                </div>
                {paymentBadge && (
                  <Badge variant={paymentBadge.variant}>{paymentBadge.label}</Badge>
                )}
              </div>

              {paymentDetails.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    Desglose
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Moneda</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="text-right">Cotiz.</TableHead>
                        <TableHead className="text-right">En {o.currency}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentDetails.map((d) => {
                        const code = d.currencyCode ?? o.currency;
                        const dp = getCurrencyDecimalPlaces(code);
                        // payment_detail.amount está en unidades mínimas — convertimos a mayor para display.
                        const majorAmount = d.amount / Math.pow(10, dp);
                        const dpPrimary = getCurrencyDecimalPlaces(o.currency);
                        const majorInPrimary = d.amountInPrimary / Math.pow(10, dpPrimary);
                        return (
                          <TableRow key={d.id}>
                            <TableCell className="capitalize">{KIND_LABELS[d.kind]}</TableCell>
                            <TableCell className="capitalize text-muted-foreground">
                              {d.paymentMethod ?? '—'}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{code}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatAmount(majorAmount, code)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-muted-foreground">
                              {d.exchangeRateSnapshot ?? (code === o.currency ? '1' : '—')}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatAmount(majorInPrimary, o.currency)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Devoluciones / Cancelaciones */}
      {hasReversals && (
        <div className="mt-6">
          <h2 className="mb-3 text-base font-semibold">Devoluciones y cancelaciones</h2>
          <Card>
            <CardContent className="space-y-4 pt-6">
              {reversalStockMovements.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    Stock revertido
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Variante</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reversalStockMovements.map((sm) => {
                        const v = variantMap.get(sm.variantId);
                        return (
                          <TableRow key={sm.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Intl.DateTimeFormat('es-PY', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              }).format(new Date(sm.createdAt))}
                            </TableCell>
                            <TableCell>
                              {sm.kind === 'sale_return' ? (
                                <Badge variant="warning">Devolución</Badge>
                              ) : sm.kind === 'sale_cancel' ? (
                                <Badge variant="destructive">Cancelación</Badge>
                              ) : (
                                <span>{sm.kind}</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {v ? (
                                <div>
                                  <div className="text-sm">{v.name}</div>
                                  <div className="font-mono text-xs text-muted-foreground">{v.sku}</div>
                                </div>
                              ) : (
                                <span className="font-mono text-xs">{sm.variantId}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">+{sm.quantity}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {reversalCashMovements.length > 0 && (
                <div>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">
                    Caja revertida
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Moneda</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="text-right">En {o.currency}</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reversalCashMovements.map((cm) => {
                        const code = cm.currencyCode ?? o.currency;
                        const dp = getCurrencyDecimalPlaces(code);
                        const majorAmount = cm.amount / Math.pow(10, dp);
                        const dpPrimary = getCurrencyDecimalPlaces(o.currency);
                        const majorInPrimary = cm.amountInPrimary / Math.pow(10, dpPrimary);
                        return (
                          <TableRow key={cm.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Intl.DateTimeFormat('es-PY', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              }).format(new Date(cm.createdAt))}
                            </TableCell>
                            <TableCell>
                              {cm.kind === 'sale_return_out' ? (
                                <Badge variant="warning">Reembolso</Badge>
                              ) : cm.kind === 'sale_cancel_out' ? (
                                <Badge variant="destructive">Cancelación</Badge>
                              ) : (
                                <span>{cm.kind}</span>
                              )}
                            </TableCell>
                            <TableCell className="capitalize text-muted-foreground">
                              {cm.paymentMethod ?? '—'}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{code}</TableCell>
                            <TableCell className="text-right font-mono">
                              −{formatAmount(majorAmount, code)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              −{formatAmount(majorInPrimary, o.currency)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {cm.reason ?? '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions */}
      <div className="mt-8 flex gap-3">
        {canMarkAsPaid && primaryPayment && (
          <form
            action={async () => {
              'use server';
              await markPaymentAsPaid(primaryPayment.id);
            }}
          >
            <Button type="submit" variant="default">
              Marcar como pagado
            </Button>
          </form>
        )}
        {canCancel && o.channel !== 'pos' && (
          <form
            action={async () => {
              'use server';
              await cancelOrder(o.id);
            }}
          >
            <Button type="submit" variant="destructive">
              Cancelar pedido
            </Button>
          </form>
        )}
      </div>

      {o.channel === 'pos' && (
        <PosOrderActions
          orderId={o.id}
          channel={o.channel}
          status={o.status}
          lines={lines.map((l) => {
            const v = variantMap.get(l.variantId);
            return {
              id: l.id,
              variantId: l.variantId,
              variantSku: v?.sku ?? null,
              variantName: v?.name ?? null,
              quantity: l.quantity,
              returnedQuantity: l.returnedQuantity,
              cancelledQuantity: l.cancelledQuantity,
              unitPrice: l.unitPrice,
            };
          })}
        />
      )}
    </div>
  );
}
