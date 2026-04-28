# Guía de Desarrollo & CI/CD — frc-e-commerce

Manual operativo del flujo de trabajo. Estilo equivalente al de `frc-comercial/cicd-implementation/guia-desarrollo-cicd.md` pero adaptado a monorepo Node.

---

## TL;DR — flujo día a día

```
1. git checkout develop && git pull
2. git checkout -b feature/<modulo>-<descripcion>
3. <hacer cambios>
4. pnpm changeset             # describe el cambio para release
5. git add . && git commit -m "feat(<modulo>): <descripcion>"
6. git push -u origin feature/<modulo>-<descripcion>
7. gh pr create --base develop
8. CI corre → reviewer aprueba → MERGE COMMIT en GitHub UI
9. Auto-deploy a Render env alpha
```

Promoción a beta / production:
```
develop → release/beta : PR + MERGE COMMIT (no squash)
release/beta → master  : PR + MERGE COMMIT (no squash)
master                : Changesets release PR aparece sola; mergearla genera tags + GitHub Release
```

---

## Convenciones de commits

Usamos **Conventional Commits**:

```
<type>(<scope>): <descripcion en minúsculas, imperativo, sin punto final>

[body opcional]

[footer opcional, ej: BREAKING CHANGE: ...]
```

| Type | Bump |
|---|---|
| `feat` | minor |
| `fix` | patch |
| `feat!` o footer `BREAKING CHANGE:` | major |
| `chore`, `refactor`, `docs`, `test`, `ci`, `perf`, `style`, `build` | sin release |

Ejemplos:

```
feat(tenant-management): agregar custom field slogan en Channel
fix(currency-rate): redondeo correcto para PYG
feat(pos-online)!: cambiar contrato GraphQL de createPosOrder
chore: actualizar deps Vendure a 3.1.2
refactor(caja): extraer lógica de cierre a servicio
```

**Scope** = nombre del plugin o app: `tenant-management`, `currency-rate`, `pos-online`, `storefront`, `backend`, `ci`, etc.

---

## Branches

| Branch | Rol | Protección | Auto-deploy |
|---|---|---|---|
| `master` | Production / stable | `enforce_admins=true`, require PR, require checks | manual confirm → production |
| `release/beta` | Beta long-lived | `enforce_admins=true`, require PR | manual confirm → beta |
| `develop` | Integración / canal alpha | `enforce_admins=true`, require PR | auto → alpha |
| `feature/*` | Nueva funcionalidad | — | — |
| `fix/*` | Bug fix no urgente | — | — |
| `refactor/*`, `chore/*`, `docs/*` | Internos | — | — |
| `hotfix/*` | Bug urgente production | sale de `master` | post-merge **PR obligatorio a `develop`** |

### Reglas no negociables

1. **Nunca push directo** a `master` / `release/beta` / `develop`.
2. **Nunca `git push --force`** a esas ramas.
3. **Promoción entre branches long-lived = MERGE COMMIT, NO squash.** Squash colapsa los `feat:`/`fix:` y rompe el cálculo de versión Changesets.
4. PRs de feature → squash o merge según preferencia del autor (no afecta versionado).
5. **Hotfix sale de `master`**, no de `develop`. Después del merge a `master`, **PR obligatorio `master → develop`** para que el fix llegue a integración.
6. Nunca skipear hooks (`--no-verify`).

---

## Changesets

Cada PR que toca `apps/backend` o `apps/storefront` debe incluir un changeset:

```bash
pnpm changeset
```

Te pregunta:
- ¿Qué paquete cambia? → `@frc-e-commerce/backend` y/o `@frc-e-commerce/storefront`
- ¿Qué tipo de bump? → `major` / `minor` / `patch`
- Descripción → resumen amigable para el changelog

Crea un archivo `.changeset/<random>.md`. Commiteá ese archivo junto con tu PR.

PRs sin cambio user-facing (refactor, docs, ci, chore) pueden **no** llevar changeset.

`shared-config`, `shared-types`, `shared-utils` están en `ignore` — no se versionan ni publican.

---

## CI — GitHub Actions

