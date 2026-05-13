import Link from 'next/link';
import { ArrowRight, Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatAmount, getCurrencyDecimalPlaces } from '@frc-e-commerce/shared-utils';
import type { TopProductRow } from '../reportes/_lib/queries';

export function TopProductsMini({
  rows,
  primaryCurrency,
}: {
  rows: TopProductRow[];
  primaryCurrency: string;
}) {
  const dp = getCurrencyDecimalPlaces(primaryCurrency);
  const fmt = (minor: number) => formatAmount(minor / Math.pow(10, dp), primaryCurrency);

  return (
    <Card>
      <CardContent className="py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Top productos
          </p>
          <Link
            href="/admin/reportes/productos"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
            <Package className="h-8 w-8 opacity-40" />
            <p>Sin ventas en el período</p>
          </div>
        ) : (
          <ol className="space-y-1.5">
            {rows.slice(0, 5).map((r, i) => (
              <li
                key={r.variantId}
                className="flex items-center gap-3 rounded-md px-1 py-1 hover:bg-muted/40"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-mono">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.productName}</div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {r.color && (
                      <span className="rounded border bg-secondary/40 px-1 py-0 text-[10px]">
                        {r.color}
                      </span>
                    )}
                    {r.size && (
                      <span className="rounded border bg-primary/10 px-1 py-0 font-mono text-[10px] font-semibold text-primary">
                        {r.size}
                      </span>
                    )}
                    <span className="truncate font-mono">{r.sku}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">{r.units} u</div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {fmt(r.revenue)}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
