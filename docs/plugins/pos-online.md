# pos-online

## Scope

Punto de venta dentro del Admin UI de Vendure. MVP: web-only, lector de códigos USB modo HID, navegador moderno.

## Funcionalidad MVP

- Vista "POS" en sidebar admin.
- Input de búsqueda por código de barras / SKU (foco automático).
- Soporte **WebHID** y **Web Serial** para lectores.
- Cuando se escanea, busca `productVariant.sku` o custom code → agrega a draft Order.
- Selector cliente (existente o "Cliente genérico").
- Botón "Cobrar" → modal con métodos de pago (transferencia / efectivo / tarjeta) → completa Order.
- Print recibo: HTML imprimible (fase 1). Térmica vía WebUSB = fase 2.

## GraphQL

Reusa Admin API existente: `addItemToDraftOrder`, `transitionOrderToState`, `addManualPaymentToOrder`.

Mutaciones nuevas:
- `quickFindVariantByCode(code: String!): ProductVariant`

## Hardware soportado

- **MVP**: lectores USB modo teclado HID (cualquiera estándar).
- **Fase 2**: impresoras térmicas ESC/POS via WebUSB (Brother, Epson TM, Genérica 80mm).

## Dependencias

- Vendure Admin UI extension framework.
- `tenant-management` (POS opera en contexto de Channel activo).
