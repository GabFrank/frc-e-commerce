# apps/storefront

Next.js PWA storefront.

**Estado:** placeholder — scaffold pendiente en Fase 2.

## Scaffold pendiente

Opción A — clonar Vendure Next.js Storefront Starter oficial:

```bash
cd apps
npx degit vendure-ecommerce/storefront-remix-starter storefront   # o el starter Next.js cuando esté oficial
```

Opción B — bootstrap Next.js limpio:

```bash
cd apps
pnpm create next-app@latest storefront --ts --tailwind --app --no-src-dir
```

Luego:

1. `name: "@frc-e-commerce/storefront"` en package.json.
2. Configurar Apollo / urql cliente apuntando a `process.env.SHOP_API_URL`.
3. Middleware Next.js (`middleware.ts`) que resuelva subdominio → channelToken → header.
4. Integrar `next-pwa` con manifest + service worker.
5. Theme tokens (CSS vars) consumibles del plugin `theme-manager`.

Ver [docs/plan-implementacion.md](../../docs/plan-implementacion.md) Fase 2.
