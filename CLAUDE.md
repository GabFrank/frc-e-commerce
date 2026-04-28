# CLAUDE.md — frc-e-commerce

Guía para agentes IA (Claude Code, otros) que trabajen en este repo.

## Qué es esto

`frc-e-commerce` es un **producto SaaS independiente** — no comparte código, build ni deploy con `frc-comercial` ni con `frc-efact`. Las convenciones, patrones y stack de esos otros productos **no aplican aquí**. Trátalo como un proyecto greenfield.

## Stack

- **Backend**: Vendure 3.x (Node 20 LTS, NestJS, GraphQL, TypeORM, PostgreSQL 16)
- **Storefront**: Next.js 14 App Router, Tailwind CSS, PWA (next-pwa), Apollo/urql cliente
- **Multi-tenant**: Vendure `Channel` (1 sola DB compartida, fila aislada por `channelId`)
- **Storage**: Cloudflare R2 vía `AssetServerPlugin` con `S3AssetStorageStrategy`
- **Hosting**: Render (web service backend + storefront + Postgres managed)
- **DNS/CDN**: Cloudflare
- **Repo**: Monorepo pnpm workspaces + Turborepo
- **Versionado**: Changesets (NO `semantic-release`)
- **CI/CD**: GitHub Actions

## Estructura

```
apps/
  backend/                # Vendure server + plugins propios
    src/plugins/<name>/   # un dir por plugin
  storefront/             # Next.js PWA
packages/
  shared-config/          # tsconfig/eslint base
  shared-types/           # tipos GraphQL/dominio
  shared-utils/           # helpers (currency, validators)
docs/
  arquitectura.md
  guia-desarrollo-cicd.md
  plan-implementacion.md
  plugins/                # un md por plugin con scope
  runbooks/
.github/workflows/        # ci.yml, release.yml, deploy.yml
.changeset/
```

## Branches & merges

- **`master`** = stable / production. Protegido, `enforce_admins=true`.
- **`release/beta`** = beta long-lived. Protegido.
- **`develop`** = integración / canal alpha. Protegido.
- **`feature/*`** / **`fix/*`** / **`refactor/*`** / **`chore/*`** → PR a `develop`.
- **`hotfix/*`** → PR a `master`. Post-merge, PR obligatorio `master → develop`.

**Reglas no negociables:**

1. Nunca push directo a `master`, `release/beta` o `develop`.
2. Nunca `git push --force` a esas ramas.
3. Promoción `develop → release/beta → master`: **merge commit, NO squash**. Squash colapsa los commits y rompe el cálculo de versión.
4. PRs de feature → squash o merge según preferencia del autor (no afecta versionado).
5. Conventional commits obligatorios:
   - `feat(modulo): descripcion` → minor
   - `fix(modulo): descripcion` → patch
   - `feat!:` o footer `BREAKING CHANGE:` → major
   - `chore`, `refactor`, `docs`, `test`, `ci`, `perf` → sin release
6. Cada PR que cambia `apps/*` debe incluir un changeset (`pnpm changeset`).
7. Nunca skipear hooks (`--no-verify`).
8. Nunca commitear secretos (`.env`, `*.pem`, `*.key`, service accounts, tokens R2/Render).

## Comandos

```bash
pnpm install          # instala todo el workspace
pnpm dev              # arranca todas las apps en paralelo (Vendure + Next.js)
pnpm build            # build prod (todas las apps afectadas)
pnpm lint
pnpm test
pnpm typecheck
pnpm changeset        # crear changeset para release
pnpm format           # prettier write
```

Comandos por app: `pnpm --filter backend <script>`, `pnpm --filter storefront <script>`.

Turborepo cachea: `pnpm build` solo recompila lo cambiado. CI usa `--filter=...[origin/$BASE]` para correr solo apps afectadas.

## Convenciones de código

- **Idioma**: dominio y UI en español (productos, clientes, pedidos, etc.). Identificadores de código (variables, funciones, clases) en inglés. No traducir términos de dominio al refactorizar (`pedido`, `factura`, `caja` quedan como están en columnas de DB y enums).
- **GraphQL**, no REST. Endpoints nuevos = resolvers + schema.
- **Plugins Vendure** auto-contenidos: cada uno con su entidad, servicio, resolver, schema extension. No mezclar lógica de plugin distinto.
- **Migraciones TypeORM**: aditivas. Nunca `DROP`/`RENAME` columnas sin estrategia 2-versiones (igual que Flyway en `frc-comercial`).
- **Multi-tenant**: cada query/mutation respeta `ctx.channelId`. Vendure lo hace automático en `RequestContext`. Si bypaseás, justificá con comentario.
- **Pagos**: el SaaS NO custodia. Plugins de pago marcan order como pagada al confirmar (manual o webhook). No hay split de comisión.
- **Currency**: cada Channel tiene moneda base. Conversión vía plugin `currency-rate` solo para presentación, no se persiste en Order.

## Plugins propios (en `apps/backend/src/plugins/`)

| Plugin | Scope |
|---|---|
| `tenant-management` | Custom fields Channel (logo, slogan, colores, plan), CRUD admin, provisión subdominio |
| `currency-rate` | Tasas de cambio + servicio `convert()` + scheduler diario opcional |
| `theme-manager` | Lee custom fields y expone `activeChannelTheme` para storefront |
| `pos-online` | Admin UI extension venta rápida + WebHID lector códigos |
| `compras` | Compras a proveedores |
| `caja` | Apertura/cierre de caja + movimientos |
| `finanzas` | Cuentas, asientos, cierres |
| `cuentas-corrientes` | CC clientes y proveedores |
| `payment-transferencia` | PaymentHandler para transferencia manual |
| `payment-contraentrega` | PaymentHandler contra entrega |
| `payment-bancard` | Bancard (PY) — redirect + webhook |
| `payment-upay` | UPay (PY) — redirect + webhook |
| `sifen-bridge` | Stub. Integra `frc-efact` API externa cuando se requiera factura electrónica |

## Despliegue

| App | Mecanismo | Trigger |
|---|---|---|
| `backend` | Render web service (Docker) | `deploy.yml` `workflow_dispatch` con input `environment=alpha\|beta\|production` |
| `storefront` | Render web service (Node) | Idem |
| Postgres | Render managed | Provisionado manual una vez |
| Assets | Cloudflare R2 | Upload directo desde `AssetServerPlugin` |

Branch → environment default:
- `develop` → alpha (auto-deploy on merge)
- `release/beta` → beta (manual confirm)
- `master` → production (manual confirm)

## Cosas que NUNCA hacer en este repo

1. Push directo a `master` / `release/beta` / `develop`.
2. `git push --force` a ramas long-lived.
3. Squash merge entre branches long-lived.
4. Modificar migraciones TypeORM ya aplicadas.
5. `DROP` / `RENAME` columnas sin estrategia 2-versiones.
6. Commitear secretos.
7. Acoplar este producto a `frc-comercial` o `frc-efact`. Son productos separados.
8. Re-exportar plugins/lógica entre `apps/backend` y `apps/storefront`. Comunicarse vía GraphQL.

## Documentación

- [docs/arquitectura.md](docs/arquitectura.md) — diagrama y decisiones
- [docs/guia-desarrollo-cicd.md](docs/guia-desarrollo-cicd.md) — flujo dev día a día
- [docs/plan-implementacion.md](docs/plan-implementacion.md) — plan maestro y fases
- [docs/requerimiento-inicial.md](docs/requerimiento-inicial.md) — visión original
