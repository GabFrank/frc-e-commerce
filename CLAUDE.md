# CLAUDE.md — frc-e-commerce

Guía para agentes IA (Claude Code, otros) que trabajen en este repo.

## Qué es esto

`frc-e-commerce` es un **producto SaaS independiente** de venta de ropa multi-tienda. No comparte código, build ni deploy con `frc-comercial` ni con `frc-efact`. Trátalo como un proyecto greenfield.

## Stack

- **Framework**: Next.js 16 App Router (monolito: storefront + admin + super + API en `apps/web`)
- **DB**: PostgreSQL 16 + Drizzle ORM
- **Auth**: Better Auth (email/pass + sessions DB)
- **UI**: shadcn/ui + Tailwind CSS 4
- **Forms**: react-hook-form + Zod
- **Data fetching**: Server Actions + TanStack Query (cuando hace falta cliente)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Email**: Resend + React Email
- **Pagos MVP**: Stripe + transferencia/contraentrega/efectivo manuales
- **Pagos post-MVP**: Bancard, UPay, Mercado Pago
- **Hosting prod**: DigitalOcean droplet (Fedora 39) + Postgres local en puerto 5551 — alpha/beta corren solo en local, no se deployan
- **DNS/CDN**: Cloudflare
- **Monitoreo**: Sentry + PostHog
- **Tests**: Vitest + Playwright
- **Repo**: Monorepo pnpm workspaces + Turborepo + Changesets

## Multi-tenant

- 1 DB compartida, columna `tenantId uuid` en cada tabla de dominio + index por `tenantId`
- Resolución del tenant: `proxy.ts` (Next 16) lee subdominio → header `x-frc-tenant-slug` → `getCurrentTenant()` resuelve registro
- En desarrollo: variable `DEV_TENANT_SLUG=demo` como fallback sin subdominio
- Helper obligatorio: `import { requireTenantId } from '@/lib/tenant'` en queries de admin/storefront
- Dominios custom = post-MVP (campo `tenant.customDomain`)

## Estructura

```
apps/
  web/                          # Next.js 16 monolito
    app/
      (storefront)/            # tienda pública (subdominio del tenant)
        productos/
        carrito/
        checkout/
        cuenta/
      (admin)/admin/           # /admin/* — requiere session + tenantMember
      (super)/super/           # /super/* — requiere isSuperAdmin
      (auth)/login, /register
      api/auth/[...all]/       # Better Auth handler
      api/health/
      api/webhooks/{stripe,...}/
    components/
      ui/                      # shadcn (button, input, card, etc.)
      storefront/, admin/, super/
    lib/
      auth/{index,client,guards}.ts
      tenant/index.ts          # withTenant, getCurrentTenant
      actions/                 # Server Actions por dominio
      validators/              # Zod schemas
      payments/                # PaymentHandler interface + handlers
      r2.ts                    # Cloudflare R2 client
      utils/cn.ts
    proxy.ts                   # Next 16 (NO middleware.ts)
    drizzle.config.ts
    drizzle/                   # migraciones
    scripts/seed.ts
packages/
  db/                          # schema Drizzle centralizado + cliente postgres
    src/schema/                # tenant, user, tenant-member, product, cart, order, ...
  shared-config/               # tsconfig/eslint/prettier base
  shared-utils/                # currency (formatMoney, CurrencyConverter), slugify, types
docs/
  plugins/                     # referencia conceptos dominio (de la era Vendure, ya no plugins)
.github/workflows/             # ci.yml, release.yml, deploy.yml
.claude/                       # config Claude Code (settings.json, plans/)
```

## Branches & merges

- **`master`** = stable / production. Protegido (`enforce_admins=true`)
- **`release/beta`** = beta long-lived. Protegido
- **`develop`** = integración / canal alpha. Protegido
- **`feature/*`** / **`fix/*`** / **`refactor/*`** / **`chore/*`** → PR a `develop`
- **`hotfix/*`** → PR a `master`. Post-merge, PR obligatorio `master → develop`

**Reglas no negociables:**

