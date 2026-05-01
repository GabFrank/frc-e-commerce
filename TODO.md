# TODO — frc-e-commerce

Lista persistente de pendientes técnicos y features postergados. **Antes de empezar una sesión de trabajo, leer este archivo.** Marcar tareas como `~~tachadas~~` cuando se completan, no borrar (queda como changelog informal).

## ⚠️ Cambio de enfoque del MVP (2026-05-01)

El MVP **dejó de apuntar a un storefront público con checkout online**. El nuevo objetivo es un **back-office operativo completo**: catálogo masivo + POS multi-moneda + caja con conteo físico + compras con prorrateo de costos + cancelaciones/devoluciones + reportes financieros básicos. El storefront público y el checkout online (incluyendo Stripe) se difieren a **Fase 2**.

Roadmap del nuevo MVP (milestones M1–M7) en [`/Users/gabfranck/.claude/plans/1-no-hace-falta-enumerated-valiant.md`](../../.claude/plans/1-no-hace-falta-enumerated-valiant.md).

Las prioridades son orientativas; el orden real lo decide el usuario.

## 🔴 Crítico para MVP back-office (entra al producto vendible)

### Multi-moneda (M1 — base para todo lo demás)

- [ ] **Schemas:** `currency` (master), `tenant_currency` (1 primary + N secundarias activas), `exchange_rate` versionado por timestamp (buyRate/sellRate manual), `denomination` (master por moneda — billetes y monedas).
- [ ] **Seed:** PYG/USD/BRL + denominaciones reales completas. `tenant_currency` para tenant `demo`: PYG primary + USD/BRL activos. `exchange_rate` inicial dummy (~7.300 PYG/USD, ~1.300 PYG/BRL).
- [ ] **UI `/admin/configuracion/monedas`:** activar/desactivar monedas del tenant, marcar primary, actualizar buy/sell rates (cada cambio inserta nueva fila en `exchange_rate`).
- [ ] **`packages/shared-utils/currency`:** extender con `formatMoneyMultiCurrency` (devuelve N representaciones del mismo monto) y `parseMoneyInput`.

### Permisos (M1 — RBAC)

- [ ] **`apps/web/lib/auth/permissions.ts`:** type `Capability`, matrix `ROLE_CAPS: Record<TenantMemberRole, Set<Capability>>`, helpers `hasCapability`, `requireCapability(userId, tenantId, cap)`. Capabilities clave: `product.write`, `pos.sell`, `pos.see_cost`, `cash.open`, `cash.close`, `order.cancel`, `order.return`, `purchase.write`, `purchase.receive`, `currency.set_rate`, `reports.financial`, `admin.override`.
- [ ] **Aplicar `requireCapability`** en cada server action existente y nueva. UI también lee la matrix para ocultar/deshabilitar botones.
- [ ] **Server action `validateAdminCredential(email, password)`** — verifica via Better Auth sin abrir sesión nueva, devuelve userId si tiene rol >= manager (para PIN override de brindis).

### Catálogo masivo (M7)

- [ ] **Importar productos CSV** — `apps/web/app/(admin)/admin/productos/import/page.tsx` con upload + preview + apply. Soporta producto+variantes en una hoja (filas con mismo SKU base).
- [ ] **CRUD categorías UI completo** — `/admin/categorias` con crear/editar/borrar/jerarquía padre-hijo.
- [ ] **Bulk actions productos** — checkbox en lista, dropdown "Activar / Archivar / Borrar seleccionados".
- [ ] **Editor branding tenant** — `/admin/configuracion/tienda` con form para nombre legal, dirección, logo (R2), datos para recibo (RUC, teléfono, email).
- [ ] **Borrar imagen de producto** — botón en `ImageUploader` (server action + delete R2).
- [ ] **Reordenar imágenes** — drag-and-drop para cambiar `position`.

### Customer (M2)

- [ ] **Tabla `customer`** (tenantId, name, document, phone, email, notes) con índices por document/phone.
- [ ] **Server actions** `customer.search(query)` (autocomplete por doc/teléfono/nombre, limit 10), `customer.create`, `customer.update`.
- [ ] **`order.customerId`** FK opcional. `order.customerName/Email/Phone` siguen como snapshot al momento de la venta.

