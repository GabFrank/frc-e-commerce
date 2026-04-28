# payment-contraentrega

## Scope

`PaymentMethodHandler` para pago contra entrega (efectivo al recibir).

## Flujo

1. Customer elige "Contra entrega".
2. Order pasa a `Authorized` con payment `pending`.
3. Delivery cobra al entregar.
4. Operador marca como cobrado desde admin → payment `Settled`.

## Estado

**MVP.**
