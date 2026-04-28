import type { CurrencyCode, CurrencyRateRecord, Money } from '@frc-e-commerce/shared-types';

export class CurrencyConverter {
  private readonly rates = new Map<string, number>();

  constructor(records: CurrencyRateRecord[]) {
    for (const r of records) {
      this.rates.set(this.key(r.fromCurrency, r.toCurrency), r.rate);
    }
  }

  convert(amount: number, from: CurrencyCode, to: CurrencyCode): number {
    if (from === to) return amount;
    const direct = this.rates.get(this.key(from, to));
    if (direct !== undefined) return amount * direct;
    const inverse = this.rates.get(this.key(to, from));
    if (inverse !== undefined && inverse !== 0) return amount / inverse;
    throw new Error(`No currency rate available for ${from} → ${to}`);
  }

  convertMoney(money: Money, to: CurrencyCode): Money {
    return { amount: this.convert(money.amount, money.currency, to), currency: to };
  }

  private key(from: CurrencyCode, to: CurrencyCode): string {
    return `${from}->${to}`;
  }
}

export function formatMoney(money: Money, locale = 'es-PY'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
    maximumFractionDigits: money.currency === 'PYG' ? 0 : 2,
  }).format(money.amount);
}
