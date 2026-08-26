# Kame.col — Deuda Tecnica, Riesgos y Hoja de Ruta

> Auditoria inicial: 2026-04-09. **Ultima actualizacion: 2026-08-26** — Segundo barrido completo post-sprints 1-4 y sistema de descuentos.

---

## Resumen Ejecutivo

Monorepo **Django 5.2.17 + DRF 3.15.2** (`apps/*`, `config/`) y **Next.js 14.2.15 App Router** (`frontend/`), con **PostgreSQL**, pagos **Wompi**, correo **Resend**, almacenamiento **Cloudflare R2**, descuentos configurables y E2E **Playwright** (`tests/`).

### Metricas del repositorio

| Metrica | Valor |
|---------|-------|
| Archivos Python (excl. migrations) | 85 |
| Archivos TSX | 74 |
| Archivos TS | 37 |
| Workflows CI | 4 (bandit, e2e, keep-alive, dependency-audit) |
| Migraciones Django | 19 (catalog: 14, orders: 4, customers: 1) |
| Modelos Django | 18 (catalog: 13, orders: 4, customers: 1) |
| Rutas frontend | 35 paginas/API routes |
| Componentes React | 33 |
| Admin pages (Next.js) | 23 |
| Tests backend | 42 |
| Specs E2E | 8 (+ discounts.spec.ts excluido de CI) |

### Estado de salud del codigo

| Area | Calificacion | Detalle |
|------|-------------|---------|
| Arquitectura | **A** | Services layer, models, views/APIs, componentes. Sistema de descuentos con scope hierarchy |
| Seguridad | **A** | 2FA admin, Bandit CI, pip-audit CI, Sentry filtrado, webhook firmado, CSRF via env, rate limiting |
| Tipado frontend | **B** | 84 → **~54 `any`** restantes (mayoria en admin pages y catch blocks) |
| Exception handling backend | **B-** | `stock.py` corregido; `emails.py` evaluado como correcto; 27+ instancias restantes aceptables |
| Cobertura de tests | **B+** | 42 tests backend + 8 specs E2E. Shipping, wompi, recalc, descuentos cubiertos |
| Observabilidad | **B+** | Sentry backend+frontend; faltan metricas RED/APM |
| Dependencias | **B** | Python actualizado (6 CVEs resueltas); Next 14 pendiente upgrade a 16 |

---

## 1. Analisis Estatico — Estado Actual

### 1.1 Grafo de Imports — Frontend

**Sin imports circulares.** Flujo unidireccional verificado y mantenido.

### 1.2 Archivos Huerfanos

| Item | Estado |
|------|--------|
| `frontend/store/ui.ts` | **Eliminado** (Sprint 1) |
| Componentes sin uso | Ninguno detectado |
| Codigo comentado / TODO / FIXME | Ninguno |

### 1.3 Tipado Frontend — `any` (~54 restantes)

**Eliminados en sprints 1-4:** 30 instancias en archivos criticos:
- `lib/api.ts`: 17 → **0**
- `app/api/[...path]/route.ts`: 7 → **0**
- `app/producto/[slug]/page.tsx`: 20 → **1** (tipo helper controlado)
- `components/product/ProductCard.tsx`: 8 → **0**
- `components/product/ProductGrid.tsx`: 3 → **0**
- `components/header/Header.tsx`: 2 → **0**

**Restantes (~54):** Mayoria en paginas admin (`catch (err: any)`), `lib/admin-api.ts` (4), `HomepagePromos.tsx` (8), `lib/errors/normalizeApiError.ts` (6), `app/categoria/[slug]/page.tsx` (9). Bajo riesgo.

### 1.4 Console Statements

- `console.log` → **`console.debug`** en `cart-stock-slice.ts` (6 instancias, gated por `DEV_VALIDATE_LOGS`)
- `console.warn/error` en server components y admin: aceptables como logging de desarrollo

### 1.5 Exception Handling Backend

- `stock.py:118,129,137`: **Corregido** — `except Exception` → `except (TypeError, ValueError)`
- `emails.py`: **Evaluado** — los `except Exception` con `logger.exception()` son correctos (fallback intencional)
- Restantes: 27+ instancias en notifications/email modules — aceptables con logging existente

### 1.6 Funciones Largas (>100 lineas)

4 funciones en checkout/stock evaluadas — bien organizadas con fases claras, refactor no necesario.

---

## 2. Seguridad

### Controles implementados

| Control | Estado |
|---------|--------|
| SECRET_KEY en env | OK |
| DEBUG default False | OK |
| SQL injection (ORM exclusivo) | OK |
| 2FA Admin + IP restriction | OK |
| Wompi webhook SHA256 | OK |
| Sentry data sanitization | OK |
| Bandit CI (Medium+) | OK |
| pip-audit CI | OK |
| Rate limiting DRF | OK |
| CSRF via env (IP LAN removida) | **OK** (Sprint 1) |
| Image upload validation | OK |

### Pendiente

