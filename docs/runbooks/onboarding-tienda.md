# Runbook — Onboarding de nueva tienda

## Pre-requisitos

- Subdominio elegido y disponible (`<slug>.frc-e-commerce.com`).
- Datos básicos: nombre, slogan, logo (PNG/SVG ≤2MB), 3 colores hex.
- Moneda base de la tienda (PYG / USD / BRL / EUR).
- Datos bancarios para `payment-transferencia`.
- Lista de productos (CSV con columnas: SKU, nombre, descripción, categoría, precio, stock, imágenes).

## Pasos

### 1. Crear Channel desde admin

```
Admin UI → Settings → Channels → Create
- Code: <slug>
- Token: <generado>
- Default currency: <moneda>
- Default language: es
```

### 2. Configurar tenant-management

Custom fields del Channel:
- `subdomain`: `<slug>`
- `slogan`, `primaryColor`, `secondaryColor`, `accentColor`
- Subir logo a Asset → set `logoAssetId`

### 3. DNS

Cloudflare ya tiene wildcard `*.frc-e-commerce.com`. No requiere acción adicional.

### 4. Cargar tasas de cambio

Si la moneda base no es PYG, cargar al menos PYG↔base, USD↔base.

### 5. Crear admin user para el tenant

```
Admin UI → Settings → Administrators → Create
- Permissions: limit a Channel <slug>
```

### 6. Importar productos

Opción A: CSV via Vendure import tool.
Opción B: GraphQL mutation `createProduct` masivo (script `scripts/import-csv.ts`).

### 7. Configurar payment methods del Channel

- `payment-transferencia` (con datos bancarios).
- `payment-contraentrega` (si aplica).
- `payment-stripe` o `payment-bancard` (si tiene cuenta).

### 8. Configurar shipping methods

- `Envío propio` (zonas + tarifas).
- `Retiro en tienda` (gratis).

### 9. Smoke test

- Visitar `https://<slug>.frc-e-commerce.com`.
- Login admin con cuenta del tenant.
- Crear order de prueba (admin) → completar checkout.
- Verificar email de confirmación.

### 10. Handover

- Enviar credenciales admin al tenant (canal seguro).
- Compartir manual de uso del admin.
