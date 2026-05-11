'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

type Option = { value: string; label: string };

export function CajaSalesFilters({
  paymentMethods,
  currencies,
}: {
  paymentMethods: Option[];
  currencies: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp?.toString() ?? '');
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if ('from' in patch || 'to' in patch || 'method' in patch || 'currency' in patch || 'product' in patch || 'status' in patch || 'pageSize' in patch) {
      next.delete('page');
    }
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`);
    });
  };

  const get = (k: string) => sp?.get(k) ?? '';

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
      <label className="col-span-2 text-xs md:col-span-1">
        <span className="block text-muted-foreground">Desde</span>
        <Input
          type="datetime-local"
          value={get('from')}
          onChange={(e) => update({ from: e.target.value })}
          disabled={pending}
        />
      </label>
      <label className="col-span-2 text-xs md:col-span-1">
        <span className="block text-muted-foreground">Hasta</span>
        <Input
          type="datetime-local"
          value={get('to')}
          onChange={(e) => update({ to: e.target.value })}
          disabled={pending}
        />
      </label>
      <label className="text-xs">
        <span className="block text-muted-foreground">Método</span>
        <Select
          value={get('method')}
          onChange={(e) => update({ method: e.target.value || null })}
          disabled={pending}
        >
          <option value="">Todos</option>
          {paymentMethods.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="text-xs">
        <span className="block text-muted-foreground">Moneda</span>
        <Select
          value={get('currency')}
          onChange={(e) => update({ currency: e.target.value || null })}
          disabled={pending}
        >
          <option value="">Todas</option>
          {currencies.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="text-xs">
        <span className="block text-muted-foreground">Estado</span>
        <Select
          value={get('status')}
          onChange={(e) => update({ status: e.target.value || null })}
          disabled={pending}
        >
          <option value="">Todas</option>
          <option value="active">Activas</option>
          <option value="cancelled">Canceladas</option>
        </Select>
      </label>
      <label className="col-span-2 text-xs md:col-span-1">
        <span className="block text-muted-foreground">Producto / SKU</span>
        <Input
          type="search"
          placeholder="nombre o SKU"
          defaultValue={get('product')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') update({ product: (e.target as HTMLInputElement).value || null });
          }}
          disabled={pending}
        />
      </label>
      <div className="col-span-2 flex items-end justify-between gap-2 md:col-span-6">
        <label className="text-xs">
          <span className="block text-muted-foreground">Por página</span>
          <Select
            value={get('pageSize') || '25'}
            onChange={(e) => update({ pageSize: e.target.value })}
            className="w-24"
            disabled={pending}
          >
            <option value="15">15</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </Select>
        </label>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            update({
              from: null,
              to: null,
              method: null,
              currency: null,
              status: null,
              product: null,
              page: null,
              pageSize: null,
            })
          }
          disabled={pending}
        >
          Limpiar filtros
        </Button>
      </div>
    </div>
  );
}