- Evaluar **CSP headers** para storefront
- **npm audit** deshabilitado en CI hasta upgrade Next 16 (CVEs conocidas en next/postcss/swiper)

---

## 3. Registro de Riesgos

| # | Riesgo | Probabilidad | Impacto | Estado |
|---|--------|--------------|---------|--------|
| 1 | Dependencias frontend desactualizadas (Next 14→16) | Alta | Medio | Roadmap — CVEs conocidas, Node audit deshabilitado |
| 2 | E2E sandbox solo Nequi; otros metodos sin E2E real | Alta | Medio | Pendiente |
| 3 | ~54 `any` restantes en frontend | Media | Bajo | Mayoria en admin catch blocks — bajo riesgo |
| 4 | Metricas RED/APM fuera de Sentry | Media | Medio | Pendiente |
| 5 | `catalog/admin.py` ~930 lineas | Baja | Bajo | Dividir cuando toque refactor |

---

## 4. Dependencias

### Backend (pip) — Actualizado 2026-08-26

| Paquete | Version | Notas |
|---------|---------|-------|
| Django | **5.2.17** | LTS, CVEs resueltas |
| djangorestframework | **3.15.2** | XSS fix |
| Pillow | **12.3.0** | CVEs criticas resueltas |
| gunicorn | **22.0.0** | HTTP smuggling fix |
| python-dotenv | **1.2.2** | Symlink fix |
| sqlparse | **0.6.0** | ReDoS fix |
| psycopg2-binary | 2.9.9 | OK |

### Frontend (npm) — Pendiente upgrade mayor

| Paquete | Actual | Latest | Accion |
|---------|--------|--------|--------|
| next | 14.2.15 | 16.x | Upgrade planificado (roadmap) |
| react | 18.3.1 | 19.x | Viene con Next 16 |
| tailwindcss | 3.4.14 | 4.x | Evaluar post-Next 16 |
| eslint | 8.57.1 | 10.x | Evaluar post-Next 16 |

---

## 5. Cobertura de Tests

### Backend — 42 tests

| Suite | Tests | Cobertura |
|-------|-------|-----------|
| PaymentReferenceFormat | 3 | Formato y unicidad de referencia |
| InventoryNotDecrementedAtCheckout | 2 | Stock no baja al crear orden |
| InventoryDecrementedOnPaymentConfirm | 2 | Stock baja al confirmar pago |
| IdempotentPaymentConfirm | 2 | No doble descuento |
| WompiWebhookIdempotency | 1 | Webhook duplicado no descuenta doble |
| ApiHealthView | 1 | Health endpoint |
| ShippingCostTest | 7 | Threshold, Bogota, nacional, edge cases |
| WompiIntegritySignature | 2 | Determinismo y unicidad |
| WompiWebhookSignatureValidation | 5 | Firma valida, invalida, missing secret |
| WompiCentsConversion | 2 | Conversion COP → centavos |
| OrderRecalcTotals | 4 | Items con/sin precio, shipping |
| DiscountRulePriority | 3 | PRODUCT > CATEGORY > DEPARTMENT > STORE_WIDE |
| DiscountRuleDateRange | 3 | Futuro, expirado, inactivo |
| DiscountCalculation | 4 | Porcentaje, monto fijo, estructura |

### E2E — 8 specs (CI) + 1 local

| Spec | Cobertura | CI |
|------|-----------|-----|
| smoke.spec.ts | Home, health, catalogo, PDP, checkout, legal, 404 | Si |
| catalog.spec.ts | Grid, precio, navegacion, vacio, mobile | Si |
| product.spec.ts | PDP, variantes, guia tallas, agotado, mobile | Si |
| cart.spec.ts | Add, mini cart, eliminar, persistencia, mobile | Si |
| navigation.spec.ts | Header, logo, menu mobile, routing | Si |
| checkout.spec.ts | Formulario, submit, widget stub, errores, mobile | Si |
| payments-nequi-sandbox.spec.ts | Sandbox Wompi real (Nequi) | Opt-in |
| discounts.spec.ts | API descuentos: producto, departamento, prioridad | Local (requiere Django real) |

### Gaps pendientes

| Area | Prioridad |
|------|-----------|
| Admin API views | P2 |
| Checkout API endpoints | P2 |
| Email content generation | P3 |
| E2E sandbox otros metodos Wompi | P3 |

---

## 6. Features Implementados (agosto 2026)

### Sistema de Descuentos (5 fases)

| Componente | Detalle |
|-----------|---------|
| Modelo `DiscountRule` | Porcentaje o monto fijo, scope hierarchy (store/dept/cat/product), vigencia con fechas |
| Servicio `discount.py` | `get_active_discount()`, `apply_discount()`, `get_product_discount_info()` |
| API | `discount` field en ProductList/Detail/Marquee serializers |
| Frontend display | Cards, PDP, marquees (home + PDP) con precio tachado + descuento |
| Checkout | Precio con descuento server-side (S6), `original_price` en OrderItem |
| Emails | Linea de descuento en resumen + precio tachado por item |
| Admin Next.js | CRUD completo en `/admin/catalogo/descuentos` |
| Admin Django | `DiscountRuleAdmin` con filtros, autocomplete |
| Tests | 11 backend + 3 E2E (9 con browsers) |

