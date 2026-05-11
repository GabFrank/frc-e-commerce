export type CurrencyCode = 'PYG' | 'USD' | 'BRL' | 'EUR' | 'ARS';

export interface Money {
  amount: number;
  currency: CurrencyCode;
}

export interface CurrencyRateRecord {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
  date: Date;
}
