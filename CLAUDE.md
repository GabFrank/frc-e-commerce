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
- **Hosting**: Render (web service + Postgres managed)
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
5. Conventional commits obligatorios:
   - `feat(modulo): descripcion` → minor
   - `fix(modulo): descripcion` → patch
   - `feat!:` o footer `BREAKING CHANGE:` → major
   - `chore`, `refactor`, `docs`, `test`, `ci`, `perf` → sin release
6. Cada PR que cambia `apps/*` o `packages/*` debe incluir un changeset (`pnpm changeset`)
7. Nunca skipear hooks (`--no-verify`)
8. Nunca commitear secretos (`.env`, `*.pem`, `*.key`, tokens R2/Render/Stripe)

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
pnpm changeset        # crear changeset para release
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
- **Migraciones**: aditivas. Nunca `DROP`/`RENAME` columnas sin estrategia 2 versiones
- **PaymentHandler**: nuevo método de pago = archivo nuevo en `apps/web/lib/payments/<code>.ts` que implementa la interface
- **shadcn**: copy-paste components en `apps/web/components/ui/`. Modificables sin perder soporte

## Plugins/Módulos del sistema (referencia)

Los conceptos quedan en `docs/plugins/*.md` desde la era Vendure como **referencia de dominio** (no son plugins literales en este stack). Cada uno se implementa como features dentro de `apps/web`:

| Concepto | Estado | Ubicación |
|---|---|---|
| `tenant-management` | ✅ Fase 2 | `lib/actions/tenant.ts`, `app/(super)/super/tenants/` |
| `currency-rate` | ⏳ Fase 6 | `packages/db/schema/config.ts`, `lib/currency.ts` |
| `theme-manager` | ⏳ Fase 6 | `lib/themes/`, `app/(storefront)/layout.tsx` (CSS vars inline) |
| `pos-online` | ⏳ Fase 5 | `app/(admin)/admin/pos/`, WebHID via `navigator.hid` |
| `compras` | ⏳ Fase 5 | `app/(admin)/admin/compras/`, schemas inventory |
| `caja` | ⏳ Fase 5+ | TBD |
| `finanzas` | ⏳ post-MVP | TBD |
| `cuentas-corrientes` | ⏳ post-MVP | TBD |
| `payment-transferencia` | ✅ Fase 4 | `lib/payments/manual.ts` |
| `payment-contraentrega` | ✅ Fase 4 | `lib/payments/manual.ts` |
| `payment-bancard` | ⏳ post-MVP | `lib/payments/bancard.ts` |
| `payment-upay` | ⏳ post-MVP | `lib/payments/upay.ts` |
| `payment-stripe` | 🚧 Fase 4 | `lib/payments/stripe.ts` (stub hasta instalar SDK) |
| `sifen-bridge` | ⏳ post-MVP | Llamadas a `frc-efact` API externa |

## Despliegue

| App | Mecanismo | Trigger |
|---|---|---|
| `web` (alpha) | Render web service | Auto-deploy en push a `develop` |
| `web` (production) | Render web service | Manual confirm en push a `master` |
| Postgres | Render managed | Provisionado vía `render.yaml` |
| Assets | Cloudflare R2 | Upload directo desde `lib/r2.ts` |

Branch → environment:
- `develop` → alpha
- `release/beta` → beta
- `master` → production

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
