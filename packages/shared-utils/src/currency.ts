import type { CurrencyCode, Money, CurrencyRateRecord } from './types';

/**
 * Locale único para display de moneda en toda la app.
 * Convención: "." como separador de miles, "," como decimales — coincide
 * con es-PY/es-AR. Lo forzamos también para USD/BRL para que el operador
 * vea siempre el mismo formato.
 */
const DISPLAY_LOCALE = 'es-PY';

const ZERO_DECIMAL_CURRENCIES: ReadonlySet<CurrencyCode> = new Set(['PYG']);

/** Cantidad de decimales que tiene esta moneda en display. */
export function getCurrencyDecimalPlaces(currency: CurrencyCode | string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency as CurrencyCode) ? 0 : 2;
}

/**
 * Formatea un monto numérico con símbolo de moneda y locale es-PY.
 * Ej. formatAmount(1234567, 'PYG') -> "Gs. 1.234.567"
 *     formatAmount(1234.56, 'USD') -> "US$ 1.234,56"
 */
export function formatAmount(amount: number, currency: CurrencyCode | string): string {
  const dp = getCurrencyDecimalPlaces(currency);
  try {
    return new Intl.NumberFormat(DISPLAY_LOCALE, {
      style: 'currency',
      currency,
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    }).format(amount);
  } catch {
    // currency code desconocido por Intl: fallback a número + código.
    return `${formatNumber(amount, dp)} ${currency}`;
  }
}

/**
 * Formatea sólo el número (sin símbolo) con miles "." y decimales ",".
 * Útil para inputs y tablas donde el símbolo está en otro lado.
 */
export function formatNumber(amount: number, decimalPlaces: number): string {
  if (!Number.isFinite(amount)) return '';
  return new Intl.NumberFormat(DISPLAY_LOCALE, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(amount);
}

/**
 * Formatea una cotización (rate) con cantidad arbitraria de decimales.
 * Ej. formatRate('7000.00000000', 2) -> "7.000,00"
 */
export function formatRate(value: number | string, decimalPlaces: number): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '';
  return formatNumber(n, decimalPlaces);
}

/** Mantengo la firma existente: formatMoney(money, locale?) — delega al nuevo formatAmount. */
export function formatMoney(money: Money, _locale?: string): string {
  return formatAmount(money.amount, money.currency);
}

export class CurrencyConverter {
  private rates: Map<string, number> = new Map();

  constructor(records: CurrencyRateRecord[] = []) {
    for (const r of records) {
      this.setRate(r.fromCurrency, r.toCurrency, r.rate);
    }
  }

  private key(from: CurrencyCode, to: CurrencyCode): string {
    return `${from}->${to}`;
  }

  setRate(from: CurrencyCode, to: CurrencyCode, rate: number): void {
    this.rates.set(this.key(from, to), rate);
    if (rate !== 0) {
      this.rates.set(this.key(to, from), 1 / rate);
    }
  }

  convert(money: Money, to: CurrencyCode): Money {
    if (money.currency === to) return money;
    const rate = this.rates.get(this.key(money.currency, to));
    if (rate === undefined) {
      throw new Error(`No exchange rate from ${money.currency} to ${to}`);
    }
    return { amount: money.amount * rate, currency: to };
  }
}
