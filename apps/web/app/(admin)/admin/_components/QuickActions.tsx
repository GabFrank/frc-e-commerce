import Link from 'next/link';
import {
  ScanLine,
  Plus,
  Package,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type Action = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: 'primary' | 'default';
};

export function QuickActions({
  canSell,
  canPurchaseWrite,
  canProductWrite,
  canReports,
}: {
  canSell: boolean;
  canPurchaseWrite: boolean;
  canProductWrite: boolean;
  canReports: boolean;
}) {
  const actions: Action[] = [];

  if (canSell) {
    actions.push({
      label: 'Abrir POS',
      description: 'Nueva venta',
      href: '/pos',
      icon: ScanLine,
      tone: 'primary',
    });
  }
  if (canPurchaseWrite) {
    actions.push({
      label: 'Nueva orden de compra',
      description: 'Cargar PO',
      href: '/admin/compras/nueva',
      icon: Plus,
      tone: 'default',
    });
  }
  if (canProductWrite) {
    actions.push({
      label: 'Nuevo producto',
      description: 'Catálogo',
      href: '/admin/productos/nuevo',
      icon: Package,
      tone: 'default',
    });
  }
  if (canReports) {
    actions.push({
      label: 'Ver reportes',
      description: 'KPIs detallados',
      href: '/admin/reportes',
      icon: BarChart3,
      tone: 'default',
    });
  }

  if (actions.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Acciones rápidas
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {actions.map((a) => {
            const Icon = a.icon;
            const primaryClass =
              a.tone === 'primary'
                ? 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/15'
                : 'border-border bg-card hover:bg-muted/40';
            return (
              <Link
                key={a.href}
                href={a.href}
                className={`group flex items-center gap-3 rounded-lg border p-2.5 transition-colors ${primaryClass}`}
              >
                <div
                  className={`rounded-md p-2 ${
                    a.tone === 'primary' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-none">{a.label}</div>
                  <div className="text-xs text-muted-foreground">{a.description}</div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
