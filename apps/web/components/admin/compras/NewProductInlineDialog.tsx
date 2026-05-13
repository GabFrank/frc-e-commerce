'use client';

import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Label } from '@/components/ui/label';
import { getCurrencyDecimalPlaces } from '@frc-e-commerce/shared-utils';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createProduct } from '@/lib/actions/product';
import { getVariantsForProductPurchase, type PurchaseVariantOption } from '@/lib/actions/purchase-search';
import { GENDERS, sizeCatalogFor, type Gender } from '@/lib/clothing/sizes';
import { slugify } from '@frc-e-commerce/shared-utils';
import { MatrixVariantDialog } from '@/components/admin/products/MatrixVariantDialog';

type Props = {
  open: boolean;
  initialName?: string;
  primaryCurrencyCode: string;
  onClose: () => void;
  onCreated: (variants: PurchaseVariantOption[]) => void;
};

type Step = 'product' | 'matrix-prompt' | 'matrix' | 'finalizing';

export function NewProductInlineDialog({
  open,
  initialName,
  primaryCurrencyCode,
  onClose,
  onCreated,
}: Props) {
  const [step, setStep] = useState<Step>('product');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);

  const [name, setName] = useState(initialName ?? '');
  const [slug, setSlug] = useState('');
  const [gender, setGender] = useState<Gender>('unisex');
  const [basePrice, setBasePrice] = useState(0);
  const [slugTouched, setSlugTouched] = useState(false);

  // Auto-slug desde name si el usuario no lo editó
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  useEffect(() => {
    if (open) {
      setStep('product');
      setError(null);
      setCreatedProductId(null);
      setName(initialName ?? '');
      setSlug(initialName ? slugify(initialName) : '');
      setGender('unisex');
      setBasePrice(0);
      setSlugTouched(false);
    }
  }, [open, initialName]);

  const handleCreateProduct = () => {
    setError(null);
    if (name.trim().length < 2) {
      setError('Nombre con al menos 2 caracteres');
      return;
    }
    if (!slug) {
      setError('El slug no puede estar vacío');
      return;
    }
    startTransition(async () => {
      const res = await createProduct({
        name: name.trim(),
        slug,
        status: 'active',
        gender,
        basePrice: Math.max(0, Math.floor(basePrice)),
        currency: primaryCurrencyCode,
        taxIncluded: false,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCreatedProductId(res.productId);
      setStep('matrix-prompt');
    });
  };

  const finalizeWithDefault = async () => {
    if (!createdProductId) return;
    setStep('finalizing');
    const res = await getVariantsForProductPurchase(createdProductId);
    if (!res.ok) {
      setError(res.error);
      setStep('matrix-prompt');
      return;
    }
    onCreated(res.results);
  };

  const finalizeWithMatrix = async () => {
    if (!createdProductId) return;
    setStep('finalizing');
    const res = await getVariantsForProductPurchase(createdProductId);
    if (!res.ok) {
      setError(res.error);
      setStep('matrix');
      return;
    }
    onCreated(res.results);
  };

  return (
    <>
      <Dialog
        open={open && step !== 'matrix'}
        onOpenChange={(o) => {
          if (!o && step !== 'matrix') onClose();
        }}
      >
        <DialogContent className="max-w-lg">
          {step === 'product' && (
            <>
              <DialogHeader>
                <DialogTitle>Nuevo producto</DialogTitle>
                <DialogDescription>
                  Creá el producto base. Después podés generar variantes color × talle.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="np-name">Nombre *</Label>
                  <Input
                    id="np-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                    disabled={pending}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="np-slug">Slug *</Label>
                  <Input
                    id="np-slug"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setSlugTouched(true);
                    }}
                    disabled={pending}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="np-gender">Género</Label>
                    <Select
                      id="np-gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value as Gender)}
                      disabled={pending}
                    >
                      {GENDERS.map((g) => (
                        <option key={g.code} value={g.code}>
                          {g.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="np-price">Precio base ({primaryCurrencyCode})</Label>
                    <MoneyInput
                      id="np-price"
                      value={basePrice || null}
                      onChange={(v) => setBasePrice(v ?? 0)}
                      decimalPlaces={getCurrencyDecimalPlaces(primaryCurrencyCode)}
                      placeholder="0 (se define después)"
                      disabled={pending}
                    />
                  </div>
                </div>
                {error && (
                  <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={onClose} disabled={pending}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateProduct} disabled={pending}>
                  {pending ? 'Creando…' : 'Continuar'}
                </Button>
              </DialogFooter>
            </>
          )}

          {step === 'matrix-prompt' && (
            <>
              <DialogHeader>
                <DialogTitle>¿Generar variantes ahora?</DialogTitle>
                <DialogDescription>
                  El producto fue creado con una variante &quot;Default&quot;. Si querés cargar
                  colores y talles, abrí la matriz; sino agregamos la default y seguís.
                </DialogDescription>
              </DialogHeader>

              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={finalizeWithDefault} disabled={pending}>
                  Saltar (usar Default)
                </Button>
                <Button onClick={() => setStep('matrix')} disabled={pending}>
                  Abrir matriz color × talle
                </Button>
              </DialogFooter>
            </>
          )}

          {step === 'finalizing' && (
            <>
              <DialogHeader>
                <DialogTitle>Cargando variantes…</DialogTitle>
                <DialogDescription>
                  Trayendo las variantes recién creadas para agregarlas al pedido.
                </DialogDescription>
              </DialogHeader>
              <div className="py-6 text-center text-sm text-muted-foreground">
                Un momento…
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {step === 'matrix' && createdProductId && (
        <MatrixVariantDialog
          open
          productId={createdProductId}
          productCurrency={primaryCurrencyCode}
          sizeCatalog={sizeCatalogFor(gender)}
          knownColors={[]}
          onClose={() => {
            // Cuando se cierra la matriz, recolectamos todas las variantes generadas
            finalizeWithMatrix();
          }}
        />
      )}
    </>
  );
}
