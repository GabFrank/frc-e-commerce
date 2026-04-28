# currency-rate

## Scope

Tasas de cambio entre monedas para mostrar precios convertidos en storefront. **No persiste** Order en moneda alternativa — el Order siempre se guarda en moneda base del Channel.

## Entidad

```ts
CurrencyRate {
  id: ID;
  fromCurrency: 'PYG' | 'USD' | 'BRL' | 'EUR';
  toCurrency: 'PYG' | 'USD' | 'BRL' | 'EUR';
  rate: number;          // multiplicar amount * rate = converted
  effectiveAt: DateTime;
  channelId: ID | null;  // null = global, lo usan todas las tiendas
}
```

## GraphQL

- Admin: `createCurrencyRate`, `updateCurrencyRate`, `currencyRates(filter)`
- Shop: `currencyRates` (filtrado por channel + fecha más reciente)

## Servicio

`CurrencyConversionService.convert(amount, from, to, channelId)` — usa rate más reciente disponible. Si falta directo, intenta inverso. Si tampoco, throw.

## Scheduler (opcional)

`@Cron('0 6 * * *')` — fetcher diario a fuente externa (futuro: API BCP, fixer.io, etc.). En MVP las tasas se cargan a mano desde admin.

## Dependencias

Ninguna.
