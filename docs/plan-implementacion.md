# Plan de Implementación — `frc-e-commerce`

## Contexto

Se inicia un producto SaaS nuevo, **independiente** de `frc-comercial` y `frc-efact`, basado en **Vendure** (headless commerce, NestJS + GraphQL + Postgres) con **storefront Next.js (PWA)**. Producto **all-in-one**: además del e-commerce estándar, debe cubrir compras / caja / finanzas / cuentas corrientes / POS online vía plugins propios. Multi-tenant nativo Channel-based desde día 1, multi-currency día 1, pagos directos al vendedor (sin split / sin custodia). Equipo: dev solo (vos) + agentes IA. Hosting cloud, storage cloud para imágenes. SIFEN se integra en fase posterior consumiendo `frc-efact` como API externa.

El objetivo de este plan es dejar el repo bootstrapeado, con CI/CD operativo, plugins scaffold y la primera tienda corriendo en ambiente cloud, listo para iterar features de MVP.

---

## Decisiones de arquitectura (cerradas)

| Área | Decisión |
|---|---|
| Backend | Vendure 3.x (Node 20 LTS, NestJS, GraphQL) |
| DB | PostgreSQL 16, **una sola DB compartida**, multi-tenant por `Channel` |
| Storefront | Next.js 14 (App Router) + Tailwind + PWA (next-pwa) |
| Admin UI | Vendure Admin UI default (custom dashboards = plugins propios) |
| POS online | Vista admin custom dentro Vendure Admin UI extension, lector códigos vía WebHID/USB-Serial. Impresora térmica = fase 2 |
| Storage | **Cloudflare R2** (S3-compatible, egress gratis), `AssetServerPlugin` con `S3AssetStorageStrategy` apuntando a endpoint R2 |
| Hosting MVP | **Render** (web service Vendure + web service Next.js + Postgres managed). Migración futura a Hetzner cuando escale |
| Auth shoppers | Email/pass (Vendure default) |
| Multi-currency | Plugin propio `currency-rate` para tasas + selección moneda base por Channel |
| Pagos | Custom `PaymentHandler` informativo: marca pedido pagado al confirmar, sin custodia. Stripe / Bancard / UPay / Transferencia / Contra-entrega |
| Dominios | Subdominios `*.frc-e-commerce.com` (wildcard cert vía Cloudflare). Dominios custom = fase posterior (Caddy on-demand TLS) |
| Repo | **Monorepo** con pnpm workspaces + Turborepo |
| Versionado | **Changesets** (no `semantic-release`, mejor fit monorepo Node) |
| CI/CD | GitHub Actions, esquema branches `master` / `release/beta` / `develop`, merge commits, branch protection con `enforce_admins=true` |

---

## Estructura del monorepo

```
frc-e-commerce/
├── apps/
│   ├── backend/                    # Vendure server
│   │   ├── src/
│   │   │   ├── plugins/
│   │   │   │   ├── tenant-management/
│   │   │   │   ├── currency-rate/
│   │   │   │   ├── compras/
│   │   │   │   ├── caja/
│   │   │   │   ├── finanzas/
│   │   │   │   ├── cuentas-corrientes/
│   │   │   │   ├── pos-online/
│   │   │   │   ├── theme-manager/
│   │   │   │   ├── payment-bancard/
│   │   │   │   ├── payment-upay/
│   │   │   │   ├── payment-transferencia/
│   │   │   │   └── sifen-bridge/        # stub, integra frc-efact en fase 2
│   │   │   ├── vendure-config.ts
│   │   │   └── index.ts
│   │   ├── migrations/
│   │   ├── Dockerfile
│   │   └── package.json
│   └── storefront/                 # Next.js PWA
│       ├── src/app/
│       ├── src/lib/vendure-client.ts
│       ├── public/manifest.json
│       ├── next.config.mjs
│       └── package.json
├── packages/
│   ├── shared-types/               # types GraphQL generados (codegen)
│   ├── shared-config/              # eslint, tsconfig, prettier base
│   └── shared-utils/               # currency conversion, validators
├── docs/
│   ├── requerimiento-inicial.md    # ya existe
│   ├── arquitectura.md             # nuevo
│   ├── guia-desarrollo-cicd.md     # nuevo, estilo frc-comercial
│   ├── plugins/                    # un md por plugin con scope
│   └── runbooks/
├── .github/
│   └── workflows/
│       ├── ci.yml                  # lint + test + build por app afectada (turbo --filter)
│       ├── release.yml             # changesets → tag + GitHub Release
│       └── deploy.yml              # workflow_dispatch → Render deploy
├── .changeset/
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── .nvmrc                          # 20
├── .gitignore
├── README.md
└── CLAUDE.md                       # guía agentes IA (estilo frc-comercial)
```

