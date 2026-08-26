# Plan de Upgrade: Next.js 14.2.15 → 16

> Creado: 2026-08-26. Para ejecutar en la proxima sesion de trabajo.

---

## Estrategia: Upgrade en 2 etapas

```
Next.js 14.2.15 → 15.x (etapa 1) → 16.x (etapa 2)
```

Saltar directo a 16 es posible pero riesgoso para produccion con checkout/pagos. Dos etapas permite validar cada capa de breaking changes por separado.

---

## Etapa 1: Next.js 14 → 15

### 1.1 Upgrade de dependencias

```bash
npm install next@15 react@19 react-dom@19
npm install -D @types/react@latest @types/react-dom@latest eslint-config-next@15
npm install @sentry/nextjs@latest
```

### 1.2 Codemod automatico

```bash
npx @next/codemod@canary upgrade latest
npx @next/codemod@canary next-async-request-api .
```

El codemod migra automaticamente `params` y `headers()` a async. Revisar resultados manualmente.

### 1.3 Breaking change: `params` y `searchParams` son `Promise`

**Afecta:** Todas las pages con rutas dinamicas.

**Ya migrados (no requieren cambio):**
- `app/producto/[slug]/page.tsx` — ya usa `Promise<{ slug: string }>`
- `app/categoria/[slug]/page.tsx` — ya usa `Promise<{ slug: string }>`

**Requieren migracion (admin pages — "use client"):**

| Archivo | Cambio |
|---------|--------|
| `app/admin/ordenes/[reference]/page.tsx` | `params: { reference }` → `use(params)` |
| `app/admin/catalogo/productos/[product_id]/editar/page.tsx` | `params: { product_id }` → `use(params)` |
| `app/admin/inventario/[pool_id]/historial/page.tsx` | `params: { pool_id }` → `use(params)` |
| `app/admin/clientes/[customer_id]/page.tsx` | `params: { customer_id }` → `use(params)` |

**Patron para client components:**
```typescript
"use client";
import { use } from "react";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // resto del componente igual
}
```

### 1.4 Breaking change: `headers()` y `cookies()` son async

**Afecta:** `app/layout.tsx` si usa `headers()` sincronamente.

```typescript
// Antes (v14)
const pathname = headers().get("x-pathname") ?? "";

// Despues (v15+)
const headersList = await headers();
const pathname = headersList.get("x-pathname") ?? "";
```

### 1.5 Breaking change: Fetch ya no cachea por defecto

**Afecta:** Todas las llamadas `fetch()` en server components y `lib/api.ts`.

En v14: `fetch()` cachea por defecto.
En v15+: `fetch()` NO cachea (equivale a `cache: 'no-store'`).

**Solucion:** Las funciones en `lib/api.ts` ya usan `next: { revalidate: 300 }` explicitamente — esto sigue funcionando. Verificar que no haya fetches sin opcion de cache.

### 1.6 Breaking change: Route handlers GET no cachean

**Afecta:** `app/api/[...path]/route.ts` — es un proxy, no debe cachear. Sin cambio necesario.

### 1.7 Validacion etapa 1

```bash
npm run build    # Debe compilar sin errores
npm run dev      # Verificar en browser

# Tests
cd tests && npx playwright test   # E2E
python manage.py test apps.orders  # Backend (no afectado pero validar)
```

**Checklist manual:**
- [ ] Homepage carga (banners, promos, marquee, story)
- [ ] Catalogo muestra productos con precios/descuentos
- [ ] PDP carga con variantes, zoom, gallery
- [ ] Add to cart funciona
- [ ] Checkout completo (formulario + Wompi widget)
- [ ] Admin login con 2FA
- [ ] Admin: ordenes, productos, inventario, descuentos
- [ ] Sentry captura errores
- [ ] Email de confirmacion llega correctamente

---

## Etapa 2: Next.js 15 → 16

### 2.1 Upgrade de dependencias

```bash
npm install next@16
npm install -D eslint-config-next@16
```

### 2.2 Renombrar middleware → proxy

```bash
mv frontend/middleware.ts frontend/proxy.ts
```

Dentro del archivo:
```typescript
// Antes
export function middleware(request: NextRequest) { ... }
export const config = { matcher: [...] };

// Despues
export function proxy(request: NextRequest) { ... }
export const config = { matcher: [...] };
```

### 2.3 Actualizar next.config.mjs

**Imagen:**
```javascript
images: {
  // Remover 16 de imageSizes (eliminado en v16)
  imageSizes: [32, 48, 64, 96, 128, 256, 384],
  // Nuevo en v16:
  maximumRedirects: 3,
}
```