### `ci.yml` — corre en cada PR

Eventos: `pull_request` a `develop`, `release/beta`, `master`.

Pasos:
1. Checkout con `fetch-depth: 0` (para `--filter=...[origin/$BASE]`).
2. Setup Node 20 + pnpm 9 + cache.
3. `pnpm install --frozen-lockfile`.
4. `pnpm exec turbo run lint test typecheck build --filter=...[origin/$BASE]` (solo apps afectadas).
5. Comentario en PR con resumen Turborepo.

### `release.yml` — corre en push a `master`

1. Checkout, install.
2. `pnpm exec changeset version` aplica los changesets pendientes.
3. Si hay versiones pendientes, abre / actualiza la **Release PR** ("Version Packages").
4. Mergeá esa PR (con merge commit) → workflow corre de nuevo:
   - `pnpm exec changeset publish` crea tags `backend@x.y.z`, `storefront@x.y.z`.
   - Crea GitHub Release por tag con changelog autogenerado.
5. Deploy a production NO es automático — disparar `deploy.yml` manualmente.

### `deploy.yml` — manual

`workflow_dispatch` con inputs:
- `app`: `backend` | `storefront`
- `environment`: `alpha` | `beta` | `production`
- `version`: tag a deployar (ej `backend@1.2.0`). Default = último tag.

Llama Render API para gatillar deploy del service correspondiente.

---

## Ambientes

| Env | Branch fuente | URL backend | URL storefront | Postgres DB |
|---|---|---|---|---|
| alpha | `develop` | `api-alpha.frc-e-commerce.com` | `*.alpha.frc-e-commerce.com` | `frc_ecommerce_alpha` |
| beta | `release/beta` | `api-beta.frc-e-commerce.com` | `*.beta.frc-e-commerce.com` | `frc_ecommerce_beta` |
| production | `master` | `api.frc-e-commerce.com` | `*.frc-e-commerce.com` | `frc_ecommerce_prod` |

---

## Migraciones (TypeORM)

Vendure usa TypeORM. Las migraciones son la **regla más crítica**.

### Generar

```bash
pnpm --filter backend migration:generate -- src/migrations/<descripcion>
```

### Aplicar (local)

```bash
pnpm --filter backend migration:run
```

En Render: el `start command` corre `migration:run` antes de levantar el server.

### Reglas

1. **Aditivas siempre**. Nunca `DROP COLUMN` / `RENAME COLUMN` en una sola migración.
2. **`DROP` con estrategia 2-versiones**:
   - Versión N: deja de usar la columna en código pero NO la borra.
   - Versión N+1 (después de deploy estable): migración que dropea.
3. **Nunca modificar una migración ya aplicada en algún env**. Si está mal, escribir nueva migración compensatoria.
4. Una migración rota en `production` requiere restore manual del último snapshot Render.

---

## Estructura de PR

Title: igual que el commit principal (`feat(modulo): descripcion`).

Body (template):

```md
## Resumen
- ...

## Cambios
- ...

## Test plan
- [ ] Unit tests pasan
- [ ] E2E manual: <pasos>
- [ ] Verificado en alpha

## Changeset
Sí / No (justifica si no)
```

---

## Hotfix flow

```
1. git checkout master && git pull
2. git checkout -b hotfix/<descripcion>
3. <fix>
4. pnpm changeset      # patch
5. PR a master → CI → MERGE COMMIT
6. release.yml genera tag + Release
7. deploy.yml workflow_dispatch → production
8. PR OBLIGATORIO master → develop (cherry-pick si conflicto)
```

---

## Lo que NUNCA hacer

1. Push directo a `master` / `release/beta` / `develop`.
2. `git push --force` a esas ramas.
3. Squash merge entre branches long-lived.
4. Modificar migraciones aplicadas.
5. `DROP`/`RENAME` columnas sin estrategia 2-versiones.
6. Commitear secretos.
7. Saltear CI con `--no-verify`.
8. Bumpear versión a mano editando `package.json`. Usar Changesets.
9. Pushear viernes a la tarde 😅 (durante adopción del workflow).
