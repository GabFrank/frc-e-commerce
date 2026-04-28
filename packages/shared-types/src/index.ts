export type CurrencyCode = 'PYG' | 'USD' | 'BRL' | 'EUR';

export interface Money {
  amount: number;
  currency: CurrencyCode;
}

export interface ChannelTheme {
  channelToken: string;
  logoUrl: string | null;
  name: string;
  slogan: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export interface CurrencyRateRecord {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
  effectiveAt: string;
}
