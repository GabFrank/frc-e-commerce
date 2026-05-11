import type { CurrencyCode, Money, CurrencyRateRecord } from './types';

const CURRENCY_LOCALES: Record<CurrencyCode, string> = {
  PYG: 'es-PY',
  USD: 'en-US',
  BRL: 'pt-BR',
  EUR: 'es-ES',
  ARS: 'es-AR',
};

const ZERO_DECIMAL_CURRENCIES: ReadonlySet<CurrencyCode> = new Set(['PYG']);

export function formatMoney(money: Money, locale?: string): string {
  const fmt = new Intl.NumberFormat(locale ?? CURRENCY_LOCALES[money.currency], {
    style: 'currency',
    currency: money.currency,
    minimumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(money.currency) ? 0 : 2,
    maximumFractionDigits: ZERO_DECIMAL_CURRENCIES.has(money.currency) ? 0 : 2,
  });
  return fmt.format(money.amount);
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