### POS + Caja (M3, M4, M5)

- [ ] **Layout `/admin/pos`** full-screen sin sidebar. Header con cashier name + sesión activa + botón cerrar caja (F9).
- [ ] **Zustand store `usePosCart`** con persist `localStorage` (key tenant-aware), state: lines, customerId, customerSnapshot, generalDiscount, surcharge, primaryCurrency override.
- [ ] **Wrappers shadcn:** `Dialog`, `Tabs`, `RadioGroup`, `Tooltip`, `Switch` en `apps/web/components/ui/`.
- [ ] **Diálogo búsqueda** — input con autocomplete debounced (150ms), grid de cards con foto/SKU/precio/stock, navegación ↑↓, Enter selecciona, Esc cierra. Touch: tap selecciona. Lector USB: detecta scan por velocidad de input (8+ chars en <50ms + Enter).
- [ ] **Diálogo variantes** — grid compacto con foto/atributos/stock/precio si producto tiene variantes.
- [ ] **Diálogo detalle de línea** — qty, descuento línea (% o $), precio editable solo manager+, marcar brindis (checkbox simple si producto.isComplimentary; sino botón que abre Diálogo override admin).
- [ ] **Diálogo override admin** — email + password de admin/owner/manager; valida via `validateAdminCredential`; audita en `order_line.complimentary_authorized_by`.
- [ ] **Diálogo cobro** — tabla multi-fila (kind: payment/change/discount/surcharge × method × currency × amount × cotización × amountInPrimary). Validación: Diff total cobrado vs total venta = 0 para confirmar. Cotización autocompleta del rate vigente (sellRate al cobrar) editable.
- [ ] **Schema `pos_config` (1:1 tenant)** — enabled_currencies, pricing_display_currencies, payment_methods, search_show_images, show_cost_to_admin, strict_stock, ticket_prefix, ticket_correlative, receipt_header, receipt_footer.
- [ ] **UI `/admin/configuracion/pos`** — tabs: Monedas y métodos / Pantalla / Recibo / Reset correlativo.
- [ ] **Schemas caja** — `cash_session` (1 abierta por cashier), `cash_session_balance` (1 fila por moneda), `cash_count_detail` (filas por denominación con moment open/close), `cash_movement` (kind: sale_in/sale_return_out/sale_cancel_out/manual_in/manual_out), `cash_closure` (header), `cash_closure_metric` (filas con desgloses por method×currency).
- [ ] **Diálogo apertura caja** — por moneda activa: monto declarado + botón "Abrir contador" → diálogo de conteo por denominación con subtotal por fila y diferencia vs declarado.
- [ ] **Diálogo cierre caja** — `expected` calculado del session+movements; input contado físico con mismo diálogo de denominación; nota de cierre; genera `cash_closure` + `cash_closure_metric` row-based; pantalla resumen imprimible (ticket promedio, n° transacciones, diferencias por moneda).
- [ ] **Server action `createPosOrder`** — transacción Drizzle: insert order (channel='pos', cashSessionId, ticket_correlative atómico), order_lines, stock_movements (kind='sale'), decrement stock, payment header (status='captured'), payment_detail rows, cash_movement rows (solo para métodos físicos), increment posConfig.ticket_correlative.
- [ ] **Cambio temporal de moneda primary** para una venta específica (override en posCartStore + persistencia en `order.primary_currency_at_time`).
- [ ] **Devolución desde POS** — solo de ventas con `cash_session_id` = sesión activa del cashier actual. UI: buscar venta por número, seleccionar líneas + qty, registra `stock_movement` kind='sale_return' linkeado al original + `cash_movement` kind='sale_return_out' si efectivo.

### Compras + inventario (M6)

