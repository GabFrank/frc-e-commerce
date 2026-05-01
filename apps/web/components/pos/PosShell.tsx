'use client';

import { useEffect, useRef, useState } from 'react';
import type { TenantMemberRole } from '@frc-e-commerce/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePosCart, calcTotal } from '@/lib/stores/usePosCart';
import { SearchDialog } from './SearchDialog';
import { VariantDialog } from './VariantDialog';
import { LineDetailDialog } from './LineDetailDialog';
import { PosCart } from './PosCart';
import { CartTotals } from './CartTotals';
import type { PosVariantOption } from '@/lib/actions/pos-search';

export type PosCurrencyContext = {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isPrimary: boolean;
  currentBuyRate: string | null;
  currentSellRate: string | null;
};

export type PosTenantContext = {
  tenantSlug: string;
  tenantName: string;
  cashierName: string;
  cashierEmail: string;
  role: TenantMemberRole;
  primaryCurrency: string;
  currencies: PosCurrencyContext[];
  posConfig: {
    enabledCurrencies: string[];
    pricingDisplayCurrencies: string[];
    paymentMethods: string[];
    searchShowImages: boolean;
    showCostToAdmin: boolean;
    strictStock: boolean;
  };
  canSeeCost: boolean;
  canChangeCurrency: boolean;
  canMarkComplimentary: boolean;
  canEditPrice: boolean;
};

export function PosShell({ ctx }: { ctx: PosTenantContext }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [variantDialog, setVariantDialog] = useState<{
    productId: string;
    productName: string;
  } | null>(null);
  const [lineDialog, setLineDialog] = useState<PosVariantOption | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cart = usePosCart();
  const totals = calcTotal({
    lines: cart.lines,
    generalDiscount: cart.generalDiscount,
    surcharge: cart.surcharge,
  });

  // Atajos globales
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'F12') {
        e.preventDefault();
        // TODO M4: abrir checkout
        alert('F12 (cobrar) — disponible en M4');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const onPickProduct = (productId: string, productName: string, single: PosVariantOption | null) => {
    setSearchOpen(false);
    if (single) {
      setLineDialog(single);
    } else {
      setVariantDialog({ productId, productName });
    }
  };

  const onPickVariant = (v: PosVariantOption) => {
    setVariantDialog(null);
    setLineDialog(v);
  };

  return (
    <div className="grid flex-1 grid-cols-[1fr_400px] overflow-hidden">
      {/* Izquierda: búsqueda + atajos */}
      <section className="flex flex-col gap-4 p-4 overflow-y-auto">
        <div className="flex gap-2">
          <Input
            ref={searchInputRef}
            placeholder="Buscar producto, SKU o escanear código (F2)"
            className="h-12 text-base"
            onFocus={() => setSearchOpen(true)}
            onClick={() => setSearchOpen(true)}
            readOnly
          />
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => setSearchOpen(true)}
          >
            Buscar
          </Button>
        </div>

        <div className="rounded-md border bg-card p-3 text-sm">
          <div className="font-medium">Cliente</div>
          <div className="mt-1 flex items-center justify-between">
            <div>
              <div>{cart.customer.name}</div>
              {cart.customer.document && (
                <div className="text-xs text-muted-foreground">Doc: {cart.customer.document}</div>
              )}
            </div>
            <Button variant="outline" size="sm" disabled title="M3 — selector de cliente próximamente">
              Cambiar (F3)
            </Button>
          </div>
        </div>

        <div className="rounded-md border bg-card p-3 text-sm">
          <div className="font-medium">Moneda de la venta</div>
          <div className="mt-1 flex items-center justify-between">
            <div>
              {cart.primaryCurrencyOverride ?? ctx.primaryCurrency}{' '}
              {cart.primaryCurrencyOverride && (
                <span className="text-xs text-amber-600">(override)</span>
              )}
            </div>
            {ctx.canChangeCurrency && (
              <select
                className="rounded border bg-background px-2 py-1 text-sm"
                value={cart.primaryCurrencyOverride ?? ctx.primaryCurrency}
                onChange={(e) => {
                  const v = e.target.value;
                  cart.setPrimaryOverride(v === ctx.primaryCurrency ? null : v);
                }}
              >
                {ctx.currencies
                  .filter((c) => ctx.posConfig.enabledCurrencies.includes(c.code))
                  .map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} ({c.symbol})
                    </option>
                  ))}
              </select>
            )}
          </div>
        </div>

        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground mb-1">Atajos</div>
          <ul className="grid grid-cols-2 gap-1">
            <li>F2 — Buscar producto</li>
            <li>F3 — Cliente (M3+)</li>
            <li>F4 — Descuento general (M4)</li>
            <li>F5 — Descuento línea (en detalle)</li>
            <li>F12 — Cobrar (M4)</li>
            <li>Esc — Cancelar diálogo</li>
          </ul>
        </div>
      </section>

      {/* Derecha: carrito */}
      <aside className="flex flex-col border-l bg-card overflow-hidden">
        <PosCart canSeeCost={ctx.canSeeCost} onEditLine={(line) => {
          // Abrir dialog de detalle prepoblado para edit
          setLineDialog({
            variantId: line.variantId,
            productId: line.productId,
            productName: line.productName,
            sku: line.sku,
            variantName: line.variantName,
            attributesLabel: line.attributesLabel,
            price: line.unitPrice,
            stock: line.availableStock,
            imageUrl: line.imageUrl,
          });
        }} />
        <CartTotals
          totals={totals}
          ctx={ctx}
          customCurrency={cart.primaryCurrencyOverride}
        />
      </aside>

      {searchOpen && (
        <SearchDialog
          ctx={ctx}
          onClose={() => setSearchOpen(false)}
          onPick={onPickProduct}
        />
      )}
      {variantDialog && (
        <VariantDialog
          productId={variantDialog.productId}
          productName={variantDialog.productName}
          onClose={() => setVariantDialog(null)}
          onPick={onPickVariant}
        />
      )}
      {lineDialog && (
        <LineDetailDialog
          variant={lineDialog}
          ctx={ctx}
          onClose={() => setLineDialog(null)}
        />
      )}
    </div>
  );
}
