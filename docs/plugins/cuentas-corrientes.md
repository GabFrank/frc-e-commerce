# cuentas-corrientes

## Scope

Cuenta corriente de clientes (deuda) y proveedores (a pagar).

## Entidades

- `CurrentAccount { id, partyType: 'customer'|'supplier', partyId, balance, currency, channelId }`
- `CurrentAccountMovement { id, accountId, type: 'charge'|'payment', amount, orderId?|purchaseOrderId?, description, createdAt }`

## Flujo

- Order con método "cuenta corriente" → genera `charge` automático.
- Pago de cliente → `payment` que reduce balance.
- Reportes: deudores, antigüedad de saldos.

## GraphQL

Admin: `currentAccounts(filter)`, `currentAccountMovements(accountId)`, `addPayment(accountId, amount)`.

## Dependencias

- `finanzas` (cada movement genera asiento).

## Estado

**Post-MVP.**