1. Nunca push directo a `master`, `release/beta` o `develop`
2. Nunca `git push --force` a esas ramas (excepto reset completo coordinado, deshabilitando ruleset temporalmente)
3. Promoción `develop → release/beta → master`: **merge commit, NO squash**
4. PRs de feature → squash o merge según preferencia (no afecta versionado)
5. Conventional commits obligatorios — el versionado es **automático vía semantic-release** leyendo los commit messages:
   - `feat(modulo): descripcion` → minor
   - `fix(modulo): descripcion` → patch
   - `perf(modulo): descripcion` → patch
   - `refactor(modulo): descripcion` → patch
   - `feat!:` o footer `BREAKING CHANGE:` → major
   - `chore`, `docs`, `test`, `ci`, `build`, `style` → sin release
6. **No hay changesets manuales** (se removió `@changesets/cli` el 2026-05-11). Cada commit con prefijo válido genera la release automáticamente cuando llega a una branch publicable.
7. Canales de release según branch:
   - Push a `develop` → tag `vX.Y.Z-alpha.N` + GitHub Release prerelease
   - Push a `release/beta` → tag `vX.Y.Z-beta.N` + GitHub Release prerelease
   - Push a `master` → tag `vX.Y.Z` (estable) + GitHub Release
8. Nunca skipear hooks (`--no-verify`)
9. Nunca commitear secretos (`.env`, `*.pem`, `*.key`, tokens R2/Render/Stripe)

## Comandos

```bash
pnpm install          # instala todo el workspace
pnpm dev              # turbo run dev (arranca apps/web en :3000)
pnpm build            # turbo run build (afectados)
pnpm lint
pnpm test
pnpm typecheck
pnpm db:generate      # drizzle-kit generate (después de cambiar schema)
pnpm db:migrate       # aplica migraciones
pnpm db:studio        # GUI Drizzle
pnpm release:dry      # simular release (semantic-release dry-run local)
pnpm format
```

Filtrado: `pnpm --filter @frc-e-commerce/web <script>`. Node 20 LTS obligatorio (`.nvmrc` → `20`).

## Convenciones de código

### Naming
- **`frc-e-commerce`** (doble guión): solo repo, paquetes npm, bucket R2 (`frc-e-commerce-assets`), nombres de carpetas
- **`frc-ecommerce`** (un guión): dominios, emails, URLs públicas (`frc-ecommerce.com`, `assets.frc-ecommerce.com`, `noreply@frc-ecommerce.com`)

### Idioma
- **Dominio y UI**: español (`producto`, `pedido`, `carrito`, `caja`, columnas DB y enums)
- **Identificadores de código**: inglés (`product`, `order`, `cart`)
- No traducir términos de dominio al refactorizar

### Patrones
- **Server Actions** primero, REST/Route Handler solo para webhooks externos (Stripe, Bancard) que necesitan raw body
- **Drizzle**: imports SIN extension `.js` (proyecto usa `moduleResolution: bundler`)
- **Multi-tenant**: cada query DEBE filtrar por `tenantId`. Test mental: ¿un tenant A puede ver datos de tenant B?
- **Migraciones**: aditivas. Nunca `DROP`/`RENAME` columnas sin estrategia 2 versiones. El proyecto usa **`pnpm db:push`** (no `db:migrate`/`db:generate`) — el folder `apps/web/drizzle/` quedó obsoleto del bootstrap inicial. Tras cambiar un schema en `packages/db/src/schema/`, correr `pnpm --filter @frc-e-commerce/web db:push` para aplicar
- **PaymentHandler**: nuevo método de pago = archivo nuevo en `apps/web/lib/payments/<code>.ts` que implementa la interface
- **shadcn**: copy-paste components en `apps/web/components/ui/`. Modificables sin perder soporte
- **Timestamps**: el schema actual usa `timestamp without time zone`. Por consistencia y para evitar drift de TZ entre `defaultNow()` (server time) y JS `new Date()` (UTC ISO), usar **`sql\`now()\``** desde Drizzle en lugar de `new Date()` al setear timestamps. Issue conocido: ver Deuda técnica en TODO.md — eventualmente migrar a `timestamptz`
- **Errores Postgres en catch**: `DrizzleQueryError` envuelve los errores; el `code` real está en `err.cause` (a veces anidado). Para detectar unique violations (`23505`), unwrappear via util como `isUniqueViolation` en `lib/actions/product.ts`
- **Variantes**: cada producto auto-crea una variante "Default" (color=null, size=null) al crearse — garantiza que stock siempre vive en una variante. Los buscadores (PO, POS, storefront) deben filtrarla cuando el producto tiene siblings con atributos. Ver `filterOutDummyDefaults` en `purchase-search.ts`
- **SKU de variantes**: el prefix se deriva de `slug.toUpperCase().slice(0, 20)` (no 12). Cambiarlo rompería SKUs existentes; si hay que ajustar, hacerlo controlado
- **Drafts de PO**: tienen 2 capas — (1) localStorage debounced 500ms (`usePoDraft` hook, scope tenant+user) y (2) `purchase_order.status='draft'` en DB. Para crear "definitivo" desde un draft, pasar `promoteFromDraftId` a `createPurchaseOrder` — reemplaza líneas/extras manteniendo `poNumber`

