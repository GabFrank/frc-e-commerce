# caja

## Scope

Apertura/cierre de caja diaria, registro de movimientos de efectivo, reconciliación con ventas.

## Entidades

- `CashSession { id, openedBy, openedAt, closedAt?, openingBalance, closingBalance?, channelId }`
- `CashMovement { id, sessionId, type: 'sale'|'expense'|'deposit'|'withdrawal'|'adjustment', amount, currency, orderId?, description, createdAt }`

## Flujo

1. Operador abre caja (saldo inicial).
2. Cada Order pagado en efectivo → `CashMovement` automático.
3. Gastos / depósitos / extracciones manuales.
4. Cierre → calcula esperado vs declarado → diferencia.

## GraphQL

Admin: `openCashSession`, `closeCashSession`, `addCashMovement`, `cashSessions`, `cashSession(id)`.

## Dependencias

- `finanzas` (movimientos generan asientos).
- Hook en Order completion (Vendure event listener).

## Estado

**Post-MVP.**
