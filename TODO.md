# TODO — frc-e-commerce

Lista persistente de pendientes técnicos y features postergados. **Antes de empezar una sesión de trabajo, leer este archivo.** Marcar tareas como `~~tachadas~~` cuando se completan, no borrar (queda como changelog informal).

## ⚠️ Cambio de enfoque del MVP (2026-05-01)

El MVP **dejó de apuntar a un storefront público con checkout online**. El nuevo objetivo es un **back-office operativo completo**: catálogo masivo + POS multi-moneda + caja con conteo físico + compras con prorrateo de costos + cancelaciones/devoluciones + reportes financieros básicos. El storefront público y el checkout online (incluyendo Stripe) se difieren a **Fase 2**.

Roadmap del nuevo MVP (milestones M1–M7) en [`/Users/gabfranck/.claude/plans/1-no-hace-falta-enumerated-valiant.md`](../../.claude/plans/1-no-hace-falta-enumerated-valiant.md).

Las prioridades son orientativas; el orden real lo decide el usuario.

## 🔴 Crítico para MVP back-office (entra al producto vendible)

> **Estado al 2026-05-11**: M1–M7 base completos. Pendiente cerrar M7 con catálogo masivo (CSV, bulk actions, branding), Resend y audit log. Reportes ya están funcionando con las 5 tabs.

### M1–M6 ✅ Completados

- [x] **Multi-moneda + RBAC + UI configuración monedas** — schemas currency/tenant_currency/exchange_rate/denomination + capability matrix + `hasCapability` + `requireSessionCapability` (commit `3aa1d11`).
- [x] **Customer + admin override + POS skeleton multi-moneda** — schema customer + autocomplete + override admin via `validateAdminCredential` (commit `2858e69`).
- [x] **Cash session apertura/cierre + cobro POS multi-moneda + stock movements** — cash_session/cash_session_balance/cash_movement/cash_closure/cash_closure_metric, diálogos apertura+cierre, createPosOrder transaccional (commit `3aba604`).
- [x] **Compras + proveedores + lógica prorrateo costos extras** — supplier, purchase_order(*), 4 estrategias de allocation (cost/equal/qty/manual), weighted average avg_cost (commit `04c9895`).
- [x] **Cancelar/devolver venta POS desde admin** — `cancelPosOrder` + `registerSaleReturn`, impacto contable cross-sesión (commit `2c8b03b`).

### M7 ✅ Completados (parte)

- [x] **Reportes** — `/admin/reportes` con 5 tabs (Ventas/Productos/Inventario/Caja/Compras) + Recharts, filtros de rango + granularidad en URL, KPIs por tab, tablas de detalle con links cruzados (commits `d8a4b35`, `7b38146`).

### M7 🔴 Pendientes

#### Catálogo masivo

- [ ] **Importar productos CSV** — `apps/web/app/(admin)/admin/productos/import/page.tsx` con upload + preview + apply. Soporta producto+variantes en una hoja (filas con mismo SKU base).
- [ ] **CRUD categorías UI completo** — `/admin/categorias` con crear/editar/borrar/jerarquía padre-hijo.
- [ ] **Bulk actions productos** — checkbox en lista, dropdown "Activar / Archivar / Borrar seleccionados".
- [ ] **Editor branding tenant** — `/admin/configuracion/tienda` con form para nombre legal, dirección, logo (R2), datos para recibo (RUC, teléfono, email).
- [ ] **Borrar imagen de producto** — botón en `ImageUploader` (server action + delete R2).
- [ ] **Reordenar imágenes** — drag-and-drop para cambiar `position`.
- [ ] **Filtros + paginación en `/admin/productos`** — la lista actual carga todos los productos del tenant. Con 500+ se va a sentir; agregar filtros (categoría, estado, búsqueda) + paginación 25/50/100.

#### Email mínimo (Resend)

- [ ] **Resend integrado** — solo para invitaciones a equipo + reset password. Templates en `apps/web/lib/email/`.
- [ ] **Invitaciones por email** — schema `tenant_invitation` (tenantId, email, role, token unique, expiresAt, acceptedAt, invitedBy). Server action `inviteByEmail`. Página `/accept-invite?token=xxx` que pide register/login y crea membership.
- [ ] **Edit role de un miembro existente.**

#### Audit log básico

- [ ] **Tabla `audit_log`** (tenantId, userId, action, resourceType, resourceId, metadataJson, createdAt). Loggear cambios sensibles: delete, role change, payment update, cancel order, override admin, archivar/eliminar producto, recibir PO, modificar precio venta vía PO receive, etc.

