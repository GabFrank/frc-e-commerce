# Arquitectura — frc-e-commerce

## Visión global

```
                            ┌───────────────────────┐
                            │  Cloudflare DNS + CDN │
                            │  *.frc-e-commerce.com │
                            └───────────┬───────────┘
                                        │
                ┌───────────────────────┼─────────────────────────┐
                │                       │                         │
        ┌───────▼────────┐    ┌─────────▼────────┐      ┌─────────▼────────┐
        │  Storefront    │    │  Vendure Admin   │      │  Vendure Shop    │
        │  Next.js PWA   │    │  UI (Angular)    │      │  & Admin API     │
        │  (Render)      │    │  servida por BE  │      │  GraphQL (Render)│
        └───────┬────────┘    └─────────┬────────┘      └─────────┬────────┘
                │                       │                         │
                └───────────────────────┴─────────────────────────┘
                                        │
                                        │ GraphQL
                                        ▼
                            ┌───────────────────────┐
                            │  Vendure Backend      │
                            │  NestJS + plugins     │
                            │  (Render Docker)      │
                            └───┬───────────────┬───┘
                                │               │
                  ┌─────────────▼───┐    ┌──────▼─────────┐
                  │  PostgreSQL 16  │    │ Cloudflare R2  │
                  │  (Render mgd)   │    │ (assets)       │
                  └─────────────────┘    └────────────────┘

                                        │ HTTP (fase futura)
                                        ▼
                            ┌───────────────────────┐
                            │  frc-efact API        │
                            │  (SIFEN bridge)       │
                            └───────────────────────┘
```

## Decisiones clave

### 1. Multi-tenant Channel-based, una sola DB

Vendure usa el concepto **Channel** para aislar tiendas dentro de la misma instancia y DB. Cada producto, order, customer, asset puede pertenecer a uno o más channels. La query en `RequestContext` filtra automáticamente por `channelToken` enviado en header `vendure-token`.

- 1 tienda = 1 Channel + 1 subdominio (`tienda1.frc-e-commerce.com`).
- Subdominio → middleware Next.js → resuelve `channelToken` → header GraphQL.
- Si un cliente futuro exige DB dedicada, se levanta otra instancia (no soportado en MVP).

### 2. Multi-currency con plugin custom

Vendure soporta multi-currency a nivel Channel (cada Channel = 1 moneda primaria). Para mostrar precios convertidos en el storefront sin tocar la persistencia:

- Plugin `currency-rate` mantiene tabla `currency_rate` con tasas (PYG↔USD, PYG↔BRL, etc.).
- Servicio `convert(amount, from, to)` se usa solo en presentación.
- Order se persiste siempre en moneda del Channel para evitar deriva por cambio de tasa.
- Selector UI en storefront persiste preferencia en cookie + localStorage.

### 3. Pagos sin custodia

El SaaS no recibe dinero ni cobra fee por transacción. Cada plugin de pago:

- **Stripe**: cuenta del vendedor, no Connect. Webhook actualiza order.
- **Bancard / UPay**: redirect a pasarela del vendedor.
- **Transferencia**: confirma manual desde admin.
- **Contra entrega**: marca order pendiente de cobro al delivery.
- **Directo al vendedor**: igual que transferencia, sin confirmación bancaria automática.

### 4. POS online dentro del Admin UI

Vendure Admin UI es una app Angular extensible. Plugin `pos-online` expone:

- Vista "POS" en sidebar admin.
- Input que lee del lector de códigos vía **WebHID** (USB HID modo teclado) o **Web Serial API** (RS-232).
- Crea draft Order vía Admin API → checkout → confirma.
- Impresora térmica (fase 2) vía WebUSB.

### 5. Storage en Cloudflare R2

- Bucket `frc-e-commerce-assets`.
- Vendure `AssetServerPlugin` con `S3AssetStorageStrategy` configurado con:
  - `endpoint: https://<account>.r2.cloudflarestorage.com`
  - `region: 'auto'`
  - `forcePathStyle: true`
  - credenciales R2 token (read+write).
- CDN: dominio público R2 (`assets.frc-e-commerce.com` con CNAME a R2 public bucket) + Cloudflare CDN nativo.

### 6. Hosting en Render

- **Postgres managed**: 1 instancia compartida entre `alpha`, `beta`, `production` con DBs separadas (`frc_ecommerce_alpha`, `frc_ecommerce_beta`, `frc_ecommerce_prod`). Reduce costo MVP.
- **Web services**: 6 (backend × 3 envs + storefront × 3 envs). Plan starter (US$7/mo c/u) elimina cold start.
- **Variables de entorno**: gestionadas vía MCP (`mcp__render__update_environment_variables`).

## Modelo de datos extendido

Vendure ya provee: `Channel`, `Product`, `ProductVariant`, `Order`, `Customer`, `Asset`, `PaymentMethod`, `ShippingMethod`, etc.

Plugins custom agregan:

- **`tenant-management`**: custom fields en `Channel` (`logoAssetId`, `slogan`, `primaryColor`, `secondaryColor`, `accentColor`, `subdomain`, `plan`).
- **`currency-rate`**: entidad nueva `CurrencyRate { id, fromCurrency, toCurrency, rate, effectiveAt, channelId? }`.
- **`compras`**: `PurchaseOrder`, `PurchaseOrderLine`, `Supplier`.
- **`caja`**: `CashSession`, `CashMovement`.
- **`finanzas`**: `Account`, `JournalEntry`, `JournalEntryLine`.
- **`cuentas-corrientes`**: `CurrentAccount`, `CurrentAccountMovement`.

Todos respetan `channelId` para aislamiento multi-tenant.

## Flujo de request típico (storefront)

```
1. Browser → tienda1.frc-e-commerce.com/products
2. Cloudflare → Render Next.js
3. Next.js middleware lee host → busca channelToken en cache → header `vendure-token: <token>`
4. Next.js SSR llama Shop API GraphQL del backend
5. Vendure resuelve query filtrando por channelId
6. Renderiza HTML con datos + manifest PWA
7. Browser cachea estáticos en service worker
```

## Diagrama de plugins

```
apps/backend/src/plugins/
├── tenant-management/      ← base, todos los demás dependen de Channel
├── currency-rate/          ← independiente
├── theme-manager/          ← lee tenant-management custom fields
├── pos-online/             ← extiende Admin UI, usa Order API
├── compras/                ← entidad propia
├── caja/                   ← depende de compras + finanzas
├── finanzas/               ← entidad propia
├── cuentas-corrientes/     ← depende de finanzas
├── payment-transferencia/  ← PaymentHandler
├── payment-contraentrega/  ← PaymentHandler
├── payment-bancard/        ← PaymentHandler
├── payment-upay/           ← PaymentHandler
└── sifen-bridge/           ← consume frc-efact API (fase 2)
```

## Decisiones rechazadas (y por qué)

| Opción | Por qué no |
|---|---|
| Saleor | Stack Python/Django, equipo es Java/TS; menos plugin extensibility |
| Medusa.js | Más liviano pero menos maduro en multi-tenant nativo |
| Shopify Hydrogen | Managed = sin all-in-one ERP propio |
| AWS S3 | Egress US$0.09/GB mata budget e-commerce |
| Hetzner desde día 1 | Más ops; Render acelera MVP |
| `semantic-release` | No optimizado para monorepo; Changesets gana |
| DB por tenant | Costo y ops; Channel resuelve MVP |
| `master` + `main` simultáneos | Una sola convención: `master` (consistente con frc-comercial) |
| Squash merges entre branches long-lived | Rompe cálculo de versión Changesets |
