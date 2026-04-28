# Changesets

Esta carpeta gestiona el versionado de las apps publicables (`apps/backend`, `apps/storefront`).

## Cómo crear un changeset

```bash
pnpm changeset
```

Te pregunta qué paquete cambia, qué tipo de bump (`major`/`minor`/`patch`), y descripción. Crea un archivo Markdown en esta carpeta. Commiteá ese archivo con tu PR.

## Reglas locales

- **Conventional commits → bump esperado**:
  - `feat:` → `minor`
  - `fix:` → `patch`
  - `feat!:` o `BREAKING CHANGE:` → `major`
  - `chore:`, `refactor:`, `docs:`, `test:`, `ci:`, `perf:` → no requieren changeset
- Una PR sin cambios visibles para usuarios puede no tener changeset.
- Las release PRs las crea automáticamente el workflow `release.yml` al pushear a `master`.

## Apps ignoradas

`shared-config`, `shared-types`, `shared-utils` están en `ignore` — no se versionan ni publican, son internas al monorepo.

## Docs

- https://github.com/changesets/changesets
- https://github.com/changesets/action
