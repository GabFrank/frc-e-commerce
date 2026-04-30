# TODO — frc-e-commerce

Lista persistente de pendientes técnicos y features postergados. **Antes de empezar una sesión de trabajo, leer este archivo.** Marcar tareas como `~~tachadas~~` cuando se completan, no borrar (queda como changelog informal).

Las prioridades son orientativas; el orden real lo decide el usuario.

## 🔴 Crítico para MVP usable

- [ ] **Email real (Resend) integrado** — instalar `resend` + `@react-email/components`, crear templates en `apps/web/lib/email/`. Templates clave:
  - Confirmación de pedido (cliente)
  - Notificación de nuevo pedido (admin tienda)
  - Aceptación de invitación a equipo
- [x] **R2 upload real** — `@aws-sdk/client-s3` + `s3-request-presigner` instalados. `lib/r2.ts` server-only con `getPresignedUploadUrl` y `deleteR2Object`. Server action `presignProductImageUpload` en `lib/actions/upload.ts`. ImageUploader hace presign → PUT browser→R2 → addProductImage. Borrado de imagen también borra de R2 (best-effort). **Pendiente del usuario:** actualizar CORS bucket para permitir `PUT` desde `http://localhost:3000` (actualmente solo GET/HEAD).
- [ ] **Stripe SDK + handler real** — instalar `stripe`, completar `apps/web/lib/payments/stripe.ts`. Crear webhook endpoint `apps/web/app/api/webhooks/stripe/route.ts` que valide signature y mapee eventos a `markPaymentAsPaid`.

## 🟡 Multi-tenant / equipo

- [ ] **Invitaciones por email a miembros no registrados** — schema `tenant_invitation` (tenantId, email, role, token unique, expiresAt, acceptedAt, invitedBy). Server action `inviteByEmail`. Página `/accept-invite?token=xxx` que pide register/login y crea membership al confirmar. Reemplazar el aviso amarillo del `AddMemberForm` por botón "Invitar por email".
- [ ] **Edit role de un miembro existente** — actualmente solo se puede quitar y volver a agregar.
- [ ] **Permission matrix por rol** — definir `ROLE_PERMISSIONS` en `apps/web/lib/auth/permissions.ts` y aplicarlo a server actions (ej: `cashier` no puede crear productos).
- [ ] **Audit log básico** — tabla `audit_log` (tenantId, userId, action, resourceType, resourceId, metadataJson, createdAt). Loggear cambios sensibles (delete, role change, payment update).

## 🟡 Storefront / checkout

- [ ] **Página `/cuenta/pedidos`** — listado de pedidos del cliente autenticado.
- [ ] **Página `/cuenta/pedidos/[id]`** — detalle del pedido (status, payment, shipping). El checkout ya redirige aquí pero la ruta no existe.
- [ ] **Email confirmación pedido al finalizar checkout** (depende del Resend integrado).
- [ ] **Stock lock en checkout con concurrencia** — usar `SELECT ... FOR UPDATE` en transacción al crear order para evitar overselling cuando dos clientes compran el último item simultáneamente.
- [ ] **Recuperación carrito abandonado** — cron job (Render cron o `apps/workers`) que envía email a clientes con cart > 24h sin checkout.
- [ ] **SEO**: sitemap.xml dinámico por tenant, robots.txt, og-images por producto.

## 🟢 Admin / catálogo

- [ ] **Borrar imagen de producto** — botón en `ImageUploader` para eliminar imagen subida (server action + delete en R2).
- [ ] **Reordenar imágenes** — drag-and-drop para cambiar `position`.
- [ ] **CRUD categorías UI** — actualmente las categorías solo se crean por server action; falta página `/admin/categorias` con CRUD completo.
- [ ] **Editor branding tenant** — `/admin/configuracion` actualmente es solo lectura. Agregar formulario para editar nombre, slogan, descripción, colores, logo (upload R2).
- [ ] **Bulk actions productos** — activar/archivar/borrar varios productos de la lista.
- [ ] **Importar productos CSV** — utility para cargar catálogo masivo.

## 🟢 Pagos / pedidos

- [ ] **Refund desde admin** — botón "Reembolsar" en `/admin/pedidos/[id]` (handler Stripe + manual).
- [ ] **Estado de envío editable** — admin puede pasar pedido a `shipped` con tracking, `delivered` al confirmar.
- [ ] **Bancard handler** — implementar `apps/web/lib/payments/bancard.ts` con redirect VPOS Paraguay + webhook.
- [ ] **UPay handler** — idem para UPay.
- [ ] **Mercado Pago handler** — idem.

## 🟢 Reportes / analítica

- [ ] **Página `/admin/reportes`** — Recharts + TanStack Table:
  - Ventas por período (line/bar)
  - Top productos por revenue + unidades
  - Margen bruto por producto
  - Stock bajo (variantes con `stock < 5`)

