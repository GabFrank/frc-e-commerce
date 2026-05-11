# frc-e-commerce

SaaS de e-commerce multi-tienda para ropa, calzado y accesorios. Cada tienda recibe su propio subdominio (`<slug>.frc-ecommerce.com`), branding propio, gestión de productos, carrito + checkout, POS online y reportes básicos. Producto independiente del ERP `frc-comercial` y del facturador `frc-efact`.

## Stack

- **Framework**: Next.js 16 App Router (monolito: storefront + admin + super + API en `apps/web`)
- **DB**: PostgreSQL 16 + Drizzle ORM
- **Auth**: Better Auth
- **UI**: shadcn/ui + Tailwind CSS 4
- **Forms**: react-hook-form + Zod
- **Multi-tenant**: 1 DB compartida, columna `tenantId` en cada tabla, helper `requireTenantId()`
- **Storage**: Cloudflare R2 (S3-compatible)
- **Pagos MVP**: Stripe + transferencia/contraentrega/efectivo
- **Hosting**: Render (web + Postgres managed)

## Estructura

```
apps/
  web/                  # Next.js 16 monolito (storefront + admin + super + API)
packages/
  db/                   # schema Drizzle + cliente postgres
  shared-config/        # tsconfig/eslint/prettier base
  shared-utils/         # currency, slugify, types
docs/
  plugins/              # referencia conceptos dominio
.github/workflows/
.claude/
```

## Comandos

```bash
pnpm install            # instala workspace
pnpm dev                # arranca apps/web en :3000 (turbo)
pnpm build
pnpm lint
pnpm test
pnpm typecheck
pnpm db:generate        # generar migración después de cambiar schema
pnpm db:migrate         # aplicar
pnpm db:studio          # GUI Drizzle
pnpm changeset
```

Filtrado por app: `pnpm --filter @frc-e-commerce/web <script>`. Node 20 LTS (`.nvmrc`).

## Setup local

1. **Postgres** running en `localhost:5551` (o ajustar `DATABASE_URL` en `apps/web/.env.local`)
2. **Crear DB**: `psql -h localhost -p 5551 -U postgres -c "CREATE DATABASE frc_ecommerce_dev;"`
3. **`apps/web/.env.local`**: copiar de `.env.example` y completar valores
4. **Migrar**: `pnpm --filter @frc-e-commerce/web db:migrate`
5. **Seed superadmin + tenant demo**: `pnpm --filter @frc-e-commerce/web seed`
6. **Dev**: `pnpm dev` → `http://localhost:3000`

Login default seed: `super@frc-ecommerce.com` / `superadmin123`.

## Documentación

- [CLAUDE.md](CLAUDE.md) — guía agentes IA + convenciones del proyecto
- [Requerimiento inicial](docs/requerimiento-inicial.md)
- [Plan maestro de implementación](https://github.com/GabFrank/frc-e-commerce/blob/develop/.claude/plans/) (interno)
- [docs/plugins/](docs/plugins/) — referencia conceptual de cada feature

## Convenciones rápidas

- Naming: `frc-e-commerce` (doble guión) solo repo/paquetes/bucket. Dominios = `frc-ecommerce.com` (un guión)
- Branches: `master` / `release/beta` / `develop` / `feature/*` / `fix/*` / `hotfix/*`
- Merges entre branches long-lived: **merge commit, NO squash**
- Versionado: Changesets
- Conventional commits: `feat:` minor, `fix:` patch, `feat!:` major
- Idioma: dominio en español, código en inglés
- Multi-tenant: cada query DEBE filtrar por `tenantId`
- Next 16: usar `proxy.ts` (NO `middleware.ts`)
