# tenant-management

## Scope

Gestión de tiendas (tenants) que operan en la plataforma. Cada tienda = 1 Vendure `Channel`.

## Custom fields en Channel

- `subdomain: string` — único, valida `^[a-z0-9-]{3,30}$`
- `slogan: string | null`
- `logoAssetId: ID | null`
- `primaryColor: string` — hex
- `secondaryColor: string` — hex
- `accentColor: string` — hex
- `plan: 'free' | 'starter' | 'pro' | 'enterprise'` — futuro billing
- `customDomain: string | null` — fase 2

## GraphQL

- Admin: `createTenant(input)`, `updateTenant(id, input)`, `tenants` (paginado), `tenant(id)`
- Shop: `activeTenant` (deriva del channelToken header)

## Resolución de subdominio

Storefront middleware lee `host`, extrae subdominio, hace cache 5min `subdomain → channelToken` consultando GraphQL `tenantBySubdomain`. Inyecta header `vendure-token: <token>` en cliente Apollo.

## Dependencias

Ninguna (es la base).