- [ ] **Schemas** — `supplier`, `purchase_order` (status draft/placed/received/partially_received/cancelled, currency_code, exchange_rate_snapshot al recibir, total_in_primary), `purchase_order_line` (received_quantity / returned_quantity / cancelled_quantity, allocated_extras_in_currency, landed_unit_cost), `purchase_extra_cost` (description, amount, allocation_strategy: cost/equal/qty/manual default cost), `purchase_extra_cost_manual_split` (cuando strategy='manual'), `stock_movement` (kind: purchase / purchase_return / purchase_cancel / sale / sale_return / sale_cancel / adjustment, original_movement_id self FK), `product_variant_avg_cost` (cache denormalizado).
- [ ] **CRUD `/admin/proveedores`** — listar, crear, editar, archivar.
- [ ] **`/admin/compras`** — lista + crear PO + agregar líneas con variantes + agregar extras con estrategia mezclable + recibir total/parcial.
- [ ] **Lógica de prorrateo** — al recibir PO: por cada extra cost calcular splits según strategy (cost: proporcional a `unitCost*qty`; equal: `1/n_lineas`; qty: `qty/total_qty`; manual: lookup en `purchase_extra_cost_manual_split`). Sumar splits por línea → `landed_unit_cost = unitCost + sum_extras/qty`. Convertir a primary con `exchange_rate_snapshot`. Insertar `stock_movement` kind='purchase'. Actualizar `product_variant_avg_cost` con weighted average (stock_previo × avg_previo + qty_nuevo × landed_unit_cost) / (stock_previo + qty_nuevo).
- [ ] **Cancelación PO** — antes de recibir: solo cambia status. Después de recibir: requiere "purchase_cancel" movement que revierte stock.
- [ ] **Devolución parcial PO** — UI permite seleccionar líneas + qty a devolver al proveedor; inserta `stock_movement` kind='purchase_return' con `original_movement_id` apuntando al `purchase` original.
- [ ] **Vista `/admin/inventario`** — audit log de movimientos con filtros por variante/kind/fecha; valor de stock al avg_cost.

### Cancelación / devolución de venta (M7 — admin)

- [ ] **`/admin/pedidos/[id]`** botones "Cancelar venta completa" y "Registrar devolución parcial" (selector de líneas + qty).
- [ ] **Lógica de impacto en caja** — si `cash_session_id` de la order original == sesión activa del cashier que está procesando: descontar de caja vía `cash_movement` kind='sale_return_out'/'sale_cancel_out'. Sino: ajuste contable, no toca caja, queda flagged.
- [ ] **`order.status`** se setea a 'cancelled' (full) o se mantiene 'confirmed' con `order_line.returned_quantity > 0` (partial). `stock_movement` kind='sale_return' o 'sale_cancel' linkeado vía `original_movement_id`.

### Email mínimo (M7 — Resend)

- [ ] **Resend integrado** — solo para invitaciones a equipo + reset password. Templates en `apps/web/lib/email/`.
- [ ] **Invitaciones por email** — schema `tenant_invitation` (tenantId, email, role, token unique, expiresAt, acceptedAt, invitedBy). Server action `inviteByEmail`. Página `/accept-invite?token=xxx` que pide register/login y crea membership.
- [ ] **Edit role de un miembro existente.**

### Reportes mínimos (M7)

- [ ] **`/admin/reportes`** con tabs (Recharts):
  - Ventas: line/bar por día/semana/mes, KPIs (ventas brutas, netas, ticket promedio, n° tickets), filtros por canal/método/moneda
  - Productos: top 20 por unidades + revenue + margen; stock bajo (`stock < 5`)
  - Inventario: valor total al avg_cost, movimientos del período
  - Caja: cierres del período, diferencias por sesión, ranking cashiers
  - Compras: gastos por proveedor, costos extras prorrateados

### Audit log básico

- [ ] Tabla `audit_log` (tenantId, userId, action, resourceType, resourceId, metadataJson, createdAt). Loggear cambios sensibles: delete, role change, payment update, cancel order, override admin.

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

## 🪲 Bugs conocidos

- [x] **Hydration warning en root layout** — provenía de extensiones Chrome que inyectan atributos al `<html>`/`<body>` antes de hidratar. Fix: `suppressHydrationWarning` en `<html>` y `<body>` de `app/layout.tsx`.

---

## ✅ Completados (changelog informal)

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