---

## Plan por fases

### Fase 0 — Bootstrap repo (día 1)

1. `git init` en `/Users/gabfranck/workspace/frc-sistemas-informaticos/frc-e-commerce/`.
2. Crear repo GitHub `GabFrank/frc-e-commerce`, push inicial.
3. Configurar `pnpm-workspace.yaml`, `turbo.json`, `package.json` raíz, `.nvmrc` (Node 20), `.gitignore`.
4. Configurar `packages/shared-config` con tsconfig/eslint/prettier base reutilizable.
5. Branch protection en `master`, `release/beta`, `develop` (enforce_admins, require PR, require status checks).
6. Inicializar Changesets (`pnpm changeset init`) con config monorepo.

### Fase 1 — Backend Vendure scaffold

1. `apps/backend`: `npx @vendure/create` apuntando a esa carpeta, integrar al workspace.
2. Configurar `vendure-config.ts`:
   - DB Postgres (vars de entorno).
   - `AssetServerPlugin` con `S3AssetStorageStrategy` apuntando a Cloudflare R2 (`endpoint`, `region: 'auto'`, `forcePathStyle: true`).
   - `DefaultJobQueuePlugin`, `EmailPlugin`, `AdminUiPlugin`.
   - Multi-currency: habilitar `availableCurrencyCodes` con PYG (base), USD, BRL, EUR.
3. Crear plugin scaffolds vacíos en `src/plugins/*` (cada uno con `*.plugin.ts` mínimo + README de scope).
4. Dockerfile multi-stage + `.dockerignore`.
5. Migración Flyway-equivalent: TypeORM migrations, script `pnpm migration:generate` / `migration:run`.

### Fase 2 — Storefront Next.js scaffold

1. `apps/storefront`: clonar Vendure Next.js Storefront Starter oficial dentro del workspace.
2. Adaptar a App Router si starter usa Pages Router.
3. Integrar `next-pwa` con manifest + service worker.
4. Cliente Apollo / urql apuntando a `SHOP_API_URL` env.
5. Selector de Channel por subdominio (middleware Next.js que lee `host`, mapea a `channelToken`).
6. Selector de moneda con persistencia en localStorage + cookie SSR.
7. Tailwind base + theme tokens (variables CSS) consumibles por plugin `theme-manager`.

### Fase 3 — Plugins core MVP

Implementar en orden de dependencia:

1. **`tenant-management`** — Custom fields en Channel (slogan, logo, colores, plan), CRUD admin, provisión de subdominio.
2. **`currency-rate`** — Entidad `CurrencyRate` (from, to, rate, date), GraphQL queries/mutations, servicio `convert(amount, from, to)`, scheduler diario opcional.
3. **`theme-manager`** — Lee custom fields de Channel y expone GraphQL query `activeChannelTheme` que el storefront consume para inyectar CSS vars.
4. **`payment-transferencia`**, **`payment-contraentrega`** — `PaymentHandler` que marca order como `Authorized` esperando confirmación manual.
5. **`payment-stripe`** — Plugin oficial Vendure, configurar.
6. **`pos-online`** — Admin UI extension: vista de venta rápida, integración WebHID lector códigos, crea Order via Admin API.
7. **`compras`**, **`caja`**, **`finanzas`**, **`cuentas-corrientes`** — entidades + GraphQL + admin UI sections. (Estos son los más grandes, iterar post-MVP-tienda-1.)
8. **`payment-bancard`**, **`payment-upay`** — custom handlers con redirect/webhook.
9. **`sifen-bridge`** — stub que espera `FRC_EFACT_API_URL`. Implementación real cuando se requiera factura electrónica.

