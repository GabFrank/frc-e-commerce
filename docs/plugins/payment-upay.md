# payment-upay

## Scope

Integración con **UPay** (Paraguay). Pasarela alternativa a Bancard.

## Flujo

Similar a Bancard: redirect + webhook.

## Custom fields en Channel

- `upayMerchantId`
- `upaySecretKey` (encriptado)
- `upayEnvironment: 'staging'|'production'`

## Estado

**Post-MVP.** Implementar después de Bancard.
