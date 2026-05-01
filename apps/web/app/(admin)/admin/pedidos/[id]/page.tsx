import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatMoney } from '@frc-e-commerce/shared-utils';
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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PedidoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const detail = await getOrderDetail(id);

  if (!detail) notFound();

  const { order: o, lines, payments } = detail;
  const primaryPayment = payments[0] ?? null;
  const currency = o.currency as CurrencyCode;

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
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link
            href="/admin/pedidos"
            className="mb-2 inline-block text-sm text-muted-foreground hover:underline"
          >
            Pedidos
          </Link>
          <h1 className="font-mono text-2xl font-semibold">{o.orderNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{formattedDate}</p>
        </div>
        <div className="flex items-center gap-2">
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
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{line.variantId}</TableCell>
                  <TableCell className="text-right">
                    {formatMoney({ amount: line.unitPrice, currency })}
                  </TableCell>
                  <TableCell className="text-right">{line.quantity}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney({ amount: line.totalPrice, currency })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Totals */}
        <div className="mt-3 flex justify-end">
          <div className="w-64 space-y-1 text-sm">
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
        {canCancel && (
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
    </div>
  );
}