### Fase 4 — CI/CD

1. **`ci.yml`**: en PR a `develop` / `release/beta` / `master`, correr `turbo run lint test build --filter=...[origin/$BASE]` (solo apps afectadas).
2. **`release.yml`**: en push a `master`, Changesets crea PR de release. Al mergear, publica tags `backend@x.y.z`, `storefront@x.y.z` + GitHub Releases con changelog.
3. **`deploy.yml`** (`workflow_dispatch`): inputs `app` (backend|storefront) + `environment` (alpha|beta|production). Llama Render API (`mcp__render__*` o `curl` con token) para gatillar deploy de la versión taggeada.
4. Branches:
   - `feature/*` → PR a `develop` (canal **alpha**, deploy automático a Render env alpha).
   - `develop` → PR a `release/beta` (canal **beta**).
   - `release/beta` → PR a `master` con merge commit (canal **stable / production**).
   - `hotfix/*` → PR a `master`, post-merge PR obligatorio `master → develop`.
5. Conventional commits: `feat:` minor, `fix:` patch, `feat!:` major. Changesets respeta esto.

### Fase 5 — Infra cloud

1. **Cloudflare R2**: crear bucket `frc-e-commerce-assets`, generar API token con scope `Object Read & Write`, configurar CORS para storefront domain.
2. **Cloudflare DNS**: zona `frc-e-commerce.com`, registro wildcard `*.frc-e-commerce.com` → Render storefront. Cert wildcard automático.
3. **Render workspace**:
   - Postgres managed (plan starter, upgrade después).
   - Web service `backend-alpha` (Docker, env: `DATABASE_URL`, `R2_*`, `COOKIE_SECRET`, etc.).
   - Web service `backend-beta`, `backend-production` (mismo Docker, distintas env).
   - Web service `storefront-alpha/beta/production` (Next.js).
   - Variables de entorno administradas vía `mcp__render__update_environment_variables`.
4. Backups Postgres: snapshots diarios automáticos Render + dump semanal a R2 (cron job).
5. Observabilidad MVP: logs Render + Sentry (free tier) en backend y storefront.

### Fase 6 — Onboarding tienda 1

1. Seed script: crea Channel default, admin user, currencies, tax categories, shipping methods, payment methods.
2. Importar catálogo inicial (CSV → mutation `createProduct` masivo).
3. Subdominio `tienda1.frc-e-commerce.com` apuntado.
4. Smoke test E2E: navegar storefront → agregar producto → checkout → ver order en admin.
5. Documentar runbook onboarding nueva tienda en `docs/runbooks/onboarding-tienda.md`.

---

## Archivos críticos a crear

