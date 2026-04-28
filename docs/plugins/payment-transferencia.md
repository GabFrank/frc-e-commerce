# payment-transferencia

## Scope

`PaymentMethodHandler` para transferencia bancaria manual.

## Flujo

1. Customer elige "Transferencia" en checkout.
2. Order pasa a estado `Authorized` con payment `pending`.
3. Storefront muestra datos de cuenta del vendedor (custom fields del Channel).
4. Vendedor verifica extracto → confirma desde admin → payment `Settled` → Order `PaymentSettled`.

## Custom fields en Channel

- `bankName: string`
- `bankAccountNumber: string`
- `bankAccountHolder: string`
- `bankAccountType: string`

## Estado

**MVP.**
