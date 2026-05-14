'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { formatAmount } from '@frc-e-commerce/shared-utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  receivePurchaseOrder,
  cancelPurchaseOrder,
  deleteDraftPurchaseOrder,
} from '@/lib/actions/purchase-order';
import type { PurchaseOrder, Supplier } from '@frc-e-commerce/db/schema';

type POView = PurchaseOrder & { supplierName: string };

export type ComprasFilters = {
  q: string;
  status: string;
  supplierId: string;
  currencyCode: string;
  page: number;
  pageSize: number;
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  placed: 'Pedida',
  received: 'Recibida',
  partially_received: 'Parcial',
  cancelled: 'Cancelada',
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  placed: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  received: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
  partially_received: 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200',
  cancelled: 'bg-destructive/10 text-destructive',
};

const CURRENCIES = ['PYG', 'USD', 'BRL', 'ARS'];
const PAGE_SIZES = [25, 50, 100];

export function ComprasClient({
  rows,
  total,
  suppliers,
  hasActiveSuppliers,
  filters,
}: {
  rows: POView[];
  total: number;
  suppliers: Supplier[];
  hasActiveSuppliers: boolean;
  filters: ComprasFilters;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendingNav, startNav] = useTransition();
  const [q, setQ] = useState(filters.q);

  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  const updateParams = (patch: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '' || v === 'all') next.delete(k);
      else next.set(k, String(v));
    }
    if (!('page' in patch)) next.delete('page');
    startNav(() => {
      router.push(`/admin/compras?${next.toString()}`);
    });
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ q });
  };

  const clearFilters = () => {
    setQ('');
    startNav(() => router.push('/admin/compras'));
  };

  const hasActiveFilters =
    filters.q !== '' ||
    filters.status !== 'all' ||
    filters.supplierId !== 'all' ||
    filters.currencyCode !== 'all';

  return (
    <>
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/admin/compras/nueva">
            <Plus className="mr-1 h-4 w-4" /> Nueva orden de compra
          </Link>
        </Button>
      </div>

      {!hasActiveSuppliers && (
        <div className="rounded-md bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
          No hay proveedores cargados todavía. Al crear una PO podés crear el primero inline, o
          gestionar el listado en{' '}
          <a href="/admin/proveedores" className="underline">
            /admin/proveedores
          </a>
          .
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-2 rounded-md border bg-card p-3">
        <form onSubmit={submitSearch} className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground">Búsqueda</label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="PO, proveedor o nota…"
            className="h-9"
          />
        </form>
        <div>
          <label className="text-xs text-muted-foreground">Estado</label>
          <Select
            value={filters.status}
            onChange={(e) => updateParams({ status: e.target.value })}
            className="h-9"
          >
            <option value="all">Todos</option>
            <option value="draft">Borrador</option>
            <option value="placed">Pedida</option>
            <option value="received">Recibida</option>
            <option value="partially_received">Parcial</option>
            <option value="cancelled">Cancelada</option>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Proveedor</label>
          <Select
            value={filters.supplierId}
            onChange={(e) => updateParams({ supplier: e.target.value })}
            className="h-9"
          >
            <option value="all">Todos</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Moneda</label>
          <Select
            value={filters.currencyCode}
            onChange={(e) => updateParams({ currency: e.target.value })}
            className="h-9"
          >
            <option value="all">Todas</option>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        {hasActiveFilters && (
          <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
            Limpiar
          </Button>
        )}
        {pendingNav && (
          <span className="text-xs text-muted-foreground flex items-center">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Actualizando…
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {total} {total === 1 ? 'orden' : 'órdenes'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              {hasActiveFilters
                ? 'No hay órdenes que coincidan con los filtros.'
                : 'Sin órdenes todavía.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">PO</th>
                    <th className="px-3 py-2 text-left">Proveedor</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-left">Moneda</th>
                    <th className="px-3 py-2 text-left">Creada</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs">
                        <Link
                          href={`/admin/compras/${p.id}`}
                          className="text-primary hover:underline"
                        >
                          {p.poNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{p.supplierName}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs ${
                            STATUS_COLOR[p.status] ?? 'bg-muted'
                          }`}
                        >
                          {STATUS_LABEL[p.status] ?? p.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatAmount(Number(p.totalInCurrency), p.currencyCode)}
                      </td>
                      <td className="px-3 py-2 text-xs">{p.currencyCode}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString('es-PY')}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/admin/compras/${p.id}`}>Ver</Link>
                          </Button>
                          <POActions po={p} onRefresh={() => router.refresh()} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paginación */}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="text-muted-foreground">
            Mostrando {(filters.page - 1) * filters.pageSize + 1}–
            {Math.min(filters.page * filters.pageSize, total)} de {total}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted-foreground">Por página</label>
            <Select
              value={String(filters.pageSize)}
              onChange={(e) => updateParams({ pageSize: e.target.value, page: 1 })}
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
              disabled={filters.page <= 1 || pendingNav}
              onClick={() => updateParams({ page: filters.page - 1 })}
            >
              ← Anterior
            </Button>
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {filters.page} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={filters.page >= totalPages || pendingNav}
              onClick={() => updateParams({ page: filters.page + 1 })}
            >
              Siguiente →
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function POActions({ po, onRefresh }: { po: POView; onRefresh: () => void }) {
  const [pending, startTransition] = useTransition();

  const onReceive = () => {
    if (!confirm(`¿Recibir PO ${po.poNumber}? Esto suma stock y actualiza costos.`)) return;
    startTransition(async () => {
      const res = await receivePurchaseOrder({ purchaseOrderId: po.id });
      if (!res.ok) alert(res.error);
      else onRefresh();
    });
  };

  const onCancel = () => {
    if (!confirm(`¿Cancelar PO ${po.poNumber}? Si ya estaba recibida, se revertirá el stock.`))
      return;
    startTransition(async () => {
      const res = await cancelPurchaseOrder(po.id);
      if (!res.ok) alert(res.error);
      else onRefresh();
    });
  };

  const onDeleteDraft = () => {
    if (!confirm(`¿Eliminar el borrador ${po.poNumber}? Esta acción no se puede deshacer.`))
      return;
    startTransition(async () => {
      const res = await deleteDraftPurchaseOrder(po.id);
      if (!res.ok) alert(res.error);
      else onRefresh();
    });
  };

  return (
    <div className="flex justify-end gap-1">
      {po.status === 'draft' && (
        <>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/admin/compras/nueva?draftId=${po.id}`}>Continuar</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={onDeleteDraft} disabled={pending}>
            Eliminar
          </Button>
        </>
      )}
      {po.status === 'placed' && (
        <Button size="sm" variant="outline" onClick={onReceive} disabled={pending}>
          Recibir
        </Button>
      )}
      {(po.status === 'placed' || po.status === 'received') && (
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      )}
    </div>
  );
}