| Path | Propósito |
|---|---|
| `package.json` (raíz) | Scripts orquestadores Turborepo |
| `pnpm-workspace.yaml` | Workspaces |
| `turbo.json` | Pipeline cache builds/test/lint |
| `apps/backend/src/vendure-config.ts` | Config Vendure central |
| `apps/backend/src/plugins/*/` | Un dir por plugin |
| `apps/storefront/src/middleware.ts` | Resolver Channel por subdominio |
| `apps/storefront/src/lib/vendure-client.ts` | Cliente GraphQL |
| `.github/workflows/ci.yml` | CI |
| `.github/workflows/release.yml` | Changesets release |
| `.github/workflows/deploy.yml` | Deploy manual a Render |
| `.changeset/config.json` | Config Changesets |
| `docs/arquitectura.md` | Diagrama + decisiones |
| `docs/guia-desarrollo-cicd.md` | Manual dev day-to-day |
| `CLAUDE.md` | Guía para agentes IA en este repo |

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Plugins ERP (compras/caja/finanzas) son enormes — pueden volar el cronograma MVP | Sacar de MVP de "tienda 1 online". Implementarlos en fases post-lanzamiento, una a la vez. MVP real = Vendure default + tenant-management + currency-rate + theme-manager + payments + pos-online básico |
| Vendure Admin UI extensions tienen curva de aprendizaje (Angular dentro de Vendure) | Aceptar que las pantallas custom (compras/caja) inicialmente sean más feas. Refactor cuando funcionalidad esté validada |
| Multi-currency con tasas custom puede divergir del modelo Vendure (que asume Channel = 1 moneda) | Plugin `currency-rate` no toca Channel currency; expone conversión en presentación. Order siempre se persiste en moneda del Channel |
| Cloudflare R2 + AssetServerPlugin no es config oficial documentada | Probar temprano (Fase 1). Fallback: AWS S3 con bucket en us-east-1 |
| Render free/starter tier puede tener cold starts | Plan starter pago desde día 1 (US$7/mo) elimina cold start |
| Pagos "directos al vendedor" implica que la confirmación es manual o vía webhook del banco. Sin custodia = difícil reconciliar | Plugin `caja` debe tener flujo de "confirmar pago recibido" manual + import de extractos bancarios futuro |

---

## Verificación end-to-end

Al terminar Fase 6, los siguientes pasos deben pasar:

1. **Local**: `pnpm install && pnpm dev` levanta backend (`:3000`) + admin (`:3000/admin`) + storefront (`:3001`).
2. **CI**: PR a `develop` corre lint/test/build verde para ambas apps.
3. **Release**: merge a `master` genera tag `backend@0.1.0` + `storefront@0.1.0` + GitHub Release con changelog.
4. **Deploy alpha**: `gh workflow run deploy.yml -f app=backend -f environment=alpha` deploya a Render alpha.
5. **Smoke test producción**:
   - `https://tienda1.frc-e-commerce.com` carga storefront PWA.
   - Login admin en `https://admin.frc-e-commerce.com`.
   - Crear producto → aparece en storefront.
   - Cambiar moneda en storefront → precios se reconvierten usando `currency-rate`.
   - POS online: escanear código → producto se agrega a venta → checkout → order creada.
   - Asset (imagen producto) se sirve desde R2 con CDN.
6. **Backup**: confirmar snapshot diario Postgres en Render dashboard.
7. **Observabilidad**: error provocado en backend aparece en Sentry.

---

## Cronograma estimado (single-dev + agentes IA)

| Fase | Estimación |
|---|---|
| 0 — Bootstrap repo | 1 día |
| 1 — Backend Vendure scaffold | 2-3 días |
| 2 — Storefront Next.js scaffold | 2-3 días |
| 3 — Plugins MVP mínimo (tenant + currency + theme + payments básicos + pos-online básico) | 3-4 semanas |
| 4 — CI/CD | 2-3 días |
| 5 — Infra cloud | 2-3 días |
| 6 — Onboarding tienda 1 | 1 semana |
| **Total MVP tienda 1 online** | **~6-8 semanas** |
| Plugins ERP completos (compras/caja/finanzas/CC) | post-MVP, +2-3 meses |
| SIFEN bridge | cuando se requiera factura electrónica |
| Multi-tienda activación + dominios custom | cuando entre 2do cliente |

---

## Próximo paso al aprobar

Arrancar Fase 0:
1. `git init` + crear repo GitHub.
2. Estructura monorepo + tooling base (pnpm + Turborepo + Changesets).
3. `CLAUDE.md` raíz con convenciones del proyecto para que agentes IA naveguen consistente.