---

## 🟡 Fase 2 — Storefront público + checkout online (post-MVP back-office)

### Storefront / checkout

- [ ] **Página `/cuenta/pedidos`** — listado de pedidos del cliente autenticado.
- [ ] **Página `/cuenta/pedidos/[id]`** — detalle del pedido (status, payment, shipping). El checkout ya redirige aquí pero la ruta no existe.
- [ ] **Stock lock en checkout** — `SELECT ... FOR UPDATE` en transacción al crear order para evitar overselling concurrente online.
- [ ] **Recuperación carrito abandonado** — cron job (Render cron) que envía email a clientes con cart > 24h sin checkout.
- [ ] **SEO**: sitemap.xml dinámico por tenant, robots.txt, og-images por producto.

### Pagos online

- [ ] **Stripe SDK + handler real** — instalar `stripe`, completar `lib/payments/stripe.ts`. Webhook `app/api/webhooks/stripe/route.ts` que valide signature y mapee eventos a `markPaymentAsPaid`.
- [ ] **Bancard handler** — `lib/payments/bancard.ts` con redirect VPOS Paraguay + webhook.
- [ ] **UPay handler** — idem.
- [ ] **Mercado Pago handler** — idem.

### Email transaccional Fase 2

- [ ] **Confirmación de pedido (cliente)** — template + envío post-checkout.
- [ ] **Notificación de nuevo pedido (admin tienda)**.
- [ ] **Estado de envío editable** — admin puede pasar pedido a `shipped` con tracking, `delivered` al confirmar; cada cambio dispara email.

---

## 🟢 Polish admin (post-Fase 2)

- [ ] **Refund Stripe desde admin** — botón "Reembolsar" en `/admin/pedidos/[id]` (handler Stripe + manual).
- [ ] **Permission matrix avanzado** — overrides por tenant (ej: cashier de tenant X puede dar más descuento que el default).

---

## 🟢 POS extensions (post-MVP)

- [ ] **WebHID** real para hardware específico (balanzas, cajón portamonedas con ESC/POS direct).
- [ ] **Override de descuento por PIN admin** — si descuento general > X% configurable, pide PIN.
- [ ] **POS offline real** — service worker + sync queue cuando vuelve conexión. MVP solo guarda carrito en localStorage y bloquea cobro si offline.
- [ ] **Multi-bodega** — schema `warehouse` + stock por bodega + transferencias entre bodegas. Selector en POS.
- [ ] **Cuentas corrientes (fiado)** — schema `customer_account` con líneas de cargo/abono + saldo. Método de pago `cuenta_corriente` en POS.

---

## 🟢 Themes + multi-currency display avanzado (Fase 6)

- [ ] **Theme presets** — 3+ presets en `lib/themes/` (minimal, boutique, streetwear).
- [ ] **Theme switcher en `/admin/temas`** — preview + selector. Persiste en `tenant.themeCode` + override colores.
- [ ] **Multi-currency display en storefront** — selector que reconvierte precios según `exchange_rate` vigente. Persistencia siempre en moneda primary del tenant.
- [ ] **i18n storefront** — español default, inglés y portugués opcional. Vía cookie + Server Components (`/[lang]/...`).

---

## 🟢 SaaS / billing (post-MVP)

- [ ] **Trial 14 días** automático al crear tenant plan free.
- [ ] **Stripe Billing** — recurring subscriptions para upgrade de plan.
- [ ] **Métricas SaaS en `/super/dashboard`** — MRR, churn, LTV, tenants activos.
- [ ] **Dominio custom** — campo `tenant.customDomain` con verificación DNS + Caddy on-demand TLS o Cloudflare for SaaS. Resolución en `proxy.ts`.

---

## 🟢 DevOps / infra

- [ ] **Tests Vitest** — cobertura mínima sobre server actions críticos (cart, order, payments, pos-order, cash-session, purchase-receive con prorrateo).
- [ ] **Tests Playwright E2E** — flujos POS golden path (abrir caja → vender → cobrar multi-moneda → cerrar caja).
- [ ] **Sentry** — `@sentry/nextjs`, init en `next.config.ts`, instrumentation. DSN ya tiene placeholder.
- [ ] **PostHog** — instalar + init analytics + feature flags.
- [ ] **CI workflow Postgres service** — agregar `postgres:16` service a `.github/workflows/ci.yml` para tests de integración.
- [ ] **Render deploy** — crear cuenta + Blueprint deploy de `render.yaml`. Validar `output: 'standalone'` standalone bundle.
- [ ] **Cloudflare DNS wildcard** — `*.frc-ecommerce.com` → web alpha (cuando exista).
- [ ] **Migración inicial Postgres en CI/CD** — `preDeployCommand: pnpm db:migrate` en Render para que cada deploy aplique migraciones aditivas.