## 🟢 POS + inventario (Fase 5)

- [ ] **Schemas inventory** — `supplier`, `purchaseOrder`, `purchaseOrderLine`, `purchaseExtraCost`, `stockMovement`.
- [ ] **Costos extras prorrateados** — al recibir PO con flete/aduana, distribuir sobre líneas proporcional al `unitCost * qty`. Actualizar `costoPromedio` del variant + alta `stockMovement` tipo `purchase`.
- [ ] **POS UI** — `/admin/pos` con búsqueda keyboard-first, lector USB-HID via `navigator.hid`, carrito in-memory, finaliza en orden con `channel='pos'`.
- [ ] **Stock movements audit log** — vista `/admin/inventario` con todos los movimientos.
- [ ] **Multi-bodega** — schema `warehouse` + stock por bodega. Transferencias.
- [ ] **Caja** (apertura/cierre, arqueo, asociado a usuario cashier).

## 🟢 Themes + multi-currency (Fase 6)

- [ ] **Theme presets** — 3+ presets en `apps/web/lib/themes/` (minimal, boutique, streetwear). Layouts + paletas + tipografías distintas.
- [ ] **Theme switcher en `/admin/temas`** — preview + selector. Se persiste en `tenant.themeCode` (campo a agregar) + override colores específicos.
- [ ] **Multi-currency display** — schema `exchange_rate` por tenant. Selector en storefront que reconvierte precios para presentación. Persistencia siempre en moneda base del tenant.
- [ ] **i18n storefront** — español default, inglés y portugués opcional. Vía cookie + Server Components (`/[lang]/...`).

## 🟢 SaaS / billing (post-MVP)

- [ ] **Trial 14 días** automático al crear tenant plan free.
- [ ] **Stripe Billing** — recurring subscriptions para upgrade de plan.
- [ ] **Métricas SaaS** en `/super/dashboard` — MRR, churn, LTV, tenants activos.
- [ ] **Dominio custom** — campo `tenant.customDomain` con verificación DNS + Caddy on-demand TLS o Cloudflare for SaaS. Resolución en `proxy.ts`.

## 🟢 DevOps / infra

- [ ] **Tests Vitest** — cobertura mínima sobre server actions críticos (cart, order, payments).
- [ ] **Tests Playwright E2E** — flujo storefront → cart → checkout → payment manual confirmado.
- [ ] **Sentry** — instalar `@sentry/nextjs`, init en `next.config.ts`, instrumentation. DSN ya tiene placeholder.
- [ ] **PostHog** — instalar + init analytics + feature flags.
- [ ] **CI workflow Postgres service** — agregar `postgres:16` service a `.github/workflows/ci.yml` para tests de integración.
- [ ] **Render deploy** — crear cuenta + Blueprint deploy de `render.yaml`. Validar `output: 'standalone'` standalone bundle.
- [ ] **Cloudflare DNS wildcard** — `*.frc-ecommerce.com` → web alpha (cuando exista).
- [ ] **Migración inicial Postgres en CI/CD** — `preDeployCommand: pnpm db:migrate` en Render para que cada deploy aplique migraciones aditivas.

## 🟢 Cumplimiento Paraguay (post-MVP)

- [ ] **SIFEN factura electrónica** — integrar con `frc-efact` API existente. Plugin `sifen-bridge` que tras orden confirmada llama API y persiste número de timbrado.
- [ ] **Reportes IVA mensuales**.
- [ ] **Retenciones** (cuando aplica).

## 🔵 Nice-to-have / IA (largo plazo)

- [ ] **Generación descripción producto** con Claude API.
- [ ] **Background removal** automático para fotos de producto.
- [ ] **Chatbot soporte** entrenado con catálogo del tenant.
- [ ] **Búsqueda semántica** con embeddings.
- [ ] **Recomendaciones personalizadas** ML.
- [ ] **WhatsApp Business API** para confirmaciones y soporte.
- [ ] **PWA** — manifest + service worker para instalación offline-capable.

## 🪲 Bugs conocidos

- [x] **Hydration warning en root layout** — provenía de extensiones Chrome (`crxemulator` de CRX Emulator, `cz-shortcut-listen` de ColorZilla) que inyectan atributos al `<html>`/`<body>` antes de hidratar. **Fix:** `suppressHydrationWarning` en `<html>` y `<body>` en `app/layout.tsx`. Solo suprime warnings de root layout; mismatches reales en componentes hijos siguen apareciendo.

---

## Convenciones

- Tareas críticas para MVP: 🔴
- Importantes pero no bloqueantes: 🟡
- Mejoras / features adicionales: 🟢
- Investigación / largo plazo: 🔵
- Bugs: 🪲
- Al completar una tarea: cambiar `[ ]` → `[x]` y opcionalmente agregar referencia al commit/PR.
- Si se descubren TODOs nuevos durante el desarrollo, agregar en la sección correspondiente.
