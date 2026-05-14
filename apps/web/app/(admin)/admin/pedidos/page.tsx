import Link from 'next/link';
import { formatMoney } from '@frc-e-commerce/shared-utils';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { listOrders } from '@/lib/actions/order';
import type { OrderStatus } from '@frc-e-commerce/db/schema';
import type { CurrencyCode } from '@frc-e-commerce/shared-utils';

// Map order status to badge variant + Spanish label
function statusBadge(status: OrderStatus): { variant: BadgeProps['variant']; label: string } {
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

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function PedidosPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const orders = await listOrders(status);

  const statusOptions: Array<{ value: string; label: string }> = [
    { value: '', label: 'Todos' },
    { value: 'pending', label: 'Pendientes' },
    { value: 'confirmed', label: 'Confirmados' },
    { value: 'processing', label: 'En proceso' },
    { value: 'shipped', label: 'Enviados' },
    { value: 'delivered', label: 'Entregados' },
    { value: 'cancelled', label: 'Cancelados' },
    { value: 'refunded', label: 'Reembolsados' },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">Pedidos</h1>
        <span className="text-sm text-muted-foreground">
          {orders.length} pedido{orders.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Status filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        {statusOptions.map((opt) => (
          <Link
            key={opt.value}
            href={opt.value ? `/admin/pedidos?status=${opt.value}` : '/admin/pedidos'}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              (status ?? '') === opt.value
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-foreground/80 border-border hover:border-foreground/40'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p className="text-lg font-medium">No hay pedidos</p>
          <p className="mt-1 text-sm">
            {status ? `Sin pedidos con estado "${status}"` : 'Aún no se recibieron pedidos'}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => {
                const { variant, label } = statusBadge(o.status);
                const formattedTotal = formatMoney({
                  amount: o.total,
                  currency: o.currency as CurrencyCode,
                });
                const formattedDate = new Intl.DateTimeFormat('es-PY', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }).format(new Date(o.createdAt));

                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {o.orderNumber}
                    </TableCell>
                    <TableCell>
                      <div>{o.customerName}</div>
                      <div className="text-xs text-muted-foreground">{o.customerEmail}</div>
                    </TableCell>
                    <TableCell className="font-medium">{formattedTotal}</TableCell>
                    <TableCell>
                      <Badge variant={variant}>{label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formattedDate}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/pedidos/${o.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Ver detalle
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