---

## 🟢 Cumplimiento Paraguay (post-MVP)

- [ ] **SIFEN factura electrónica** — integrar con `frc-efact` API existente. Plugin `sifen-bridge` que tras orden confirmada llama API y persiste número de timbrado.
- [ ] **Reportes IVA mensuales**.
- [ ] **Retenciones** (cuando aplica).

---

## 🔵 Nice-to-have / IA (largo plazo)

- [ ] **Generación descripción producto** con Claude API.
- [ ] **Background removal** automático para fotos de producto.
- [ ] **Chatbot soporte** entrenado con catálogo del tenant.
- [ ] **Búsqueda semántica** con embeddings.
- [ ] **Recomendaciones personalizadas** ML.
- [ ] **WhatsApp Business API** para confirmaciones y soporte.
- [ ] **PWA** — manifest + service worker para instalación offline-capable.

---

## 🛠️ Deuda técnica descubierta

- [ ] **Migrar `timestamp` → `timestamptz` en todo el schema** — 50 columnas usan `timestamp without time zone`. Combinado con `new Date()` desde JS (que postgres-js serializa como UTC ISO) y `defaultNow()` (que usa local DB time), causa drift de TZ silencioso. Hoy en `purchase-order` lo mitigamos pasando todo a `sql\`now()\``, pero la solución correcta es `timestamptz` (un ALTER COLUMN aditivo + verificación de comportamiento por módulo). Stack: Render Postgres + Node 20 en zona local PY (UTC-3). Riesgo alto si se ignora a largo plazo: cierres de caja, cancelaciones, reportes podrían cargar timestamps en TZ inconsistente.
- [ ] **Productos huérfanos sin variantes** — Antes del fix de `isUniqueViolation` (commit `ec9132d`), si `ensureDefaultVariantInternal` fallaba por SKU colisión, el producto quedaba creado pero sin variante Default. Hoy se podría agregar una tarea de cleanup que detecte `product` sin `productVariant.productId = product.id` y lo borre o repare. Hay 1–2 productos así en la DB demo.
- [ ] **`new Date()` en otras actions** — 21 lugares fuera de `purchase-order.ts` siguen usando `new Date()` para insertar timestamps. Mientras `timestamptz` no se aplique, conviene replicar el patrón `sql\`now()\`` también en `order.ts`, `pos-order.ts`, `cash-session.ts`, etc. (`grep -rn "new Date()" apps/web/lib/actions/`).
- [ ] **Variantes que aparecen en buscadores sin filtro Default** — `purchase-search.ts` filtra "Default cuando hay siblings con atributos" via `filterOutDummyDefaults`. El mismo concepto debería aplicarse al storefront PDP y al POS search para evitar que el operador venda la Default placeholder cuando ya hay color/talle reales.
- [ ] **Tema per-tenant** — Sistema `--tenant-primary` está cableado pero `--tenant-primary` siempre cae en `var(--primary)`. Hace falta el componente que lea `tenant.themeJson` (o similar) y reasigne CSS vars inline en el layout admin/storefront. Se difería a Fase 6 ("theme-manager") pero la infra ya está medio puesta.

## 🪲 Bugs conocidos

- [ ] **next-themes inline `<script>` triggers React 19 warning** — `ThemeProvider` (next-themes 0.4.6) inyecta un `<script>` para anti-FOUC; React 19 emite "Encountered a script tag while rendering" en console. Es warning, no rompe. Workaround: ignorarlo, o upgradear next-themes cuando publiquen fix oficial, o reemplazar con implementación propia.
- [x] **Hydration warning en root layout** — provenía de extensiones Chrome que inyectan atributos al `<html>`/`<body>` antes de hidratar. Fix: `suppressHydrationWarning` en `<html>` y `<body>` de `app/layout.tsx`.
- [x] **Timestamps PO con TZ inconsistente** — `placedAt`/`receivedAt` con `new Date()` JS vs `createdAt` con `defaultNow()` causaban diff de 4hs en `purchase-order`. Fix puntual: pasar todo a `sql\`now()\`` (commit `ec9132d`). El problema sistémico (timestamp sin TZ) sigue listado arriba en Deuda técnica.

