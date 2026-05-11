'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Layers,
  Pencil,
  Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { createProductVariantSchema } from '@/lib/validators/product';
import {
  createProductVariant,
  setVariantActive,
  updateProductVariant,
} from '@/lib/actions/product';
import { sizeCatalogFor, type Gender, type SizeKind } from '@/lib/clothing/sizes';
import type { ProductVariant, ProductImage } from '@frc-e-commerce/db/schema';
import { ImageUploader } from './ImageUploader';
import { MatrixVariantDialog } from './MatrixVariantDialog';

type VariantFormValues = {
  sku: string;
  name: string;
  price: number;
  compareAtPrice: number;
  stock: number;
  color: string;
  size: string;
  sizeKind: SizeKind | '';
  active: boolean;
};

interface VariantFormProps {
  productId: string;
  productGender: Gender;
  variants: ProductVariant[];
  tenantSlug: string;
  imagesByVariant: Record<string, ProductImage[]>;
}

export function VariantForm({
  productId,
  productGender,
  variants: initialVariants,
  tenantSlug,
  imagesByVariant,
}: VariantFormProps) {
  const [variants, setVariants] = useState<ProductVariant[]>(initialVariants);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageVariantId, setImageVariantId] = useState<string | null>(null);
  const [matrixOpen, setMatrixOpen] = useState(false);

  // Re-sincroniza con server data cuando router.refresh() trae nuevas variantes (ej: matriz bulk-create).
  useEffect(() => {
    setVariants(initialVariants);
  }, [initialVariants]);

  const sizeCatalog = sizeCatalogFor(productGender);
  const knownColors = Array.from(
    new Set(variants.map((v) => v.color).filter((c): c is string => !!c))
  ).sort();

  // ── Filtros + paginación ─────────────────────────────────────────────────
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
  const [pageSize, setPageSize] = useState<number>(25);
  const [search, setSearch] = useState('');
  const [filterColor, setFilterColor] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(0);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const handleToggleActive = async (v: ProductVariant) => {
    setArchivingId(v.id);
    const next = !v.active;
    // Optimistic
    setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, active: next } : x)));
    const res = await setVariantActive(v.id, next);
    setArchivingId(null);
    if (!res.ok) {
      // Rollback
      setVariants((prev) => prev.map((x) => (x.id === v.id ? { ...x, active: v.active } : x)));
    }
  };

  // Variantes ordenadas por color → talle, después filtradas.
  const sortedVariants = useMemo(() => {
    return [...variants].sort((a, b) => {
      const ca = a.color ?? '';
      const cb = b.color ?? '';
      if (ca !== cb) return ca.localeCompare(cb);
      const sa = a.size ?? '';
      const sb = b.size ?? '';
      return sa.localeCompare(sb, undefined, { numeric: true });
    });
  }, [variants]);

  const filteredVariants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortedVariants.filter((v) => {
      if (q) {
        const hit = v.sku.toLowerCase().includes(q) || v.name.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (filterColor !== 'all') {
        const matchNoColor = filterColor === '__none__' && !v.color;
        const matchColor = v.color === filterColor;
        if (!matchNoColor && !matchColor) return false;
      }
      if (filterStatus === 'active' && !v.active) return false;
      if (filterStatus === 'inactive' && v.active) return false;
      return true;
    });
  }, [sortedVariants, search, filterColor, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredVariants.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageVariants = filteredVariants.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // Reset paginación cuando cambian filtros/tamaño y cerramos paneles abiertos para evitar confusión.
  useEffect(() => {
    setPage(0);
    setEditingId(null);
    setImageVariantId(null);
  }, [search, filterColor, filterStatus, pageSize]);

  const filtersActive = search.trim() !== '' || filterColor !== 'all' || filterStatus !== 'all';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Variantes</CardTitle>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setMatrixOpen(true)}
          >
            <Layers className="mr-1 h-3.5 w-3.5" /> Matriz color × talle
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setShowCreate((v) => !v);
              setEditingId(null);
            }}
          >
            {showCreate ? 'Cancelar' : '+ Agregar variante'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {variants.length > 0 ? (
          <>
            {/* Filtros */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar SKU o nombre…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-8"
                />
              </div>
              <Select
                value={filterColor}
                onChange={(e) => setFilterColor(e.target.value)}
                className="h-9 min-w-[8rem]"
              >
                <option value="all">Todos los colores</option>
                {knownColors.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__none__">— Sin color —</option>
              </Select>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
                className="h-9 min-w-[8rem]"
              >
                <option value="all">Todas</option>
                <option value="active">Activas</option>
                <option value="inactive">Inactivas</option>
              </Select>
            </div>

            {filteredVariants.length === 0 ? (
              <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
                Ninguna variante coincide con los filtros.
                {filtersActive && (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="ml-1"
                    onClick={() => {
                      setSearch('');
                      setFilterColor('all');
                      setFilterStatus('all');
                    }}
                  >
                    Limpiar filtros
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y rounded-md border">
                {pageVariants.map((v) => {
                  const variantImages = imagesByVariant[v.id] ?? [];
                  const isEditing = editingId === v.id;
                  const showingImages = imageVariantId === v.id;
                  return (
                    <div key={v.id}>
                      {isEditing ? (
                        <VariantEditForm
                          variant={v}
                          sizeCatalog={sizeCatalog}
                          knownColors={knownColors}
                          onCancel={() => setEditingId(null)}
                          onSaved={(updated) => {
                            setVariants((prev) =>
                              prev.map((x) => (x.id === updated.id ? updated : x))
                            );
                            setEditingId(null);
                          }}
                        />
                      ) : (
                        <VariantRow
                          variant={v}
                          imageCount={variantImages.length}
                          imagesOpen={showingImages}
                          archiving={archivingId === v.id}
                          onEdit={() => {
                            setEditingId(v.id);
                            setImageVariantId(null);
                            setShowCreate(false);
                          }}
                          onToggleImages={() =>
                            setImageVariantId(showingImages ? null : v.id)
                          }
                          onToggleActive={() => handleToggleActive(v)}
                        />
                      )}
                      {showingImages && !isEditing && (
                        <div className="border-t bg-muted/30 p-4">
                          <ImageUploader
                            productId={productId}
                            tenantSlug={tenantSlug}
                            images={variantImages}
                            variantId={v.id}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Paginación (siempre visible si hay variantes filtradas) */}
            {filteredVariants.length > 0 && (
              <div className="flex flex-col items-stretch gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>
                    Mostrando{' '}
                    <span className="font-medium text-foreground">
                      {safePage * pageSize + 1}–
                      {Math.min((safePage + 1) * pageSize, filteredVariants.length)}
                    </span>{' '}
                    de {filteredVariants.length}
                    {filtersActive && variants.length !== filteredVariants.length && (
                      <span className="ml-1 text-xs">({variants.length} totales)</span>
                    )}
                  </span>
                  <Select
                    value={String(pageSize)}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="h-7 w-auto text-xs"
                    aria-label="Variantes por página"
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n} por página
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Anterior
                  </Button>
                  <span className="whitespace-nowrap text-sm font-medium">
                    Página {safePage + 1} de {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    Siguiente
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Aún no hay variantes.</p>
        )}

        {showCreate && (
          <CreateVariantForm
            productId={productId}
            sizeCatalog={sizeCatalog}
            knownColors={knownColors}
            onCreated={(created) => {
              setVariants((prev) => [...prev, created]);
              setShowCreate(false);
            }}
          />
        )}
      </CardContent>

      <MatrixVariantDialog
        open={matrixOpen}
        productId={productId}
        sizeCatalog={sizeCatalog}
        knownColors={knownColors}
        onClose={() => setMatrixOpen(false)}
      />
    </Card>
  );
}

function VariantRow({
  variant: v,
  imageCount,
  imagesOpen,
  archiving,
  onEdit,
  onToggleImages,
  onToggleActive,
}: {
  variant: ProductVariant;
  imageCount: number;
  imagesOpen: boolean;
  archiving: boolean;
  onEdit: () => void;
  onToggleImages: () => void;
  onToggleActive: () => void;
}) {
  return (
    <div
      className={`grid grid-cols-[auto_auto_1fr_auto_auto_auto_auto] items-center gap-3 px-3 py-2.5 text-sm transition-opacity ${
        v.active ? '' : 'opacity-60'
      }`}
    >
      {v.color ? (
        <span className="rounded-md border bg-secondary/40 px-2 py-1 text-center text-xs font-medium min-w-[3.5rem] truncate">
          {v.color}
        </span>
      ) : (
        <span className="rounded-md border bg-muted px-2 py-1 text-center text-xs text-muted-foreground min-w-[3.5rem]">
          —
        </span>
      )}
      {v.size ? (
        <span className="rounded-md border bg-primary/10 px-2 py-1 text-center font-mono font-semibold text-primary min-w-[3rem]">
          {v.size}
        </span>
      ) : (
        <span className="rounded-md border bg-muted px-2 py-1 text-center text-xs text-muted-foreground min-w-[3rem]">
          —
        </span>
      )}
      <div className="min-w-0">
        <div className="truncate font-medium">{v.name}</div>
        <div className="font-mono text-xs text-muted-foreground">{v.sku}</div>
      </div>
      <div className="text-right">
        <div className="font-mono">{v.price.toLocaleString('es-PY')}</div>
        <div className="text-xs text-muted-foreground">precio</div>
      </div>
      <div className="text-right">
        <div className="font-mono">{v.stock}</div>
        <div className="text-xs text-muted-foreground">stock</div>
      </div>
      <Badge variant={v.active ? 'success' : 'secondary'}>
        {v.active ? 'Activo' : 'Archivado'}
      </Badge>
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onEdit}
          title="Editar variante"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onToggleImages}
          title="Imágenes de la variante"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          <span className="ml-1 text-xs">{imageCount}</span>
          <span className="sr-only">{imagesOpen ? 'Cerrar imágenes' : 'Abrir imágenes'}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onToggleActive}
          disabled={archiving}
          title={v.active ? 'Archivar variante' : 'Reactivar variante'}
        >
          {v.active ? (
            <Archive className="h-3.5 w-3.5" />
          ) : (
            <ArchiveRestore className="h-3.5 w-3.5 text-primary" />
          )}
          <span className="sr-only">
            {v.active ? 'Archivar' : 'Reactivar'}
          </span>
        </Button>
      </div>
    </div>
  );
}

function CreateVariantForm({
  productId,
  sizeCatalog,
  knownColors,
  onCreated,
}: {
  productId: string;
  sizeCatalog: { kind: SizeKind; values: readonly string[] };
  knownColors: string[];
  onCreated: (v: ProductVariant) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VariantFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createProductVariantSchema) as any,
    defaultValues: {
      stock: 0,
      active: true,
      compareAtPrice: 0,
      price: 0,
      color: '',
      size: '',
      sizeKind: '',
    },
  });

  const onSubmit: SubmitHandler<VariantFormValues> = async (data) => {
    setServerError(null);
    const sizeValue = data.size?.trim() || null;
    const colorValue = data.color?.trim() || null;
    const sizeKindValue: SizeKind | null = sizeValue ? sizeCatalog.kind : null;
    const res = await createProductVariant(productId, {
      sku: data.sku,
      name: data.name,
      price: data.price,
      compareAtPrice: data.compareAtPrice || undefined,
      stock: data.stock,
      color: colorValue,
      size: sizeValue,
      sizeKind: sizeKindValue,
      active: data.active,
      attributes: {},
    });
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    const optimistic: ProductVariant = {
      id: res.variantId,
      productId,
      tenantId: '',
      sku: data.sku,
      name: data.name,
      price: data.price,
      compareAtPrice: data.compareAtPrice || null,
      stock: data.stock,
      color: colorValue,
      size: sizeValue,
      sizeKind: sizeKindValue,
      attributes: {},
      active: data.active,
    };
    onCreated(optimistic);
    reset();
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-md border bg-muted/30 p-4"
    >
      <div className="text-sm font-medium">Nueva variante</div>
      <VariantFormFields
        register={register}
        errors={errors}
        sizeCatalog={sizeCatalog}
        knownColors={knownColors}
        onSizeChange={(s) => setValue('sizeKind', s ? sizeCatalog.kind : '')}
      />
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} size="sm">
        {isSubmitting ? 'Guardando…' : 'Guardar variante'}
      </Button>
    </form>
  );
}

function VariantEditForm({
  variant,
  sizeCatalog,
  knownColors,
  onCancel,
  onSaved,
}: {
  variant: ProductVariant;
  sizeCatalog: { kind: SizeKind; values: readonly string[] };
  knownColors: string[];
  onCancel: () => void;
  onSaved: (v: ProductVariant) => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<VariantFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createProductVariantSchema) as any,
    defaultValues: {
      sku: variant.sku,
      name: variant.name,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice ?? 0,
      stock: variant.stock,
      color: variant.color ?? '',
      size: variant.size ?? '',
      sizeKind: (variant.sizeKind as SizeKind | null) ?? '',
      active: variant.active,
    },
  });

  const onSubmit: SubmitHandler<VariantFormValues> = async (data) => {
    setServerError(null);
    const sizeValue = data.size?.trim() || null;
    const colorValue = data.color?.trim() || null;
    const sizeKindValue: SizeKind | null = sizeValue ? sizeCatalog.kind : null;
    const res = await updateProductVariant(variant.id, {
      sku: data.sku,
      name: data.name,
      price: data.price,
      compareAtPrice: data.compareAtPrice || null,
      stock: data.stock,
      color: colorValue,
      size: sizeValue,
      sizeKind: sizeKindValue,
      active: data.active,
    });
    if (!res.ok) {
      setServerError(res.error);
      return;
    }
    onSaved({
      ...variant,
      sku: data.sku,
      name: data.name,
      price: data.price,
      compareAtPrice: data.compareAtPrice || null,
      stock: data.stock,
      color: colorValue,
      size: sizeValue,
      sizeKind: sizeKindValue,
      active: data.active,
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 border-l-4 border-primary bg-muted/30 p-4"
    >
      <div className="text-sm font-medium">Editar variante</div>
      <VariantFormFields
        register={register}
        errors={errors}
        sizeCatalog={sizeCatalog}
        knownColors={knownColors}
        onSizeChange={(s) => setValue('sizeKind', s ? sizeCatalog.kind : '')}
      />
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting} size="sm">
          {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

type FormFieldsProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: any;
  sizeCatalog: { kind: SizeKind; values: readonly string[] };
  knownColors: string[];
  onSizeChange: (size: string) => void;
};

function VariantFormFields({ register, errors, sizeCatalog, knownColors, onSizeChange }: FormFieldsProps) {
  return (
    <>
      {/* hidden input para que sizeKind viaje con el form data */}
      <input type="hidden" {...register('sizeKind')} />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" {...register('sku')} />
          {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="variantName">Nombre de variante</Label>
          <Input id="variantName" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="color">
            Color{' '}
            <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="color"
            list="known-colors"
            placeholder="Ej: Rojo, Azul Marino, Negro"
            {...register('color')}
          />
          {knownColors.length > 0 && (
            <datalist id="known-colors">
              {knownColors.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          )}
          {errors.color && <p className="text-xs text-destructive">{errors.color.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="size">
            Talle{' '}
            <span className="text-xs font-normal text-muted-foreground">
              ({sizeCatalog.kind === 'number_kids' ? 'infantil — por edad' : 'adulto — por letras'})
            </span>
          </Label>
          <Select
            id="size"
            {...register('size', {
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onSizeChange(e.target.value),
            })}
          >
            <option value="">— Sin talle —</option>
            {sizeCatalog.values.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
          {errors.size && <p className="text-xs text-destructive">{errors.size.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="price">Precio</Label>
          <Input id="price" type="number" min={0} {...register('price', { valueAsNumber: true })} />
          {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="compareAtPrice">Precio comparación</Label>
          <Input
            id="compareAtPrice"
            type="number"
            min={0}
            {...register('compareAtPrice', { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stock">Stock</Label>
          <Input id="stock" type="number" min={0} {...register('stock', { valueAsNumber: true })} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="variantActive"
          className="h-4 w-4 rounded border-input"
          {...register('active')}
        />
        <Label htmlFor="variantActive" className="cursor-pointer">
          Variante activa
        </Label>
      </div>
    </>
  );
}
