'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { ChevronDown, ChevronRight, Loader2, Package } from 'lucide-react';
import { formatAmount, formatNumber } from '@frc-e-commerce/shared-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ProductStatusBadge } from '@/components/admin/products/ProductStatusBadge';
import {
  listProductVariantsForAdmin,
  type AdminVariantRow,
} from '@/lib/actions/product';

export type ProductRow = {
  id: string;
  name: string;
  slug: string;
  status: 'draft' | 'active' | 'archived';
  gender: string;
  basePrice: number;
  currency: string;
  imageUrl: string | null;
  variantCount: number;
  colorCount: number;
  sizeCount: number;
  totalStock: number;
  firstSku: string | null;
};

export type ProductsFilters = {
  q: string;
  status: string;
  stock: string;
  gender: string;
  page: number;
  pageSize: number;
};

type Props = {
  rows: ProductRow[];
  total: number;
  filters: ProductsFilters;
};

const PAGE_SIZES = [25, 50, 100];

export function ProductsListClient({ rows, total, filters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendingNav, startNav] = useTransition();
  const [q, setQ] = useState(filters.q);

  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  const updateParams = (patch: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams?.toString() ?? '');
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '' || v === 'all') {
        next.delete(k);
      } else {
        next.set(k, String(v));
      }
    }
    // Reset page si cambia un filtro distinto de page o pageSize
    if (!('page' in patch)) next.delete('page');
    startNav(() => {
      router.push(`/admin/productos?${next.toString()}`);
    });
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ q });
  };

  const clearFilters = () => {
    setQ('');
    startNav(() => {
      router.push('/admin/productos');
    });
  };

  const hasActiveFilters =
    filters.q !== '' ||
    filters.status !== 'all' ||
    filters.stock !== 'all' ||
    filters.gender !== 'all';

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-2 rounded-md border bg-card p-3">
        <form onSubmit={submitSearch} className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground">Búsqueda</label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre, slug o SKU…"
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
            <option value="active">Activo</option>
            <option value="draft">Borrador</option>
            <option value="archived">Archivado</option>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Stock</label>
          <Select
            value={filters.stock}
            onChange={(e) => updateParams({ stock: e.target.value })}
            className="h-9"
          >
            <option value="all">Todos</option>
            <option value="with">Con stock</option>
            <option value="without">Sin stock</option>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Género</label>
          <Select
            value={filters.gender}
            onChange={(e) => updateParams({ gender: e.target.value })}
            className="h-9"
          >
            <option value="all">Todos</option>
            <option value="masculino">Masculino</option>
            <option value="femenino">Femenino</option>
            <option value="unisex">Unisex</option>
            <option value="infantil">Infantil</option>
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

      {/* Tabla */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
          <p className="mb-4 text-sm text-muted-foreground">
            {hasActiveFilters
              ? 'No hay productos que coincidan con los filtros.'
              : 'Aún no hay productos. Creá el primero.'}
          </p>
          {hasActiveFilters ? (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          ) : (
            <Link href="/admin/productos/new">
              <Button variant="outline">+ Nuevo producto</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/80 text-left text-muted-foreground backdrop-blur">
              <tr>
                <th className="w-8 px-2 py-2"></th>
                <th className="px-3 py-2">Producto</th>
                <th className="px-3 py-2">SKU / Variantes</th>
                <th className="px-3 py-2">Stock</th>
                <th className="px-3 py-2">Precio base</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <ProductTableRow key={p.id} product={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div className="text-muted-foreground">
            Mostrando {(filters.page - 1) * filters.pageSize + 1}–
            {Math.min(filters.page * filters.pageSize, total)} de {total}
          </div>
          <div className="flex items-center gap-2">
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
            <span className="text-xs text-muted-foreground">
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
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────────

function ProductTableRow({ product: p }: { product: ProductRow }) {
  const [expanded, setExpanded] = useState(false);
  const [variants, setVariants] = useState<AdminVariantRow[] | null>(null);
  const [loadingVariants, startLoad] = useTransition();
  const expandable = p.variantCount > 0;

  const handleToggle = () => {
    if (!expandable) return;
    const next = !expanded;
    setExpanded(next);
    if (next && variants === null) {
      startLoad(async () => {
        const rows = await listProductVariantsForAdmin(p.id);
        setVariants(rows);
      });
    }
  };

  return (
    <>
      <tr className="border-t transition-colors hover:bg-muted/50">
        <td className="px-2 py-2 text-center">
          {expandable ? (
            <button
              type="button"
              onClick={handleToggle}
              className="rounded p-0.5 hover:bg-muted"
              aria-label={expanded ? 'Colapsar' : 'Expandir'}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="block h-4 w-4" />
          )}
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            {p.imageUrl ? (
              <Image
                src={p.imageUrl}
                alt={p.name}
                width={36}
                height={36}
                className="h-9 w-9 rounded object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded bg-muted text-muted-foreground">
                <Package className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground capitalize">{p.gender}</div>
            </div>
          </div>
        </td>
        <td className="px-3 py-2 text-muted-foreground">
          {p.variantCount > 0 ? (
            <div className="space-y-0.5">
              {p.firstSku && <div className="font-mono text-xs">{p.firstSku}</div>}
              <div className="text-xs text-muted-foreground/80">
                {formatVariantsSummary(p)}
              </div>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground/80">Sin variantes</span>
          )}
        </td>
        <td className="px-3 py-2">
          {p.variantCount > 0 ? formatNumber(p.totalStock, 0) : '—'}
        </td>
        <td className="px-3 py-2">
          {p.basePrice > 0 ? (
            <>{formatAmount(p.basePrice, p.currency)}</>
          ) : (
            <span className="text-xs text-muted-foreground/80">—</span>
          )}
        </td>
        <td className="px-3 py-2">
          <ProductStatusBadge status={p.status} />
        </td>
        <td className="px-3 py-2">
          <Link
            href={`/admin/productos/${p.id}`}
            className="text-xs text-primary hover:underline"
          >
            Editar
          </Link>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t bg-muted/30">
          <td colSpan={7} className="px-4 py-3">
            {loadingVariants ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Cargando variantes…
              </div>
            ) : variants && variants.length > 0 ? (
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1">SKU</th>
                    <th className="px-2 py-1">Color</th>
                    <th className="px-2 py-1">Talle</th>
                    <th className="px-2 py-1">Stock</th>
                    <th className="px-2 py-1">Precio</th>
                    <th className="px-2 py-1">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v) => (
                    <tr key={v.variantId} className="border-t border-muted/50">
                      <td className="px-2 py-1 font-mono">{v.sku}</td>
                      <td className="px-2 py-1">{v.color ?? '—'}</td>
                      <td className="px-2 py-1">
                        {v.size ? (
                          <>
                            {v.size}
                            {v.sizeKind && (
                              <span className="ml-1 text-muted-foreground/70">
                                ({v.sizeKind})
                              </span>
                            )}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-2 py-1">{formatNumber(v.stock, 0)}</td>
                      <td className="px-2 py-1">
                        {v.price > 0 ? formatAmount(v.price, p.currency) : '—'}
                      </td>
                      <td className="px-2 py-1">
                        {v.active ? (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                            Activa
                          </span>
                        ) : (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            Archivada
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-xs text-muted-foreground">Sin variantes para mostrar.</div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function formatVariantsSummary(p: ProductRow): string {
  if (p.colorCount > 0 && p.sizeCount > 0) {
    return `${p.colorCount} ${p.colorCount === 1 ? 'color' : 'colores'} × ${p.sizeCount} ${
      p.sizeCount === 1 ? 'talle' : 'talles'
    } (${p.variantCount})`;
  }
  if (p.colorCount > 0) {
    return `${p.colorCount} ${p.colorCount === 1 ? 'color' : 'colores'} (${p.variantCount})`;
  }
  if (p.sizeCount > 0) {
    return `${p.sizeCount} ${p.sizeCount === 1 ? 'talle' : 'talles'} (${p.variantCount})`;
  }
  return `${p.variantCount} ${p.variantCount === 1 ? 'variante' : 'variantes'}`;
}
