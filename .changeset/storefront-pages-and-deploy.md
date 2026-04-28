---
"@frc-e-commerce/backend": patch
"@frc-e-commerce/storefront": minor
---

- Backend: SQLite dev usa synchronize=true (no requiere migraciones para arrancar local). Migration script CLI listo para Postgres prod.
- Storefront: páginas base (home, /products, /products/[slug], /cart, /account), integración theme-manager via SSR, layout con header/footer, output standalone para Docker.
- Dockerfiles multi-stage para backend + storefront, optimizados para monorepo pnpm.
- render.yaml blueprint para 1-click deploy (Postgres + 6 web services).
- docs/runbooks/deploy-render.md con setup completo.
