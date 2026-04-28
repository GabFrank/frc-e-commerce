# sifen-bridge

## Scope

**Stub.** Cuando se requiera factura electrónica SIFEN (Paraguay), este plugin consume la API REST de `frc-efact` (proyecto independiente).

## No reimplementa SIFEN

`frc-efact` ya tiene la lógica completa con `rshk-jsifenlib`. Este plugin solo:

1. Hook `OrderEvent.PaymentSettled` → POST a `${FRC_EFACT_API_URL}/api/invoices` con payload del Order.
2. Recibe `cdc` (código de control SIFEN) y URL del KuDE.
3. Guarda en custom field `Order.cdc` y `Order.kudeUrl`.

## Variables de entorno

- `FRC_EFACT_API_URL`
- `FRC_EFACT_API_KEY`

## Estado

**Stub vacío en MVP.** Activación cuando alguna tienda necesite facturación electrónica.
