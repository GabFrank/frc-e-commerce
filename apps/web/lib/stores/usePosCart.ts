'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DiscountValue = { kind: 'pct' | 'amount'; value: number };

export type PosCartLine = {
  /** Generado client-side, no FK a DB */
  id: string;
  variantId: string;
  productId: string;
  /** Snapshot al agregar — sobrevive cambios posteriores en el catálogo */
  productName: string;
  variantName: string;
  /** Atributos de variante para display ("Talle M / Color rojo") */
  attributesLabel: string;
  /** SKU de la variante */
  sku: string;
  /** URL de imagen para el carrito */
  imageUrl: string | null;
  /** Stock disponible al momento de agregar (para warning, no bloqueo) */
  availableStock: number;
  unitPrice: number;
  /** Costo unitario (visible solo a admin si pos_config.show_cost_to_admin) */
  unitCost: number | null;
  quantity: number;
  /** Descuento aplicado a esta línea */
  discount: DiscountValue | null;
  /** Brindis: si true, la línea tiene precio efectivo 0 */
  isComplimentary: boolean;
  /** UserId del admin que autorizó (override) si producto NO era brindis por default */
  complimentaryAuthorizedBy: string | null;
  complimentaryAuthorizedByName: string | null;
};

export type PosCustomerSnapshot = {
  customerId: string | null;
  name: string;
  document: string | null;
  phone: string | null;
};

export type PosCartState = {
  lines: PosCartLine[];
  customer: PosCustomerSnapshot;
  /** Override temporal de moneda primary para esta venta. null = usar la del tenant. */
  primaryCurrencyOverride: string | null;
  /** Descuento general (aplicado al subtotal). */
  generalDiscount: DiscountValue | null;
  /** Aumento general (típicamente para redondeo). Valor en moneda primary. */
  surcharge: { value: number; reason: string } | null;
  notes: string;
  // ── actions ──
  addLine: (line: Omit<PosCartLine, 'id'>) => void;
  updateLine: (id: string, patch: Partial<PosCartLine>) => void;
  removeLine: (id: string) => void;
  setQuantity: (id: string, qty: number) => void;
  setLineDiscount: (id: string, d: DiscountValue | null) => void;
  setLineComplimentary: (
    id: string,
    isComplimentary: boolean,
    authorizedBy: { userId: string; name: string } | null
  ) => void;
  setGeneralDiscount: (d: DiscountValue | null) => void;
  setSurcharge: (s: { value: number; reason: string } | null) => void;
  setCustomer: (c: PosCustomerSnapshot) => void;
  setPrimaryOverride: (code: string | null) => void;
  setNotes: (n: string) => void;
  reset: () => void;
};

const DEFAULT_CUSTOMER: PosCustomerSnapshot = {
  customerId: null,
  name: 'Consumidor Final',
  document: null,
  phone: null,
};

const initial = {
  lines: [] as PosCartLine[],
  customer: DEFAULT_CUSTOMER,
  primaryCurrencyOverride: null,
  generalDiscount: null,
  surcharge: null,
  notes: '',
};

const genId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const usePosCart = create<PosCartState>()(
  persist(
    (set) => ({
      ...initial,
      addLine: (line) =>
        set((state) => {
          // Si ya existe la misma variantId con mismo brindis flag y mismo descuento → suma qty
          const existing = state.lines.find(
            (l) =>
              l.variantId === line.variantId &&
              l.isComplimentary === line.isComplimentary &&
              JSON.stringify(l.discount) === JSON.stringify(line.discount)
          );
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.id === existing.id ? { ...l, quantity: l.quantity + line.quantity } : l
              ),
            };
          }
          return { lines: [...state.lines, { ...line, id: genId() }] };
        }),
      updateLine: (id, patch) =>
        set((state) => ({
          lines: state.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),
      removeLine: (id) =>
        set((state) => ({ lines: state.lines.filter((l) => l.id !== id) })),
      setQuantity: (id, qty) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.id === id ? { ...l, quantity: Math.max(1, Math.floor(qty)) } : l
          ),
        })),
      setLineDiscount: (id, d) =>
        set((state) => ({
          lines: state.lines.map((l) => (l.id === id ? { ...l, discount: d } : l)),
        })),
      setLineComplimentary: (id, isComplimentary, authorizedBy) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.id === id
              ? {
                  ...l,
                  isComplimentary,
                  complimentaryAuthorizedBy: authorizedBy?.userId ?? null,
                  complimentaryAuthorizedByName: authorizedBy?.name ?? null,
                }
              : l
          ),
        })),
      setGeneralDiscount: (d) => set({ generalDiscount: d }),
      setSurcharge: (s) => set({ surcharge: s }),
      setCustomer: (c) => set({ customer: c }),
      setPrimaryOverride: (code) => set({ primaryCurrencyOverride: code }),
      setNotes: (n) => set({ notes: n }),
      reset: () => set({ ...initial, customer: DEFAULT_CUSTOMER }),
    }),
    {
      name: 'pos-cart-v1',
      // Persist solo el state de carrito; las actions se reconstruyen al rehidratar.
      partialize: (state) => ({
        lines: state.lines,
        customer: state.customer,
        primaryCurrencyOverride: state.primaryCurrencyOverride,
        generalDiscount: state.generalDiscount,
        surcharge: state.surcharge,
        notes: state.notes,
      }),
    }
  )
);

// ── Selectores derivados ───────────────────────────────────────────────────────

export function calcLineTotal(line: PosCartLine): number {
  if (line.isComplimentary) return 0;
  const gross = line.unitPrice * line.quantity;
  if (!line.discount) return gross;
  if (line.discount.kind === 'pct') {
    return Math.max(0, Math.round(gross * (1 - line.discount.value / 100)));
  }
  return Math.max(0, gross - line.discount.value);
}

export function calcSubtotal(lines: PosCartLine[]): number {
  return lines.reduce((acc, l) => acc + calcLineTotal(l), 0);
}

export function calcGeneralDiscountAmount(
  subtotal: number,
  d: DiscountValue | null
): number {
  if (!d) return 0;
  if (d.kind === 'pct') return Math.round(subtotal * (d.value / 100));
  return Math.min(subtotal, d.value);
}

export function calcTotal(state: Pick<PosCartState, 'lines' | 'generalDiscount' | 'surcharge'>): {
  subtotal: number;
  generalDiscountAmount: number;
  surchargeAmount: number;
  total: number;
} {
  const subtotal = calcSubtotal(state.lines);
  const generalDiscountAmount = calcGeneralDiscountAmount(subtotal, state.generalDiscount);
  const surchargeAmount = state.surcharge?.value ?? 0;
  const total = Math.max(0, subtotal - generalDiscountAmount + surchargeAmount);
  return { subtotal, generalDiscountAmount, surchargeAmount, total };
}
