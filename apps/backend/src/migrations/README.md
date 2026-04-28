# Migrations

TypeORM migrations para Postgres en producción.

## Workflow

### Local (SQLite, dev)

`vendure-config.ts` usa `synchronize: true` cuando no hay `DATABASE_URL` env. El esquema se crea/actualiza automáticamente, **no se generan migraciones**.

### Producción (Postgres)

Cuando se despliega con `DATABASE_URL` set, `synchronize: false`. Las migraciones son obligatorias:

```bash
# Generar migración de cambios pendientes
DATABASE_URL=postgres://localhost/frc_ecommerce_dev pnpm migration:generate add-tenant-fields

# Aplicar migraciones pendientes
DATABASE_URL=postgres://... pnpm migration:run

# Revertir última migración (solo emergencias)
DATABASE_URL=postgres://... pnpm migration:revert
```

En Render, el `start command` corre `pnpm migration:run && pnpm start:server` para aplicar migraciones antes del boot.

## Reglas

1. **Aditivas siempre**. Nunca `DROP COLUMN` / `RENAME COLUMN` en una sola migración.
2. **`DROP` con estrategia 2-versiones**:
   - Versión N: deja de usar la columna en código pero NO la borra.
   - Versión N+1: migración que dropea.
3. **Nunca modificar una migración ya aplicada en algún env**. Si está mal, escribir migración compensatoria.
4. Una migración rota en `production` requiere restore manual del último snapshot Render.

## Genesis pendiente

La primera migración (con todas las tablas Vendure + custom fields tenant-management + entidad CurrencyRate) se genera contra una DB Postgres limpia ANTES del primer deploy. No se commitea desde SQLite porque el SQL difiere.
