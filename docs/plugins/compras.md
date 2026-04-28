# compras

## Scope

Compras a proveedores. Genera entrada de stock al recibir mercadería.

## Entidades

- `Supplier { id, name, taxId, contact, channelId }`
- `PurchaseOrder { id, supplierId, status: 'draft'|'sent'|'received'|'cancelled', total, currency, channelId, createdAt, receivedAt? }`
- `PurchaseOrderLine { id, purchaseOrderId, productVariantId, quantity, unitCost, taxRate }`

## Flujo

1. Crear PO (draft).
2. Enviar a proveedor (`sent`).
3. Recibir → ajusta `StockLevel` de cada variant + crea movimiento financiero (cuenta por pagar).

## GraphQL

Admin only: `createPurchaseOrder`, `updatePurchaseOrder`, `receivePurchaseOrder`, `purchaseOrders`.

## Dependencias

- Vendure stock management.
- `finanzas` (genera asiento al recibir) — opcional para MVP.

## Estado

**Post-MVP.** Plugin grande, no entra en lanzamiento de tienda 1.
