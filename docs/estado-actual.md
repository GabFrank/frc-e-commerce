# Estado actual — frc-e-commerce

> Última actualización: 2026-04-28

## Resumen

Repo bootstrapeado, monorepo operativo, Vendure backend + Next.js storefront corren localmente, ambos validados con smoke test. Listo para deploy una vez que estén las cuentas Cloudflare R2 + Render.

## Done ✅

### Infra repo
- [x] Monorepo pnpm + Turborepo + Changesets
- [x] GitHub repo público con ruleset de protección en `master`/`release/beta`/`develop`
- [x] Workflows CI / Release / Deploy
- [x] PR template, .editorconfig, .prettierrc
- [x] CLAUDE.md, README.md, docs completas

### Backend (apps/backend) — Vendure 3.6.2
- [x] Postgres/SQLite fallback (env-driven)
- [x] AssetServerPlugin con S3 strategy R2-ready
- [x] Multi-currency PYG/USD/BRL/EUR
- [x] Default lang `es`
- [x] CORS configurable por env
- [x] Plugin `tenant-management`: 8 custom fields Channel + TenantService + resolvers
- [x] Plugin `currency-rate`: entidad + servicio convert + GraphQL admin/shop
- [x] Plugin `theme-manager`: query `activeChannelTheme` para storefront
- [x] Plugin `payment-transferencia`: PaymentMethodHandler funcional
- [x] Plugin `payment-contraentrega`: PaymentMethodHandler funcional
- [x] Stubs registrados: `pos-online`, `compras`, `caja`, `finanzas`, `cuentas-corrientes`, `payment-bancard`, `payment-upay`, `sifen-bridge`
- [x] Migration script CLI (generate/run/revert)
- [x] Dockerfile multi-stage para Render
- [x] docker-compose.yml para Postgres dev local

### Storefront (apps/storefront) — Next.js 16
- [x] App Router + Tailwind 4 + Turbopack
- [x] middleware.ts: subdomain extraction
- [x] lib/vendure-client.ts: GraphQL client SSR
- [x] lib/theme.ts: SSR fetch theme con fallback
- [x] lib/products.ts: search + getProductBySlug
- [x] components/site-header.tsx: header theme-aware
- [x] Páginas: `/`, `/products`, `/products/[slug]`, `/cart`, `/account`
- [x] next.config.ts: standalone output para Docker
- [x] Dockerfile multi-stage para Render

### Smoke tests pasados
- [x] Backend bootea con SQLite, sirve admin/shop API en :3000
- [x] Shop API responde `activeChannelTheme` con custom fields
- [x] Shop API responde `currencyRates` (vacío)
- [x] Shop API responde `tenantBySubdomain`
- [x] Storefront bootea en :3001, sirve home + /products con 200
- [x] Theme integration funciona (vars CSS aplicadas)

## En curso 🔄

- CI workflow validando primer PR (https://github.com/GabFrank/frc-e-commerce/pull/1).

## Pendiente bloqueado por usuario 🛑

1. **Mergear PR #1** (vía GitHub UI, merge commit, no squash).
2. **Crear cuenta Cloudflare** + bucket R2 + DNS para `frc-e-commerce.com`.
3. **Crear cuenta Render** + Blueprint deploy de `render.yaml`.
4. **Pasar credenciales** R2 y Render para configurar secrets GitHub Actions.

## Pendiente para próxima iteración 📋

### Plugins funcionales restantes
- [ ] `pos-online`: Admin UI extension Angular + WebHID lector
- [ ] `payment-bancard`: integración VPOS Paraguay
- [ ] `payment-stripe`: usar plugin oficial Vendure
- [ ] `payment-upay`: integración UPay
- [ ] `compras`: entidades + admin UI section
- [ ] `caja`: entidades + flujo apertura/cierre
- [ ] `finanzas`: plan de cuentas + asientos
- [ ] `cuentas-corrientes`: depende de finanzas

### Storefront
- [ ] Autenticación (login/register/logout) — Vendure Shop API mutations
- [ ] Carrito persistente — `addItemToOrder`, `adjustOrderLine`, `removeOrderLine`
- [ ] Checkout multi-step (address → shipping → payment → confirm)
- [ ] PWA: manifest + service worker (next-pwa o custom)
- [ ] Selector de moneda con persistencia
- [ ] Páginas: `/checkout`, `/orders/[id]`, `/profile`, `/legal/*`
- [ ] SEO: sitemap.xml, robots.txt, OG tags por producto

### CI/CD
- [ ] Generar primera migración Postgres y commitear
- [ ] Workflow `deploy.yml` validado contra Render real
- [ ] Sentry integration backend + storefront
- [ ] E2E tests Playwright

### Operación
- [ ] Onboarding tienda 1 (datos reales)
- [ ] Documentación admin para clientes (manual de uso del Vendure Admin UI)
- [ ] Monitoreo + alertas

## Stack final consolidado

| Capa | Tecnología | Versión |
|---|---|---|
| Runtime | Node.js | 20 LTS |
| Pkg manager | pnpm | 9.12.0 |
| Build orchestrator | Turborepo | 2.x |
| Versionado | Changesets | 2.x |
| Backend framework | Vendure | 3.6.2 |
| Backend libs | NestJS / TypeORM / GraphQL | 11 / 0.3 / 16 |
| DB dev | SQLite (better-sqlite3) | 12 |
| DB prod | PostgreSQL | 16 |
| Storefront framework | Next.js | 16.2.4 |
| Storefront UI | React / Tailwind | 19 / 4 |
| Storage | Cloudflare R2 | — |
| Hosting | Render | — |
| DNS / CDN | Cloudflare | — |
| CI/CD | GitHub Actions | — |