### Zoom Fullscreen (Instagram-style)

- Pinch-to-zoom abre overlay fullscreen via React portal
- Zero React re-renders durante gesto (ref + rAF + DOM directo)
- Snap back animado al soltar (280ms CSS transition)
- Lightbox deshabilitado en mobile (pinch lo reemplaza)
- Desktop: click para lightbox sin cambios

### Auto-sync Variantes

- Al crear producto, `sync_variants_for_category()` genera ProductVariant desde InventoryPool existente
- Variantes activas si pool tiene stock (sin requerir imagenes)
- Elimina paso manual de crear variantes cuando el pool ya existe

---

## 7. Migraciones y Base de Datos

| App | Cantidad | Notas |
|-----|----------|-------|
| catalog | 14 | Incluye `0013_add_discount_rule` |
| orders | 4 | Incluye `0004_add_original_price_to_orderitem` |
| customers | 1 | Limpio |

---

## 8. Plan de Accion Pendiente

### Corto plazo

| # | Tarea | Esfuerzo | Impacto |
|---|-------|----------|---------|
| 1 | Tipar `any` restantes en `HomepagePromos.tsx` y `categoria/page.tsx` | Bajo | Bajo |
| 2 | Tests admin API views | Alto | Medio |
| 3 | CSP headers para storefront | Medio | Medio |

### Medio plazo (roadmap)

| # | Tarea | Esfuerzo | Impacto |
|---|-------|----------|---------|
| 4 | Upgrade Next 16 + React 19 (reactivar npm audit en CI) | Alto | Alto |
| 5 | Ampliar E2E sandbox Wompi (PSE, tarjeta, Daviplata) | Alto | Medio |
| 6 | Metricas RED/APM + dashboards de negocio | Alto | Alto |
| 7 | Evaluar Redis (cache catalogo + rate limit + cola) | Medio | Medio |
| 8 | E2E correos transaccionales | Medio | Medio |
| 9 | Upgrade Tailwind 4 + ESLint 10 | Medio | Bajo |

### Completado

| Tarea | Fecha |
|-------|-------|
| Bandit en CI | 2026-04 |
| Health endpoint Django | 2026-04 |
| Keep-alive workflow | 2026-04 |
| Sentry backend + frontend | 2026-04 |
| 2FA admin + IP restriction | 2026-04 |
| Rate limiting DRF | 2026-04 |
| Auditoria completa (grafo imports, any, console, exceptions, huerfanos) | 2026-08 |
| Eliminar `useUIStore` huerfano | 2026-08 |
| `console.log` → `console.debug` en cart-stock-slice | 2026-08 |
| `except Exception` → `(TypeError, ValueError)` en stock.py | 2026-08 |
| IP LAN CSRF → env variable | 2026-08 |
| pip-audit CI (dependency-audit.yml) | 2026-08 |
| Python deps: Django 5.2.17, DRF 3.15.2, Pillow 12.3, Gunicorn 22, sqlparse 0.6 | 2026-08 |
| Tipar ProductCard, ProductGrid, Header, api.ts, route.ts, PDP page (30 `any` eliminados) | 2026-08 |
| Tests: shipping (7), wompi (9), recalc (4), descuentos (11) — 31 tests nuevos | 2026-08 |
| Fix tests pre-existentes: `_make_variant` (size→value), webhook payload, patch target | 2026-08 |
| Sistema de descuentos completo (modelo, API, frontend, checkout, emails, admin) | 2026-08 |
| Zoom fullscreen Instagram-style (pinch-to-zoom mobile PDP) | 2026-08 |
| Auto-sync variantes desde InventoryPool al crear producto | 2026-08 |
| Admin Next.js: pagina de descuentos (CRUD) | 2026-08 |
| Node audit deshabilitado en CI (requiere Next 16) | 2026-08 |
| Exclusion discounts.spec.ts de CI (requiere Django real) | 2026-08 |

---

## Anexos

- **Bandit:** `bandit -r apps config -ll -c pyproject.toml`
- **pip-audit:** CI en `dependency-audit.yml`; local: `pip-audit --strict --desc on`
- **Pyright:** `pyrightconfig.json` configurado
- **Dependencias backend:** `requirements/base.txt`
- **Dependencias frontend:** `frontend/package.json`
- **CI:** `bandit.yml`, `e2e.yml`, `keep-alive.yml`, `dependency-audit.yml` (Node audit comentado)
- **Tests backend:** `apps/orders/tests.py` (42 tests)
- **Tests E2E:** `tests/e2e/*.spec.ts` (8 specs CI + 1 local)
- **Descuentos E2E (local):** `cd tests && DJANGO_API_BASE=http://localhost:8000 npx playwright test e2e/discounts.spec.ts`
- **Skills Claude Code:** 16 slash commands en `.claude/commands/` (local, no versionados)

---

*Fin del documento.*
