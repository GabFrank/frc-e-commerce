# apps/backend

Vendure server con plugins propios.

**Estado:** placeholder — scaffold pendiente en Fase 1.

## Scaffold pendiente

Ejecutar (cuando se confirme):

```bash
cd apps
npx @vendure/create@latest backend --use-npm=false
```

Luego adaptar al monorepo:

1. Mover `package.json`, `tsconfig.json`, `src/` a `apps/backend/`.
2. Ajustar `package.json`:
   - `name: "@frc-e-commerce/backend"`
   - heredar tsconfig: `"extends": "@frc-e-commerce/shared-config/tsconfig.base.json"`
3. Configurar `vendure-config.ts` con:
   - DB Postgres (env vars).
   - `AssetServerPlugin` con `S3AssetStorageStrategy` → R2.
   - Multi-currency: `availableCurrencyCodes: ['PYG', 'USD', 'BRL', 'EUR']`.
   - `DefaultJobQueuePlugin`, `EmailPlugin`, `AdminUiPlugin`.
4. Crear plugin scaffolds en `src/plugins/<name>/`.
5. Dockerfile multi-stage.

Ver [docs/plan-implementacion.md](../../docs/plan-implementacion.md) Fase 1.
