'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Plus, Minus, X, Pencil } from 'lucide-react';
import { formatAmount, getCurrencyDecimalPlaces } from '@frc-e-commerce/shared-utils';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { usePosCart, calcLineTotal, calcTotal } from '@/lib/stores/usePosCart';
import { createPosOrder } from '@/lib/actions/pos-order';
import type { PosTenantContext } from '../PosShell';

type Row = {
  id: string;
  kind: 'payment' | 'change';
  paymentMethod: string | null;
  currencyCode: string | null;
  amount: number;
  exchangeRateSnapshot: string | null;
};

type Adjustment = {
  amountInPrimary: number;
  /** Si se ingresó como % del total, se guarda para mostrar en el resumen. */
  pctValue: number | null;
};

const genId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function CheckoutDialog({
  open,
  ctx,
  onClose,
}: {
  open: boolean;
  ctx: PosTenantContext;
  onClose: () => void;
}) {
  const router = useRouter();
  const cart = usePosCart();
  const totals = calcTotal({
    lines: cart.lines,
    generalDiscount: cart.generalDiscount,
    surcharge: cart.surcharge,
  });
  const primary = cart.primaryCurrencyOverride ?? ctx.primaryCurrency;
  const primaryCfg = ctx.currencies.find((c) => c.code === primary);
  const primaryDecimalPlaces = primaryCfg?.decimalPlaces ?? 0;
  const enabledMethods = ctx.posConfig.paymentMethods;
  const defaultMethod =
    (ctx.posConfig.primaryPaymentMethod && enabledMethods.includes(ctx.posConfig.primaryPaymentMethod)
      ? ctx.posConfig.primaryPaymentMethod
      : enabledMethods[0]) ?? 'efectivo';
  const enabledCurrencies = ctx.currencies.filter((c) =>
    ctx.posConfig.enabledCurrencies.includes(c.code)
  );

  /**
   * Cotización para convertir moneda secundaria → primary.
   * Se usa la cotización de COMPRA (buy) — es lo que el comercio "paga" al recibir
   * moneda extranjera en una venta.
   */
  const getRateForCurrency = (code: string | null): string | null => {
    if (!code || code === primary) return null;
    const c = ctx.currencies.find((cc) => cc.code === code);
    return c?.currentBuyRate ?? null;
  };

  const computeAmountInPrimary = (r: Row): number => {
    if (!r.currencyCode || r.currencyCode === primary) return Math.round(r.amount);
    const rate = Number(r.exchangeRateSnapshot ?? getRateForCurrency(r.currencyCode));
    if (!rate) return 0;
    return Math.round(r.amount * rate);
  };

  const [rows, setRows] = useState<Row[]>(() => [
    {
      id: genId(),
      kind: 'payment',
      paymentMethod: defaultMethod,
      currencyCode: primary,
      amount: totals.total,
      exchangeRateSnapshot: null,
    },
  ]);
  const [discount, setDiscount] = useState<Adjustment | null>(null);
  const [surcharge, setSurcharge] = useState<Adjustment | null>(null);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [surchargeDialogOpen, setSurchargeDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ orderNumber: string; correlative: number } | null>(null);

  /** Cobrado real: payments suman, vueltos restan. */
  const sumCovered = (currentRows: Row[], excludeRowId: string | null): number => {
    return currentRows.reduce((acc, r) => {
      if (r.id === excludeRowId) return acc;
      const v = computeAmountInPrimary(r);
      if (r.kind === 'payment') return acc + v;
      if (r.kind === 'change') return acc - v;
      return acc;
    }, 0);
  };

  /** Saldo pendiente = totalEfectivo - cobrado, excluyendo la fila indicada. */
  const computeSaldoExcluding = (currentRows: Row[], excludeRowId: string | null): number => {
    const adjustmentsTotal = (surcharge?.amountInPrimary ?? 0) - (discount?.amountInPrimary ?? 0);
    const effective = totals.total + adjustmentsTotal;
    return effective - sumCovered(currentRows, excludeRowId);
  };

  /**
   * Convierte el saldo restante (en primary) a la moneda elegida,
   * usando la cotización de compra. Si saldo <= 0 devuelve 0.
   */
  const suggestedAmountForCurrency = (
    currentRows: Row[],
    rowId: string,
    currencyCode: string | null,
    rateStr: string | null
  ): number => {
    const saldoEnPrimary = computeSaldoExcluding(currentRows, rowId);
    if (saldoEnPrimary <= 0) return 0;
    if (!currencyCode || currencyCode === primary) {
      return Number(saldoEnPrimary.toFixed(primaryDecimalPlaces));
    }
    const rate = rateStr ? Number(rateStr) : null;
    if (!rate || rate === 0) return 0;
    const inSecondary = saldoEnPrimary / rate;
    const dp = getCurrencyDecimalPlaces(currencyCode);
    return Number(inSecondary.toFixed(dp));
  };

  const totalAdjustments = (surcharge?.amountInPrimary ?? 0) - (discount?.amountInPrimary ?? 0);
  const totalEffective = totals.total + totalAdjustments;
  const totalCovered = sumCovered(rows, null);
  /** Saldo pendiente positivo = falta cobrar. Negativo = vuelto a entregar. */
  const saldoPendiente = totalEffective - totalCovered;

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if (patch.kind !== undefined && patch.kind !== r.kind) {
          // Cambiar pago↔vuelto: el monto previo no aplica.
          next.amount = patch.kind === 'payment'
            ? suggestedAmountForCurrency(rs, id, next.currencyCode, next.exchangeRateSnapshot)
            : 0;
        }
        if (patch.currencyCode !== undefined) {
          const newRate = getRateForCurrency(patch.currencyCode);
          next.exchangeRateSnapshot = newRate;
          if (next.kind === 'payment') {
            next.amount = suggestedAmountForCurrency(rs, id, patch.currencyCode, newRate);
          }
        }
        return next;
      })
    );
  };

  const addRow = () =>
    setRows((rs) => {
      const id = genId();
      const suggested = suggestedAmountForCurrency(rs, id, primary, null);
      return [
        ...rs,
        {
          id,
          kind: 'payment',
          paymentMethod: defaultMethod,
          currencyCode: primary,
          amount: suggested,
          exchangeRateSnapshot: null,
        },
      ];
    });

  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));

  const hasAnyPayment = rows.some((r) => r.kind === 'payment' && r.amount > 0);
  /** Sugerencia inicial para el dialog de descuento (en primary). */
  const computeSuggestedDiscount = (): number => {
    if (!hasAnyPayment) {
      return Math.round(totals.total * 0.1);
    }
    return Math.max(0, saldoPendiente);
  };
  /** Sugerencia inicial para el dialog de aumento: cubrir el exceso. */
  const computeSuggestedSurcharge = (): number => Math.max(0, -saldoPendiente);

  const canApplyDiscount = saldoPendiente > 0 || discount !== null;
  const canApplySurcharge = saldoPendiente < 0 || surcharge !== null;

  const onConfirm = () => {
    if (saldoPendiente !== 0) {
      setError(`Saldo pendiente ${saldoPendiente} ≠ 0. Ajustá los cobros.`);
      return;
    }
    setError(null);
    startTransition(async () => {
      // payment_detail.amount es bigint → no acepta decimales. Convertimos a
      // unidades mínimas según los decimales de la moneda (191,30 BRL → 19130).
      // amountInPrimary queda en la moneda primary del tenant (PYG = 0 decimales
      // → no cambia; si en el futuro primary tuviera decimales habría que ajustar).
      const toMinorUnits = (amount: number, currencyCode: string | null): number => {
        const dp = getCurrencyDecimalPlaces(currencyCode ?? primary);
        return Math.round(amount * Math.pow(10, dp));
      };
      const syntheticDetails: Array<{
        kind: 'payment' | 'change' | 'discount' | 'surcharge';
        paymentMethod: string | null;
        currencyCode: string | null;
        amount: number;
        exchangeRateSnapshot: string | null;
        amountInPrimary: number;
      }> = rows.map((r) => ({
        kind: r.kind,
        paymentMethod: r.paymentMethod,
        currencyCode: r.currencyCode,
        amount: toMinorUnits(r.amount, r.currencyCode),
        exchangeRateSnapshot: r.exchangeRateSnapshot,
        amountInPrimary: computeAmountInPrimary(r),
      }));
      if (discount) {
        syntheticDetails.push({
          kind: 'discount',
          paymentMethod: null,
          currencyCode: primary,
          amount: toMinorUnits(discount.amountInPrimary, primary),
          exchangeRateSnapshot: null,
          amountInPrimary: discount.amountInPrimary,
        });
      }
      if (surcharge) {
        syntheticDetails.push({
          kind: 'surcharge',
          paymentMethod: null,
          currencyCode: primary,
          amount: toMinorUnits(surcharge.amountInPrimary, primary),
          exchangeRateSnapshot: null,
          amountInPrimary: surcharge.amountInPrimary,
        });
      }
      const res = await createPosOrder({
        customer: cart.customer,
        primaryCurrency: primary,
        subtotal: totals.subtotal,
        total: totals.total,
        generalDiscountAmount: totals.generalDiscountAmount,
        generalDiscountReason: cart.generalDiscount?.kind === 'pct'
          ? `${cart.generalDiscount.value}%`
          : undefined,
        surchargeAmount: totals.surchargeAmount,
        surchargeReason: cart.surcharge?.reason,
        notes: cart.notes,
        lines: cart.lines.map((l) => ({
          variantId: l.variantId,
          productName: l.productName,
          variantName: l.variantName,
          sku: l.sku,
          color: l.color,
          size: l.size,
          sizeKind: l.sizeKind,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          discountAmount:
            l.discount?.kind === 'amount'
              ? l.discount.value
              : l.discount?.kind === 'pct'
                ? Math.round(l.unitPrice * l.quantity * (l.discount.value / 100))
                : 0,
          discountReason:
            l.discount?.kind === 'pct' ? `${l.discount.value}%` : undefined,
          isComplimentary: l.isComplimentary,
          complimentaryAuthorizedBy: l.complimentaryAuthorizedBy,
          totalPrice: calcLineTotal(l),
        })),
        paymentDetails: syntheticDetails,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSuccess({ orderNumber: res.orderNumber, correlative: res.correlative });
      cart.reset();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          if (success) router.refresh();
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{success ? 'Cobro confirmado' : 'Cobro'}</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border bg-muted/40 p-4 text-center">
              <div className="text-2xl font-bold">{success.orderNumber}</div>
              <div className="text-muted-foreground">Ticket #{success.correlative}</div>
            </div>
            <div className="text-center text-muted-foreground">
              La venta se registró exitosamente. Stock decrementado, payment_detail guardado, caja
              actualizada con los movimientos en efectivo.
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => window.print()}>
                Imprimir ticket
              </Button>
              <Button
                onClick={() => {
                  onClose();
                  router.refresh();
                }}
              >
                Nueva venta
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-1 rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total a cobrar</span>
                <span className="font-mono">{formatAmount(totals.total, primary)}</span>
              </div>
              {surcharge && (
                <div className="flex items-center justify-between text-blue-700">
                  <span className="flex items-center gap-1">
                    Aumento
                    {surcharge.pctValue !== null && (
                      <span className="text-xs text-muted-foreground">({surcharge.pctValue}%)</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setSurchargeDialogOpen(true)}
                      className="ml-1 rounded p-0.5 hover:bg-muted"
                      title="Editar"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSurcharge(null)}
                      className="rounded p-0.5 hover:bg-muted"
                      title="Quitar"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                  <span className="font-mono">+{formatAmount(surcharge.amountInPrimary, primary)}</span>
                </div>
              )}
              {discount && (
                <div className="flex items-center justify-between text-amber-700">
                  <span className="flex items-center gap-1">
                    Descuento
                    {discount.pctValue !== null && (
                      <span className="text-xs text-muted-foreground">({discount.pctValue}%)</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setDiscountDialogOpen(true)}
                      className="ml-1 rounded p-0.5 hover:bg-muted"
                      title="Editar"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscount(null)}
                      className="rounded p-0.5 hover:bg-muted"
                      title="Quitar"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                  <span className="font-mono">−{formatAmount(discount.amountInPrimary, primary)}</span>
                </div>
              )}
              {totalAdjustments !== 0 && (
                <div className="flex justify-between border-t pt-1 font-medium">
                  <span>Total ajustado</span>
                  <span className="font-mono">{formatAmount(totalEffective, primary)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cobrado</span>
                <span className="font-mono">{formatAmount(totalCovered, primary)}</span>
              </div>
              <div className="flex items-baseline justify-between border-t pt-1">
                <span className="font-medium">
                  {saldoPendiente > 0
                    ? 'Saldo pendiente'
                    : saldoPendiente < 0
                      ? 'Vuelto a entregar'
                      : '✓ Saldo cero'}
                </span>
                <span
                  className={`text-xl font-bold font-mono ${
                    saldoPendiente === 0
                      ? 'text-green-700'
                      : saldoPendiente > 0
                        ? 'text-amber-700'
                        : 'text-blue-700'
                  }`}
                >
                  {formatAmount(Math.abs(saldoPendiente), primary)}
                </span>
              </div>
            </div>

            <div>
              {/* Desktop — tabla */}
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left">Tipo</th>
                      <th className="text-left">Método</th>
                      <th className="text-left">Moneda</th>
                      <th className="text-right">Monto</th>
                      <th className="text-right">Cotiz.</th>
                      <th className="text-right">En {primary}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="py-1">
                          <select
                            className="h-9 rounded border bg-background px-2 text-sm"
                            value={r.kind}
                            onChange={(e) =>
                              updateRow(r.id, { kind: e.target.value as Row['kind'] })
                            }
                          >
                            <option value="payment">Pago</option>
                            <option value="change">Vuelto</option>
                          </select>
                        </td>
                        <td>
                          <select
                            className="h-9 rounded border bg-background px-2 text-sm"
                            value={r.paymentMethod ?? ''}
                            onChange={(e) =>
                              updateRow(r.id, { paymentMethod: e.target.value })
                            }
                          >
                            {enabledMethods.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="h-9 rounded border bg-background px-2 text-sm"
                            value={r.currencyCode ?? ''}
                            onChange={(e) =>
                              updateRow(r.id, { currencyCode: e.target.value })
                            }
                          >
                            {enabledCurrencies.map((c) => (
                              <option key={c.code} value={c.code}>
                                {c.code}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <MoneyInput
                            value={r.amount || null}
                            onChange={(v) => updateRow(r.id, { amount: v ?? 0 })}
                            decimalPlaces={getCurrencyDecimalPlaces(r.currencyCode ?? primary)}
                            className="ml-auto h-8 w-28 text-right"
                          />
                        </td>
                        <td>
                          <MoneyInput
                            value={r.exchangeRateSnapshot ? Number(r.exchangeRateSnapshot) : null}
                            onChange={(v) =>
                              updateRow(r.id, {
                                exchangeRateSnapshot: v === null ? null : String(v),
                              })
                            }
                            decimalPlaces={primaryDecimalPlaces}
                            placeholder={r.currencyCode === primary ? '1' : ''}
                            disabled={r.currencyCode === primary}
                            className="ml-auto h-8 w-24 text-right text-xs"
                          />
                        </td>
                        <td className="text-right font-mono">
                          {formatAmount(computeAmountInPrimary(r), primary)}
                        </td>
                        <td>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeRow(r.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile — cards stackeados */}
              <div className="space-y-3 md:hidden">
                {rows.map((r) => (
                  <div key={r.id} className="space-y-2 rounded-md border bg-card p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-1 text-xs">
                        <span className="block text-muted-foreground">Tipo</span>
                        <select
                          className="h-9 w-full rounded border bg-background px-2 text-sm"
                          value={r.kind}
                          onChange={(e) =>
                            updateRow(r.id, { kind: e.target.value as Row['kind'] })
                          }
                        >
                          <option value="payment">Pago</option>
                          <option value="change">Vuelto</option>
                        </select>
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="block text-muted-foreground">Método</span>
                        <select
                          className="h-9 w-full rounded border bg-background px-2 text-sm"
                          value={r.paymentMethod ?? ''}
                          onChange={(e) => updateRow(r.id, { paymentMethod: e.target.value })}
                        >
                          {enabledMethods.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="block text-muted-foreground">Moneda</span>
                        <select
                          className="h-9 w-full rounded border bg-background px-2 text-sm"
                          value={r.currencyCode ?? ''}
                          onChange={(e) => updateRow(r.id, { currencyCode: e.target.value })}
                        >
                          {enabledCurrencies.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.code}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1 text-xs">
                        <span className="block text-muted-foreground">Monto</span>
                        <MoneyInput
                          value={r.amount || null}
                          onChange={(v) => updateRow(r.id, { amount: v ?? 0 })}
                          decimalPlaces={getCurrencyDecimalPlaces(r.currencyCode ?? primary)}
                          className="h-9 w-full text-right"
                        />
                      </label>
                      {r.currencyCode !== primary && (
                        <label className="space-y-1 text-xs">
                          <span className="block text-muted-foreground">Cotización</span>
                          <MoneyInput
                            value={r.exchangeRateSnapshot ? Number(r.exchangeRateSnapshot) : null}
                            onChange={(v) =>
                              updateRow(r.id, {
                                exchangeRateSnapshot: v === null ? null : String(v),
                              })
                            }
                            decimalPlaces={primaryDecimalPlaces}
                            placeholder=""
                            className="h-9 w-full text-right"
                          />
                        </label>
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t pt-2 text-sm">
                      <span className="text-xs text-muted-foreground">
                        En {primary}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">
                          {formatAmount(computeAmountInPrimary(r), primary)}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-destructive"
                          onClick={() => removeRow(r.id)}
                          aria-label="Quitar fila"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={addRow}>
                  <Plus className="mr-1 h-3 w-3" /> Agregar fila
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDiscountDialogOpen(true)}
                  disabled={!canApplyDiscount}
                  title={
                    canApplyDiscount
                      ? 'Aplicar descuento al total'
                      : 'Solo cuando hay saldo pendiente'
                  }
                >
                  <Minus className="mr-1 h-3 w-3" />
                  {discount ? 'Editar descuento' : 'Aplicar descuento'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSurchargeDialogOpen(true)}
                  disabled={!canApplySurcharge}
                  title={
                    canApplySurcharge
                      ? 'Aplicar aumento al total'
                      : 'Solo cuando hay exceso (cobrado > total)'
                  }
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {surcharge ? 'Editar aumento' : 'Aplicar aumento'}
                </Button>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={pending}>
                Cancelar
              </Button>
              <Button onClick={onConfirm} disabled={pending || saldoPendiente !== 0 || cart.lines.length === 0}>
                {pending ? 'Procesando…' : 'Confirmar y Cobrar'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>

      {discountDialogOpen && (
        <AdjustmentDialog
          kind="discount"
          baseTotal={totals.total}
          primary={primary}
          primaryDecimalPlaces={primaryDecimalPlaces}
          initialAmount={discount?.amountInPrimary ?? computeSuggestedDiscount()}
          initialPct={discount?.pctValue ?? (!hasAnyPayment ? 10 : null)}
          onClose={() => setDiscountDialogOpen(false)}
          onConfirm={(v) => {
            setDiscount(v);
            setDiscountDialogOpen(false);
          }}
        />
      )}
      {surchargeDialogOpen && (
        <AdjustmentDialog
          kind="surcharge"
          baseTotal={totals.total}
          primary={primary}
          primaryDecimalPlaces={primaryDecimalPlaces}
          initialAmount={surcharge?.amountInPrimary ?? computeSuggestedSurcharge()}
          initialPct={surcharge?.pctValue ?? null}
          onClose={() => setSurchargeDialogOpen(false)}
          onConfirm={(v) => {
            setSurcharge(v);
            setSurchargeDialogOpen(false);
          }}
        />
      )}
    </Dialog>
  );
}

// ── Sub-dialog para descuento / aumento ───────────────────────────────────────

function AdjustmentDialog({
  kind,
  baseTotal,
  primary,
  primaryDecimalPlaces,
  initialAmount,
  initialPct,
  onClose,
  onConfirm,
}: {
  kind: 'discount' | 'surcharge';
  baseTotal: number;
  primary: string;
  primaryDecimalPlaces: number;
  initialAmount: number;
  initialPct: number | null;
  onClose: () => void;
  onConfirm: (a: Adjustment) => void;
}) {
  const [mode, setMode] = useState<'fixed' | 'pct'>(initialPct !== null ? 'pct' : 'fixed');
  const [amount, setAmount] = useState<number | null>(initialAmount > 0 ? initialAmount : null);
  const [pct, setPct] = useState<number | null>(initialPct);

  const computedFromPct = pct !== null && pct > 0 ? Math.round(baseTotal * (pct / 100)) : 0;
  const finalAmount = mode === 'pct' ? computedFromPct : (amount ?? 0);

  const handleConfirm = () => {
    if (finalAmount <= 0) return;
    onConfirm({
      amountInPrimary: finalAmount,
      pctValue: mode === 'pct' ? pct : null,
    });
  };

  const title = kind === 'discount' ? 'Aplicar descuento' : 'Aplicar aumento';
  const verb = kind === 'discount' ? 'restará' : 'sumará';

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Se {verb} al total a cobrar para ajustar el saldo.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'fixed' | 'pct')} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
            <RadioGroupItem value="fixed" /> Valor fijo
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
            <RadioGroupItem value="pct" /> Porcentaje del total
          </label>
        </RadioGroup>

        {mode === 'fixed' ? (
          <div className="space-y-1.5">
            <Label htmlFor="adj-amount">Monto ({primary})</Label>
            <MoneyInput
              id="adj-amount"
              value={amount}
              onChange={setAmount}
              decimalPlaces={primaryDecimalPlaces}
              placeholder="0"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="adj-pct">Porcentaje del total</Label>
            <div className="flex items-center gap-2">
              <Input
                id="adj-pct"
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={pct ?? ''}
                onChange={(e) =>
                  setPct(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))
                }
                className="w-24"
              />
              <span className="text-sm">% → {formatAmount(computedFromPct, primary)}</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={finalAmount <= 0}>
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
