import Link from 'next/link';
import { ArrowRight, Receipt, Truck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatAmount, getCurrencyDecimalPlaces } from '@frc-e-commerce/shared-utils';
import type { RecentTicket, RecentPurchaseOrder } from '../reportes/_lib/queries';

const PO_STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  placed: 'Pedida',
  received: 'Recibida',
  partially_received: 'Parcial',
  cancelled: 'Cancelada',
};

const PO_STATUS_COLOR: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  placed: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  received: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
  partially_received: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200',
  cancelled: 'bg-destructive/10 text-destructive',
};

export function RecentActivity({
  tickets,
  pos,
}: {
  tickets: RecentTicket[];
  pos: RecentPurchaseOrder[];
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Card>
        <CardContent className="py-4">
          <Header
            label="Últimas ventas"
            href="/admin/pedidos"
            icon={Receipt}
          />
          {tickets.length === 0 ? (
            <EmptyRow text="Sin ventas recientes" />
          ) : (
            <ul className="divide-y">
              {tickets.slice(0, 5).map((t) => {
                const dp = getCurrencyDecimalPlaces(t.currency);
                const totalMajor = Number(t.total) / Math.pow(10, dp);
                return (
                  <li key={t.id}>
                    <Link
                      href={`/admin/pedidos/${t.id}`}
                      className="flex items-center gap-2 py-2 text-sm hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs text-muted-foreground">
                          #{t.ticketCorrelative ?? t.orderNumber.slice(-6)}
                        </div>
                        <div className="truncate">
                          {t.customerName || (
                            <span className="text-muted-foreground">sin nombre</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">{formatAmount(totalMajor, t.currency)}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(t.createdAt).toLocaleTimeString('es-PY', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {t.methods.length > 0 && ' · ' + t.methods.join(', ')}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <Header
            label="Últimas compras"
            href="/admin/compras"
            icon={Truck}
          />
          {pos.length === 0 ? (
            <EmptyRow text="Sin compras recientes" />
          ) : (
            <ul className="divide-y">
              {pos.slice(0, 5).map((p) => {
                const dp = getCurrencyDecimalPlaces(p.currencyCode);
                const totalMajor = Number(p.totalInCurrency) / Math.pow(10, dp);
                return (
                  <li key={p.id}>
                    <Link
                      href={`/admin/compras/${p.id}`}
                      className="flex items-center gap-2 py-2 text-sm hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-xs text-muted-foreground">
                          {p.poNumber}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{p.supplierName}</span>
                          <span
                            className={`rounded px-1 py-0 text-[10px] ${
                              PO_STATUS_COLOR[p.status] ?? 'bg-muted'
                            }`}
                          >
                            {PO_STATUS_LABEL[p.status] ?? p.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">
                          {formatAmount(totalMajor, p.currencyCode)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(p.createdAt).toLocaleDateString('es-PY', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Header({
  label,
  href,
  icon: Icon,
}: {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        Ver todos <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
      {text}
    </div>
  );
}
