# frc-e-commerce

SaaS de e-commerce multitienda para ropa, calzado y accesorios. Producto independiente del ERP `frc-comercial` y del facturador `frc-efact`.

## Stack

- **Backend**: Vendure 3.x (Node 20, NestJS, GraphQL, PostgreSQL)
- **Storefront**: Next.js 14 (App Router) + Tailwind + PWA
- **Multi-tenant**: Channel-based (1 sola DB compartida)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Hosting**: Render (backend + storefront + Postgres managed)

## Estructura

```
apps/
  backend/      # Vendure server + plugins propios
  storefront/   # Next.js PWA
packages/
  shared-types/
  shared-config/
  shared-utils/
docs/
  arquitectura.md
  guia-desarrollo-cicd.md
```

## Comandos

```bash
pnpm install         # instala todo el workspace
pnpm dev             # corre todas las apps en paralelo
pnpm build           # build producción
pnpm lint
pnpm test
pnpm typecheck
pnpm changeset       # crear changeset para release
```

## Documentación

- [Plan de implementación](docs/plan-implementacion.md)
- [Arquitectura](docs/arquitectura.md)
- [Guía de desarrollo / CI-CD](docs/guia-desarrollo-cicd.md)
- [Requerimiento inicial](docs/requerimiento-inicial.md)

## Convenciones rápidas

- Branches: `master` / `release/beta` / `develop` / `feature/*` / `fix/*` / `hotfix/*`
- Merges entre branches long-lived: **merge commit, NO squash**
- Versionado: Changesets (no semantic-release)
- Conventional commits: `feat:` minor, `fix:` patch, `feat!:` major
- Idioma: dominio en español, código e identificadores en inglés
