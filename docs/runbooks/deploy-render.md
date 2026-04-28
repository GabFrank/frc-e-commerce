# Runbook — Deploy a Render

## Bootstrap inicial (primera vez)

1. **Crear cuenta Render** en https://render.com con GitHub OAuth.
2. **Conectar repo**: Dashboard → New → Blueprint → seleccionar `GabFrank/frc-e-commerce`.
3. Render detecta `render.yaml` y propone crear:
   - 1 Postgres `frc-e-commerce-db` (plan starter, US$7/mo).
   - 6 web services (backend × 3, storefront × 3, plan starter US$7/mo c/u).
   - Total estimado: **US$49/mo** todo arriba.
4. Confirmar y esperar provisioning (~5min).

## Variables de entorno manuales

Variables marcadas `sync: false` en `render.yaml` requieren set manual desde Render Dashboard → Service → Environment:

### Por servicio backend (alpha/beta/production)
- `SUPERADMIN_USERNAME` (recomendado: `admin@frc-e-commerce.com`)
- `SUPERADMIN_PASSWORD` (random string fuerte, distinto por env)
- `R2_ACCOUNT_ID`
- `R2_BUCKET` (recomendado: `frc-e-commerce-assets-<env>`)
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

### Storefront
Las URLs apuntan a los `*.onrender.com` por default. Cuando se conecte dominio custom, actualizar `STOREFRONT_URL` y `SHOP_API_URL`.

## Crear DBs separadas por env

Por default `render.yaml` crea 1 sola DB con `databaseName: frc_ecommerce_prod`. Para tener DBs separadas alpha/beta/production:

```sql
-- Conectar a la DB managed con el `psql` URL del dashboard
CREATE DATABASE frc_ecommerce_alpha;
CREATE DATABASE frc_ecommerce_beta;
-- frc_ecommerce_prod ya existe
```

Después editar `DATABASE_URL` de cada backend para apuntar a la DB correcta (`...?sslmode=require`).

## Deploy manual desde Actions

Una vez el blueprint esté arriba:

```bash
gh workflow run deploy.yml \
  -f app=backend \
  -f environment=alpha \
  -f version=backend@1.2.3
```

Ese workflow llama Render API. Requiere secrets:

- `RENDER_API_KEY` — generar en Render → Account → API Keys
- `RENDER_BACKEND_ALPHA`, `RENDER_BACKEND_BETA`, `RENDER_BACKEND_PROD` — service IDs (Render Dashboard → Service → Settings → ID)
- `RENDER_STOREFRONT_ALPHA/BETA/PROD` — idem

Set con:

```bash
gh secret set RENDER_API_KEY -b "rnd_xxx"
gh secret set RENDER_BACKEND_ALPHA -b "srv-xxx"
# ... etc
```

## Migraciones automáticas

El `start command` de Docker corre `migration:run` antes de bootear el server. La primera migración se debe **generar manualmente** una vez contra Postgres:

```bash
DATABASE_URL=postgres://...frc_ecommerce_alpha pnpm --filter backend migration:generate -- initial
git add apps/backend/src/migrations/*.ts
git commit -m "feat(backend): initial migration"
```

A partir de ahí, cada cambio de entidad genera nueva migración con el mismo comando.

## Rollback

Si un deploy rompe:

1. **Render UI** → Service → Events → "Rollback to previous deploy" (1 click).
2. Si el problema es DB: restore snapshot Postgres desde Render Dashboard → DB → Backups.
3. Si el problema es código: revert merge en GitHub + nuevo deploy.

**Nunca** correr `migration:revert` en producción sin restore de snapshot primero.

## Monitoreo

- Logs: Render Dashboard → Service → Logs (live tail).
- Métricas: CPU/RAM/Response time en Service → Metrics.
- Alertas: Service → Settings → Health Check Notifications (email).
- Sentry: agregar `SENTRY_DSN` env var cuando esté integrado.

## Costos

- 6 web services × US$7 = US$42
- 1 Postgres starter = US$7
- **Total: ~US$49/mo**

Cuando crezca:
- Postgres standard (US$25/mo) cuando supere 256MB RAM o 1GB storage.
- Web service standard (US$25/mo c/u) cuando supere 512MB RAM.
- Migrar a Hetzner Cloud cuando el factor 2-3x importe.