---

## ✅ Completados (changelog informal)

### 2026-05-11 — Sesión variantes + financiero + compras

- [x] **Variantes color × talle estilo Shopify** — `product.gender` enum, `productVariant.{color,size,sizeKind}` como columnas dedicadas (reemplaza JSONB attributes), unique `(productId, color, size)`. `bulkCreateVariantsByMatrix` genera N×M con overrides + exclude. `MatrixVariantDialog` con auto-commit + toggle adulto/infantil. `VariantForm` con filtros + paginación + archive por fila. `setVariantActive` soft delete. Auto-creación de variante "Default" en `createProduct`. Filtrado en POS + storefront + addToCart (commit `da26649`).
- [x] **Financiero/Cajas + sidebar agrupado con RBAC** — `/admin/financiero/cajas` lista con KPIs + tabla 200 sesiones; `/admin/financiero/cajas/[id]` detalle 25/75 con KPIs (ventas, ganancia, descuentos, conteo por moneda) + filtros server-side + tabla ventas paginada. `SidebarNavGroup` agrupable con filtrado por capability. shadcn `dropdown-menu` agregado (commit `b4c1423`).
- [x] **POS rework: header inline + método principal + variantes color/talle en cart + snapshots** — PosShell con header propio, `pos_config.primaryPaymentMethod`, deep-link `?close=1` desde financiero, `order_line.variant_snapshot` + `cart_line.variant_snapshot` (commit `7df39ab`).
- [x] **Reportes shell + 5 tabs full** — `/admin/reportes` con tabs (Ventas, Productos, Inventario, Caja, Compras), Recharts (Area, Line, HorizontalBar), filtros de rango+granularidad en URL, RBAC por tab (`reports.financial` / `reports.operational`), KPIs + tablas detalle (commits `d8a4b35`, `7b38146`).
- [x] **Compras refactor full** — Página dedicada `/admin/compras/nueva` (no más dialog). `VariantSearchPicker` agrupado por producto con expand/collapse + "+ Todas" + paginación "Cargar más" + filtro de variante Default + búsqueda con last/avg cost por variante. `NewSupplierDialog` y `NewProductInlineDialog` (con matriz reusada) inline. Líneas compactas 1-row con Tab/Enter cycling qty→costo→precio venta. Sell price persisted en `purchaseOrderLine.sellPriceInPrimary`, aplicado a `productVariant.price` al recibir. Margen % colored real-time. Auto-save localStorage (`usePoDraft`) + DB drafts (`saveDraftPurchaseOrder` + `promoteFromDraftId`). `LocalDraftBanner` en lista. `ProductDangerZone` con archive + hard-delete safety-checked. `archiveProduct` + `checkProductDeletable` + `deleteProduct`. Fix timestamps con `sql\`now()\`` en lugar de `new Date()`. `isUniqueViolation` unwrapea `err.cause` hasta 4 niveles. SKU prefix `slice(0,20)` (commit `ec9132d`).
- [x] **Theme primary violet** — `--primary` y `--ring` cambiados a `oklch(0.55 0.22 290)` en light + `oklch(0.7 0.22 290)` en dark. Antes era neutral grayscale completo. Mantiene sistema `--tenant-primary` para per-tenant theming futuro (commit `6ca8ae4`).

### Anteriores

- [x] **R2 upload real** — `@aws-sdk/client-s3` + presigned URLs + ImageUploader. Bucket `frc-e-commerce-assets` configurado: API token Object R/W, r2.dev habilitado, CORS abierto para `localhost:3000`, `**.r2.dev` whitelisteado en `next.config.ts`. Verificado end-to-end (commit `9a928b2`).
- [x] **Theme toggle (light/dark)** — next-themes + ThemeProvider + toggle en admin/storefront (commit `5f17217`).
- [x] **Semantic tokens** — 40 archivos refactorizados desde colores hardcoded (commit `004cfd8`).
- [x] **Imágenes específicas por variante** — `product_image.variant_id` nullable + expander en VariantForm + ProductDetailView client wrapper (commit `2b91e20`).

---

## Convenciones

- Tareas críticas para MVP: 🔴
- Importantes pero no bloqueantes / Fase 2: 🟡
- Mejoras / features adicionales: 🟢
- Investigación / largo plazo: 🔵
- Bugs: 🪲
- Al completar una tarea: cambiar `[ ]` → `[x]` y opcionalmente agregar referencia al commit/PR.
- Si se descubren TODOs nuevos durante el desarrollo, agregar en la sección correspondiente.