**Turbopack (ahora es default, mover config si existe):**
```javascript
// Antes (v15)
experimental: { turbopack: { ... } }

// Despues (v16)
turbopack: { ... }  // Top-level
```

### 2.4 Actualizar script de lint

```json
// package.json
// Antes
"lint": "next lint"

// Despues
"lint": "eslint . --ext .ts,.tsx,.js,.jsx"
```

### 2.5 Verificar compatibilidad Sentry

```bash
npm install @sentry/nextjs@latest
```

Verificar que `withSentryConfig` en `next.config.mjs` sigue funcionando. Sentry generalmente soporta nuevas versiones de Next rapidamente.

### 2.6 Validacion etapa 2

```bash
npm run build    # Ahora usa Turbopack por defecto
npm run dev

# Si Turbopack da problemas, fallback temporal:
npm run build -- --webpack
```

**Checklist:** Mismo que etapa 1 + verificar:
- [ ] Build con Turbopack exitoso
- [ ] Imagenes cargan correctamente (Next Image con nuevos defaults)
- [ ] Middleware/proxy funciona (admin auth, headers)
- [ ] No hay regresiones de CSS (Turbopack puede renderizar distinto)

---

## Dependencias de terceros — Compatibilidad

| Paquete | Version actual | Compatible con Next 16 | Accion |
|---------|---------------|----------------------|--------|
| @sentry/nextjs | ^10.48.0 | Actualizar a latest | `npm install @sentry/nextjs@latest` |
| framer-motion | ^12.34.3 | Si | Sin cambios |
| zustand | ^5.0.1 | Si | Sin cambios |
| swiper | ^11.1.14 | Si (pero tiene CVE) | Evaluar upgrade a 14.x |
| react-hook-form | ^7.53.2 | Si | Sin cambios |
| zod | ^3.23.8 | Si | Sin cambios |
| tailwindcss | ^3.4.14 | Si | Sin cambios (v4 es upgrade aparte) |
| react-zoom-pan-pinch | ^3.7.0 | Si (no se usa) | Eliminar del package.json |

---

## Archivos que requieren cambios (resumen)

### Obligatorios

| Archivo | Cambio | Etapa |
|---------|--------|-------|
| `package.json` | Upgrade deps | 1 + 2 |
| `app/admin/ordenes/[reference]/page.tsx` | params async | 1 |
| `app/admin/catalogo/productos/[product_id]/editar/page.tsx` | params async | 1 |
| `app/admin/inventario/[pool_id]/historial/page.tsx` | params async | 1 |
| `app/admin/clientes/[customer_id]/page.tsx` | params async | 1 |
| `app/layout.tsx` | headers() async (si aplica) | 1 |
| `middleware.ts` → `proxy.ts` | Renombrar + export | 2 |
| `next.config.mjs` | imageSizes, turbopack | 2 |

### Opcionales (mejoras)

| Archivo | Cambio | Etapa |
|---------|--------|-------|
| `package.json` | Eliminar `react-zoom-pan-pinch` (no se usa) | 1 |
| `package.json` | Actualizar script lint | 2 |
| `app/page.tsx` | Verificar fetch cache behavior | 1 |

---

## Riesgos y rollback

| Riesgo | Probabilidad | Mitigacion |
|--------|-------------|------------|
| Admin pages rompen por params async | Alta | Codemod + migracion manual |
| Fetch caching causa requests repetidos | Media | `revalidate` ya esta explicito en api.ts |
| Turbopack falla en build | Baja | Fallback: `next build --webpack` |
| Sentry incompatible | Baja | Upgrade @sentry/nextjs@latest |
| Swiper/Framer Motion rompen | Muy baja | No dependen de Next internals |
| CSS renderiza diferente en Turbopack | Baja | Visual QA en staging |

**Rollback:** Si algo falla critico, revertir el commit de upgrade y volver a `next@14.2.15`. El branch separado permite esto sin afectar main.

---

## Tiempo estimado

| Fase | Tiempo |
|------|--------|
| Etapa 1 (14→15): upgrade + migracion + testing | 2-3 horas |
| Etapa 2 (15→16): upgrade + proxy + config + testing | 1-2 horas |
| QA completo (checkout, admin, emails, mobile) | 1 hora |
| **Total** | **4-6 horas** |

---

## Comando para empezar

```bash
git checkout main && git pull origin main
git checkout -b feature/upgrade-next-16
cd frontend
npm install next@15 react@19 react-dom@19 @types/react@latest @types/react-dom@latest eslint-config-next@15 @sentry/nextjs@latest
npx @next/codemod@canary upgrade latest
```
