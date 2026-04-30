# Notas para agentes IA

## Next.js 16 — esto NO es el Next.js que conocés

`apps/web` usa Next.js 16 con breaking changes vs Next 14/15:

- **`proxy.ts`** reemplaza `middleware.ts` (función exportada se llama `proxy`, no `middleware`).
- **Turbopack** activado por default en `next dev`.
- **React 19** con Server Components y Server Actions.
- **Tailwind CSS 4** — no `tailwind.config.js`; configuración vía `@theme` en `globals.css`.

Antes de escribir código que toque APIs de Next, leé la guía relevante en
`apps/web/node_modules/next/dist/docs/`. No asumas convenciones de versiones anteriores.

## Stack consolidado

- Monolito Next.js 16 (storefront + admin + super + API en `apps/web`)
- Drizzle ORM + PostgreSQL (`packages/db` schema centralizado)
- Better Auth con Drizzle adapter
- shadcn/ui + Tailwind 4
- Multi-tenant: 1 DB, columna `tenantId`, helper `withTenant()`

Ver `CLAUDE.md` raíz para convenciones del proyecto y `.claude/plans/` para el plan vivo.