## Plugins/Módulos del sistema (referencia)

Los conceptos quedan en `docs/plugins/*.md` desde la era Vendure como **referencia de dominio** (no son plugins literales en este stack). Cada uno se implementa como features dentro de `apps/web`.

**Refocus del MVP (2026-05-01):** el MVP ahora es **back-office operativo** (catálogo + POS multi-moneda + caja + compras + reportes). El storefront público + Stripe + emails de orden se difieren a **Fase 2**. Roadmap M1–M7 detallado en [`/Users/gabfranck/.claude/plans/1-no-hace-falta-enumerated-valiant.md`](../../.claude/plans/1-no-hace-falta-enumerated-valiant.md).

| Concepto | Estado | Ubicación |
|---|---|---|
| `tenant-management` | ✅ | `lib/actions/tenant.ts`, `app/(super)/super/tenants/` |
| `currency-rate` | ✅ M1 | `packages/db/schema/currency.ts`, `lib/actions/currency.ts`, `app/(admin)/admin/configuracion/monedas/` |
| `permissions/RBAC` | ✅ M1 | `lib/auth/permissions.ts` (capability matrix + `hasCapability` + `requireSessionCapability`) |
| `customer` | ✅ M2 | `packages/db/schema/customer.ts`, `lib/actions/customer.ts` |
| `pos-online` | ✅ M3-M4 | `app/pos/`, `components/pos/PosShell.tsx`, header inline + ?close=1 deep-link |
| `caja` | ✅ M4-M5 | `packages/db/schema/cash.ts`, conteo físico por denominación, cierre row-based |
| `pos-config` | ✅ M4 | `packages/db/schema/pos-config.ts`, `app/(admin)/admin/configuracion/pos/`, `primaryPaymentMethod` |
| `compras` | ✅ M6 | `app/(admin)/admin/compras/{,/nueva}`, `lib/actions/{purchase-order,purchase-search}.ts`. Página dedicada con drafts (DB + localStorage), variant picker agrupado, sell-price al recibir, margen colored. |
| `financiero-cajas` | ✅ | `app/(admin)/admin/financiero/cajas/[id]/`, detalle por sesión con métricas + filtros + ventas paginadas |
| `cancelaciones-devoluciones` | ✅ M7 | extensiones order/order_line + stock_movement con `original_movement_id` (commit `2c8b03b`) |
| `variantes-shopify` | ✅ | `product.gender` enum + `productVariant.{color,size,sizeKind}` columnas dedicadas + matriz N×M + archive por variante |
| `reportes-basicos` | ✅ M7 | `app/(admin)/admin/reportes/`, Recharts, 5 tabs (Ventas/Productos/Inventario/Caja/Compras) |
| `catalogo-masivo` | 🔴 M7 | TODO: import CSV, bulk actions, CRUD categorías UI, branding tenant |
| `email-minimo` (Resend) | 🔴 M7 | TODO: invitaciones equipo + reset password |
| `audit-log` | 🔴 M7 | TODO: tabla audit_log + middleware en actions sensibles |
| `payment-transferencia` | ✅ | `lib/payments/manual.ts` (canal web) |
| `payment-contraentrega` | ✅ | `lib/payments/manual.ts` (canal web) |
| `storefront-publico` | 🟡 Fase 2 | `app/(storefront)/*`, `/cuenta/pedidos/[id]` |
| `payment-stripe` | 🟡 Fase 2 | `lib/payments/stripe.ts` (stub hasta instalar SDK) |
| `email-orden-cliente` | 🟡 Fase 2 | templates Resend post-checkout online |
| `theme-manager` | ⏳ Fase 6 | `lib/themes/`, `app/(storefront)/layout.tsx` (CSS vars inline) |
| `multi-bodega` | ⏳ post-MVP | `warehouse` + stock por bodega + transferencias |
| `cuentas-corrientes` | ⏳ post-MVP | fiado a clientes |
| `payment-bancard` | ⏳ post-MVP | `lib/payments/bancard.ts` |
| `payment-upay` | ⏳ post-MVP | `lib/payments/upay.ts` |
| `sifen-bridge` | ⏳ post-MVP | Llamadas a `frc-efact` API externa |

