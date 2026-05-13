'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const KIND_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'purchase', label: 'Compra' },
  { value: 'purchase_return', label: 'Devol. proveedor' },
  { value: 'purchase_cancel', label: 'Cancel. compra' },
  { value: 'sale', label: 'Venta' },
  { value: 'sale_return', label: 'Devol. venta' },
  { value: 'sale_cancel', label: 'Cancel. venta' },
  { value: 'adjustment', label: 'Ajuste' },
];

const PAGE_SIZES = [25, 50, 100];

type Props = {
  initial: { q: string; kind: string; page: number; pageSize: number };
  total: number;
};

export function MovementsFilters({ initial, total }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startNav] = useTransition();
  const [q, setQ] = useState(initial.q);

  const totalPages = Math.max(1, Math.ceil(total / initial.pageSize));

  const update = (patch: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '' || v === 'all') next.delete(k);
      else next.set(k, String(v));
    }
    if (!('mvPage' in patch)) next.delete('mvPage');
    startNav(() => router.push(`?${next.toString()}`));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    update({ mvQ: q });
  };

  const clear = () => {
    setQ('');
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    for (const k of ['mvQ', 'mvKind', 'mvPage', 'mvPageSize']) next.delete(k);
    startNav(() => router.push(`?${next.toString()}`));
  };

  const hasFilters =
    initial.q !== '' ||
    initial.kind !== 'all' ||
    initial.pageSize !== 25 ||
    initial.page !== 1;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2 px-4 pt-3">
        <form onSubmit={submit} className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground">Búsqueda (SKU o producto)</label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Producto o SKU…"
            className="h-9"
          />
        </form>
        <div>
          <label className="text-xs text-muted-foreground">Tipo</label>
          <Select
            value={initial.kind}
            onChange={(e) => update({ mvKind: e.target.value })}
            className="h-9"
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        {hasFilters && (
          <Button type="button" variant="outline" size="sm" onClick={clear}>
            Limpiar
          </Button>
        )}
        {pending && (
          <span className="text-xs text-muted-foreground flex items-center">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Actualizando…
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs">
          <div className="text-muted-foreground">
            Mostrando {(initial.page - 1) * initial.pageSize + 1}–
            {Math.min(initial.page * initial.pageSize, total)} de {total}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-muted-foreground">Por página</label>
            <Select
              value={String(initial.pageSize)}
              onChange={(e) => update({ mvPageSize: e.target.value, mvPage: 1 })}
              className="h-8 w-20"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={initial.page <= 1 || pending}
              onClick={() => update({ mvPage: initial.page - 1 })}
            >
              ← Anterior
            </Button>
            <span className="text-muted-foreground">
              {initial.page} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={initial.page >= totalPages || pending}
              onClick={() => update({ mvPage: initial.page + 1 })}
            >
              Siguiente →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
