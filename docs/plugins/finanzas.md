# finanzas

## Scope

Plan de cuentas, asientos contables, cierres mensuales. Sistema de partida doble simplificado.

## Entidades

- `Account { id, code, name, type: 'asset'|'liability'|'equity'|'income'|'expense', parentId?, channelId }`
- `JournalEntry { id, date, description, channelId }`
- `JournalEntryLine { id, journalEntryId, accountId, debit, credit, currency }`

## Reglas

- Sum(debit) = Sum(credit) por entry.
- Asientos los generan otros plugins (compras, caja, payment-*).

## GraphQL

Admin: `createJournalEntry` (manual), `journalEntries(filter)`, `accounts`, `accountBalance(id, dateRange)`, `trialBalance(date)`.

## Estado

**Post-MVP.**