## Despliegue

| App | Mecanismo | Trigger |
|---|---|---|
| `web` (production) | Droplet DigitalOcean Fedora 39 (`159.203.86.103`), systemd + nginx | **Manual** desde GitHub Actions → "Deploy to production" → Run workflow |
| Postgres | Local en el droplet, puerto 5551, DB `frc_ecommerce` | Bootstrap one-time |
| Assets | Cloudflare R2 (`assets.frc-ecommerce.com`) | Upload directo desde `lib/r2.ts` |
| TLS | Let's Encrypt wildcard (`*.frc-ecommerce.com`) vía Cloudflare DNS-01 | Auto-renueva con `certbot.timer` |

Branch → environment:
- `develop` → alpha (solo local, NO se deploya)
- `release/beta` → beta (solo local, NO se deploya)
- `master` → production (deploy manual al droplet)

Detalle completo del proceso, troubleshooting y bootstrap from-scratch en [`docs/deploy.md`](docs/deploy.md). Variables de entorno críticas en `/opt/frc-e-commerce/shared/.env` (template en `deploy/env.example`).

**Multi-tenancy en prod**: wildcard DNS + cert + cookies cross-subdomain (`AUTH_COOKIE_DOMAIN=.frc-ecommerce.com`). Cada tenant accede vía `<slug>.frc-ecommerce.com`. El `proxy.ts` resuelve el tenant del subdomain del host. `enterTenantAsMember` y `switchToTenant` hacen redirect cross-subdomain absoluto cuando `NEXT_PUBLIC_ROOT_DOMAIN` está seteado.

## Cosas que NUNCA hacer en este repo

1. Push directo a `master` / `release/beta` / `develop`
2. `git push --force` a ramas long-lived (sin coordinar reset)
3. Squash merge entre branches long-lived
4. Modificar migraciones Drizzle ya aplicadas
5. `DROP` / `RENAME` columnas sin estrategia 2-versiones
6. Commitear secretos
7. Acoplar este producto a `frc-comercial` o `frc-efact`
8. Bypass del helper `requireTenantId()` en queries (data leak entre tenants)
9. Usar `middleware.ts` (Next 16 deprecó la convención — usar `proxy.ts`)
10. Asumir convenciones de Next 14/15 — Next 16 tiene breaking changes (ver `apps/web/AGENTS.md`)

## Plan vivo

- `/Users/gabfranck/.claude/plans/puedes-borrar-la-branch-curious-cook.md` (plan maestro Fase 0-8).
- [`TODO.md`](TODO.md) — pendientes técnicos persistentes. **Leer al inicio de cada sesión** antes de avanzar con features nuevas, para no duplicar trabajo y respetar prioridades pactadas.
