# 🛍️ Plataforma SaaS E-commerce Multitienda (Base Vendure)

## 📌 Visión General

Desarrollo de una plataforma SaaS de e-commerce especializada en venta de:

- Ropas
- Calzados
- Accesorios

La plataforma permitirá que múltiples clientes (tiendas) operen de forma independiente dentro de un mismo sistema, cada uno con:

- Dominio o subdominio propio
- Gestión de productos, stock y ventas
- Personalización básica de su tienda

El objetivo es iniciar con una tienda propia y evolucionar a un modelo SaaS con planes mensuales para terceros.

---

## 🧱 Stack Tecnológico

### Backend
- **Vendure (Headless Commerce)**
- **Node.js + NestJS (interno de Vendure)**
- **GraphQL API (Admin + Shop API)**

### Base de Datos
- **PostgreSQL**
- Arquitectura multi-tenant por `channel` (Vendure)

### Frontend (Storefront)
- **Next.js (Storefront Starter oficial)**
- **Tailwind CSS**
- Arquitectura desacoplada (Headless)

### Panel Administrativo
- **Admin UI de Vendure (base inicial)**
- Futuro: Panel custom propio (Angular o similar)

### Infraestructura
- Hosting backend (Docker recomendado)
- Base de datos PostgreSQL
- Storage de archivos (S3 / R2 / disco persistente)
- CDN opcional

---

## 🧩 Características Funcionales (MVP)

### 🏪 Multitienda (Multi-tenant)
- Múltiples clientes en una misma base de datos
- Separación lógica por tienda (`channel`)
- Soporte para:
  - Dominios personalizados
  - Subdominios

---

### 🛒 E-commerce

#### Productos
- Productos con variantes (talle, color, etc.)
- Imágenes
- Categorías
- Atributos personalizados

#### Precios
- Soporte multi-moneda
- Precios por:
  - Canal (tienda)
  - Tipo (futuro: mayorista/minorista)
- Promociones y descuentos

#### Stock
- Control por producto/variante
- Preparado para:
  - Multi-depósito (futuro)
  - Reservas por pedido

---

### 💳 Pagos

#### Inicial
- Stripe (rápido de implementar)
- Transferencia (manual / QR)
- Pago contra entrega
- Pago directo al vendedor

#### Futuro
- Bancard
- UPay

---

### 🚚 Envíos

- Configuración por tienda
- Métodos:
  - Envío propio
  - Retiro en tienda
  - Coordinación directa con vendedor

---

### 🧾 Gestión Operativa

#### Incluido en MVP
- Gestión de productos
- Gestión de pedidos
- Gestión de clientes
- Control básico de ventas

#### Futuro (plugins propios)
- Compras (proveedores)
- Caja
- Finanzas
- Cuentas corrientes
- Reportes avanzados

---

### 🖥️ POS (Punto de Venta)

#### MVP
- POS online (desde navegador)
- Venta manual desde admin

#### Futuro
- POS completo
- Modo offline
- Integración con hardware (lector, impresora)

---

### 🎨 Personalización por Tienda

Cada tienda podrá configurar:

- Logo
- Nombre
- Slogan
- Colores básicos
- Banners (futuro)

El layout general será compartido entre todas las tiendas.

---

### 🌐 Storefront

Basado en:

- **Next.js Storefront Starter**
- UI moderna
- SSR / SEO ready

Incluye:
- Listado de productos
- Página de producto
- Carrito
- Checkout
- Cuenta de usuario

---

## 🔌 Arquitectura de Extensión (Clave del Proyecto)

Vendure permite extender funcionalidades mediante:

### Plugins

Se crearán plugins propios para:

```txt
plugins/
  tenant-management/
  bancard-payment/
  upay-payment/
  compras/
  caja/
  finanzas/
  pos-online/
  sifen/
  theme-manager/
