'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LockKeyhole, Coins, ShoppingCart, MoreVertical } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { formatAmount } from '@frc-e-commerce/shared-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TenantMemberRole } from '@frc-e-commerce/db/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePosCart, calcTotal } from '@/lib/stores/usePosCart';
import { SearchDialog } from './SearchDialog';
import { VariantDialog } from './VariantDialog';
import { LineDetailDialog } from './LineDetailDialog';
import { PosCart } from './PosCart';
import { CartTotals } from './CartTotals';
import { OpenSessionDialog } from './cash/OpenSessionDialog';
import { CloseSessionDialog } from './cash/CloseSessionDialog';
import { CheckoutDialog } from './checkout/CheckoutDialog';
import { QuickRateDialog } from '@/components/admin/QuickRateDialog';
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
    primaryPaymentMethod: string | null;
    searchShowImages: boolean;
    showCostToAdmin: boolean;
    strictStock: boolean;
  };
  canSeeCost: boolean;
  canChangeCurrency: boolean;
  canMarkComplimentary: boolean;
  canEditPrice: boolean;
  canSetRate: boolean;
};

export type ActiveSessionInfo = {
  id: string;
  openedAt: Date;
  openCurrencies: string[];
};

export function PosShell({
  ctx,
  activeSession,
}: {
  ctx: PosTenantContext;
  activeSession: ActiveSessionInfo | null;
}) {
  const searchParams = useSearchParams();
  const shouldAutoClose = searchParams?.get('close') === '1' && !!activeSession;
  const [searchOpen, setSearchOpen] = useState(false);
  const [variantDialog, setVariantDialog] = useState<{
    productId: string;
    productName: string;
  } | null>(null);
  const [lineDialog, setLineDialog] = useState<PosVariantOption | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(shouldAutoClose);
  const [rateDialogOpen, setRateDialogOpen] = useState(false);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cart = usePosCart();
  const confirm = useConfirm();
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
      if (e.key === 'F9') {
        e.preventDefault();
        if (activeSession) setCloseOpen(true);
      }
      if (e.key === 'F12') {
        e.preventDefault();
        if (cart.lines.length === 0) return;
        if (!activeSession) {
          void confirm({
            mode: 'alert',
            title: 'Sin caja abierta',
            description: 'Necesitás abrir caja antes de cobrar.',
          });
          return;
        }
        setCheckoutOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeSession, cart.lines.length, confirm]);

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

  const primaryCurrency = cart.primaryCurrencyOverride ?? ctx.primaryCurrency;
  const totalItems = cart.lines.reduce((acc, l) => acc + l.quantity, 0);

  return (
    <>
      {/* Header: desktop full, mobile compacto */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-card px-3 text-sm md:h-12 md:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-4">
          <span className="truncate font-semibold">{ctx.tenantName} · POS</span>
          <span className="hidden text-muted-foreground md:inline">
            Cajero: <strong className="text-foreground">{ctx.cashierName}</strong> ({ctx.role})
          </span>
          {activeSession ? (
            <span className="hidden rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900 sm:inline">
              Caja abierta {new Date(activeSession.openedAt).toLocaleString('es-PY')}
            </span>
          ) : (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
              Sin caja
            </span>
          )}
        </div>
        {/* Acciones desktop */}
        <div className="hidden items-center gap-2 text-xs md:flex">
          {ctx.canSetRate && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setRateDialogOpen(true)}
              title="Cotizaciones"
            >
              <Coins className="mr-1 h-3.5 w-3.5" />
              Cotización
            </Button>
          )}
          {activeSession && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCloseOpen(true)}
              title="Cerrar caja (F9)"
            >
              <LockKeyhole className="mr-1 h-3.5 w-3.5" />
              Cerrar caja
            </Button>
          )}
          <Link href="/admin" className="text-muted-foreground hover:underline">
            ← Volver a admin
          </Link>
        </div>
        {/* Menú mobile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Más acciones"
              className="h-9 w-9 md:hidden"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {ctx.canSetRate && (
              <DropdownMenuItem onSelect={() => setRateDialogOpen(true)}>
                <Coins className="h-4 w-4" /> Cotización
              </DropdownMenuItem>
            )}
            {activeSession && (
              <DropdownMenuItem onSelect={() => setCloseOpen(true)}>
                <LockKeyhole className="h-4 w-4" /> Cerrar caja
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href="/admin">← Volver a admin</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
    <div className="flex flex-1 flex-col overflow-hidden md:grid md:grid-cols-[1fr_400px]">
      {/* Izquierda: búsqueda + atajos */}
      <section className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 pb-24 md:p-4 md:pb-4">
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
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <div>
              {cart.primaryCurrencyOverride ?? ctx.primaryCurrency}{' '}
              {cart.primaryCurrencyOverride && (
                <span className="text-xs text-amber-600">(override)</span>
              )}
            </div>
            {ctx.canChangeCurrency && (
              <select
                className="h-9 rounded border bg-background px-2 text-sm"
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

        <div className="hidden rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground md:block">
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

      {/* Derecha: carrito (desktop sidebar / mobile sheet) */}
      <aside className="hidden flex-col overflow-hidden border-l bg-card md:flex">
        <PosCart canSeeCost={ctx.canSeeCost} currency={primaryCurrency} onEditLine={(line) => {
          setLineDialog({
            variantId: line.variantId,
            productId: line.productId,
            productName: line.productName,
            sku: line.sku,
            variantName: line.variantName,
            color: line.color,
            size: line.size,
            sizeKind: line.sizeKind,
            attributesLabel: line.attributesLabel,
            price: line.unitPrice,
            currency: primaryCurrency,
            stock: line.availableStock,
            imageUrl: line.imageUrl,
          });
        }} />
        <CartTotals
          totals={totals}
          ctx={ctx}
          customCurrency={cart.primaryCurrencyOverride}
          canCheckout={!!activeSession}
          onCheckout={() => setCheckoutOpen(true)}
        />
      </aside>

      {/* Sticky mobile cart bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-2 border-t bg-card p-3 shadow-lg md:hidden">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => setCartSheetOpen(true)}
        >
          <ShoppingCart className="mr-2 h-4 w-4" />
          {totalItems > 0 ? `${totalItems} item${totalItems > 1 ? 's' : ''}` : 'Carrito'}
          {totals.total > 0 && (
            <span className="ml-2 font-mono text-xs">{formatAmount(totals.total, primaryCurrency)}</span>
          )}
        </Button>
        <Button
          type="button"
          size="lg"
          className="flex-1"
          disabled={!activeSession || totals.total === 0}
          onClick={() => setCheckoutOpen(true)}
        >
          Cobrar
        </Button>
      </div>

      {/* Mobile cart sheet */}
      <Sheet open={cartSheetOpen} onOpenChange={setCartSheetOpen}>
        <SheetContent
          side="bottom"
          className="flex h-[85vh] flex-col gap-0 p-0"
        >
          <div className="border-b p-4">
            <SheetTitle>Carrito ({totalItems})</SheetTitle>
          </div>
          <PosCart
            canSeeCost={ctx.canSeeCost}
            currency={primaryCurrency}
            onEditLine={(line) => {
              setCartSheetOpen(false);
              setLineDialog({
                variantId: line.variantId,
                productId: line.productId,
                productName: line.productName,
                sku: line.sku,
                variantName: line.variantName,
                color: line.color,
                size: line.size,
                sizeKind: line.sizeKind,
                attributesLabel: line.attributesLabel,
                price: line.unitPrice,
                currency: primaryCurrency,
                stock: line.availableStock,
                imageUrl: line.imageUrl,
              });
            }}
          />
          <CartTotals
            totals={totals}
            ctx={ctx}
            customCurrency={cart.primaryCurrencyOverride}
            canCheckout={!!activeSession}
            onCheckout={() => {
              setCartSheetOpen(false);
              setCheckoutOpen(true);
            }}
          />
        </SheetContent>
      </Sheet>

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
      {!activeSession && (
        <OpenSessionDialog ctx={ctx} onSuccess={() => setCheckoutOpen(false)} />
      )}
      {activeSession && checkoutOpen && (
        <CheckoutDialog open ctx={ctx} onClose={() => setCheckoutOpen(false)} />
      )}
      {activeSession && (
        <CloseSessionDialog
          open={closeOpen}
          cashSessionId={activeSession.id}
          openCurrencies={activeSession.openCurrencies}
          ctx={ctx}
          onClose={() => setCloseOpen(false)}
        />
      )}
      {ctx.canSetRate && (
        <QuickRateDialog
          open={rateDialogOpen}
          onClose={() => setRateDialogOpen(false)}
        />
      )}
    </div>
    </>
  );
}
