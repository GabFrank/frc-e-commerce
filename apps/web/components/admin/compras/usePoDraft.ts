'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PurchaseVariantOption } from '@/lib/actions/purchase-search';

export type PoDraftLine = {
  id: string;
  variant: PurchaseVariantOption;
  quantity: number;
  unitCost: number;
  /** Nuevo precio de venta (moneda primary) — opcional. null = no cambiar al recibir. */
  sellPrice: number | null;
};

export type PoDraftExtra = {
  id: string;
  description: string;
  amount: number;
  strategy: 'cost' | 'equal' | 'qty' | 'manual';
};

export type PoDraftState = {
  supplierId: string;
  currencyCode: string;
  notes: string;
  lines: PoDraftLine[];
  extras: PoDraftExtra[];
  savedAt: number;
};

const STORAGE_VERSION = 1;
const DEBOUNCE_MS = 500;

function isMeaningful(state: Omit<PoDraftState, 'savedAt'>): boolean {
  return (
    state.lines.length > 0 ||
    state.extras.length > 0 ||
    state.notes.trim().length > 0
  );
}

export function usePoDraft(scopeKey: string) {
  const storageKey = `frc.po-draft.v${STORAGE_VERSION}.${scopeKey}`;
  const [draftFound, setDraftFound] = useState<PoDraftState | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);

  // Una sola lectura al montar
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PoDraftState;
      if (parsed && isMeaningful(parsed)) {
        setDraftFound(parsed);
      }
    } catch {
      // ignore corrupted draft
    }
  }, [storageKey]);

  const save = useCallback(
    (state: Omit<PoDraftState, 'savedAt'>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      // No persistir estados sin nada útil — evita escribir basura
      if (!isMeaningful(state)) return;
      saveTimerRef.current = setTimeout(() => {
        const payload: PoDraftState = { ...state, savedAt: Date.now() };
        try {
          localStorage.setItem(storageKey, JSON.stringify(payload));
          setLastSavedAt(payload.savedAt);
        } catch {
          // quota / private mode — silenciar
        }
      }, DEBOUNCE_MS);
    },
    [storageKey]
  );

  const clear = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setLastSavedAt(null);
    setDraftFound(null);
  }, [storageKey]);

  const dismissBanner = useCallback(() => setDraftFound(null), []);

  // Cleanup timer al desmontar
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return { draftFound, lastSavedAt, save, clear, dismissBanner };
}

/** Formato corto "hace Xs" — refresca cada 10s mientras el componente vive. */
export function useRelativeTime(epochMs: number | null): string {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (epochMs == null) return;
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, [epochMs]);
  if (epochMs == null) return '';
  const diff = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
  if (diff < 10) return 'recién';
  if (diff < 60) return `hace ${diff}s`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  return `hace ${hours} h`;
}
