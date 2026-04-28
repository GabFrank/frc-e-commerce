# payment-bancard

## Scope

Integración con **Bancard VPOS** (Paraguay). Redirect-based + webhook.

## Flujo

1. Customer elige Bancard.
2. Backend crea operación contra API Bancard (`/vpos/api/0.3/single_buy`).
3. Backend retorna `process_id`.
4. Storefront redirige a `https://vpos.infonet.com.py/checkout/<process_id>`.
5. Después del pago, Bancard hace webhook a `POST /webhooks/bancard`.
6. Backend valida token + actualiza Order a `PaymentSettled`.

## Custom fields en Channel

- `bancardPublicKey: string`
- `bancardPrivateKey: string` (encriptado)
- `bancardEnvironment: 'staging'|'production'`

## Estado

**MVP+** (post tienda 1, pre apertura SaaS terceros).

## Docs

- https://www.bancard.com.py/desarrolladores/
