'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';

/**
 * Parsea un string en formato locale es-PY ("1.234,56") a número.
 * `""` → null; valores no numéricos → null.
 */
export function parseLocalAmount(input: string, decimalPlaces: number): number | null {
  if (!input || input.trim() === '') return null;
  // Reglas: aceptar dígitos, "." (miles) y "," (decimal único)
  // Quitar miles ".", reemplazar "," por "." para Number()
  const cleaned = input.replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  if (decimalPlaces === 0) return Math.trunc(n);
  // Redondeo a la cantidad de decimales target
  const factor = 10 ** decimalPlaces;
  return Math.round(n * factor) / factor;
}

/**
 * Formatea un número como string locale es-PY con miles "." y decimales ",".
 * Sin símbolo de moneda. `null`/inválido → "".
 */
export function formatLocalAmount(value: number | null, decimalPlaces: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return new Intl.NumberFormat('es-PY', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(value);
}

/**
 * Sanea lo que el usuario está tipeando: deja sólo dígitos y como máximo una ","
 * (si decimalPlaces > 0). Aplica máscara de miles "." en la parte entera.
 * No completa decimales con ceros — eso se hace on-blur.
 */
function maskWhileTyping(raw: string, decimalPlaces: number): string {
  // Strip cualquier cosa que no sea dígito o "," (los "." actuales se descartan
  // y se re-insertan como separadores de miles).
  const stripped = raw.replace(/[^\d,]/g, '');
  if (decimalPlaces === 0) {
    // Sin decimales: solo dígitos. Miles "." cada 3.
    const digits = stripped.replace(/,/g, '');
    if (!digits) return '';
    return groupThousands(digits);
  }
  // Con decimales: primera "," divide; todo lo siguiente es decimal (truncado)
  const firstCommaIdx = stripped.indexOf(',');
  let intPart: string;
  let decPart: string;
  if (firstCommaIdx === -1) {
    intPart = stripped.replace(/,/g, '');
    decPart = '';
  } else {
    intPart = stripped.slice(0, firstCommaIdx);
    decPart = stripped.slice(firstCommaIdx + 1).replace(/,/g, '').slice(0, decimalPlaces);
  }
  const intGrouped = intPart ? groupThousands(intPart) : '';
  if (firstCommaIdx === -1) return intGrouped;
  // Mantener la "," mientras el usuario está armando los decimales
  return `${intGrouped || '0'},${decPart}`;
}

function groupThousands(digits: string): string {
  // Quitar leading zeros excepto si es solo "0"
  const normalized = digits.replace(/^0+(?=\d)/, '');
  if (!normalized) return '0';
  // Insertar punto cada 3 desde la derecha
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export type MoneyInputProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  decimalPlaces?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Para soportar la navegación Tab/Enter de CreatePoForm. */
  'data-po-input'?: string;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
};

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  function MoneyInput(
    {
      value,
      onChange,
      decimalPlaces = 0,
      placeholder,
      disabled,
      className,
      id,
      onBlur,
      onFocus,
      onKeyDown,
      ...rest
    },
    ref
  ) {
    // Display = lo que ve el usuario. Se sincroniza con `value` cuando cambia
    // desde afuera, pero mientras el input está enfocado dejamos que el usuario
    // controle el string (para no romper la coma que recién escribió).
    const [display, setDisplay] = React.useState<string>(() =>
      formatLocalAmount(value, decimalPlaces)
    );
    const focusedRef = React.useRef(false);

    React.useEffect(() => {
      if (focusedRef.current) return;
      setDisplay(formatLocalAmount(value, decimalPlaces));
    }, [value, decimalPlaces]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const masked = maskWhileTyping(e.target.value, decimalPlaces);
      setDisplay(masked);
      const parsed = parseLocalAmount(masked, decimalPlaces);
      onChange(parsed);
    };

    const handleFocus: React.FocusEventHandler<HTMLInputElement> = (e) => {
      focusedRef.current = true;
      onFocus?.(e);
    };

    const handleBlur: React.FocusEventHandler<HTMLInputElement> = (e) => {
      focusedRef.current = false;
      // Re-formatear para mostrar decimales completos cosméticamente.
      const parsed = parseLocalAmount(display, decimalPlaces);
      setDisplay(formatLocalAmount(parsed, decimalPlaces));
      onBlur?.(e);
    };

    return (
      <Input
        ref={ref}
        id={id}
        type="text"
        inputMode={decimalPlaces > 0 ? 'decimal' : 'numeric'}
        value={display}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        autoComplete="off"
        {...rest}
      />
    );
  }
);
