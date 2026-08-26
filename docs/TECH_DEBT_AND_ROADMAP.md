# Kame.col — Deuda Tecnica, Riesgos y Hoja de Ruta de Mejoras

> Auditoria inicial: 2026-04-09. **Actualizado: 2026-08-26** — Auditoria completa con grafo de imports, funciones huerfanas, inventario de `any` (84 frontend / 30+ `except Exception` backend), console statements (36), cobertura de tests, seguridad, complejidad ciclomatica y estado de dependencias.

---

## Resumen Ejecutivo

Monorepo **Django 5.2.11 + DRF 3.15** (`apps/*`, `config/`) y **Next.js 14.2.15 App Router** (`frontend/`), con **PostgreSQL**, pagos **Wompi**, correo **Resend**, almacenamiento **Cloudflare R2** y E2E **Playwright** (`tests/`). El producto esta maduro para MVP en produccion.

### Metricas del repositorio (agosto 2026)

| Metrica | Valor |
|---------|-------|
| Archivos Python | 105 |
| Archivos TSX | 73 |
| Archivos TS | 55 |
| Archivos JS | 9 |
| Workflows CI | 4 (.yml) |
| Migraciones Django | 16 (catalog: 12, orders: 3, customers: 1) |
| Modelos Django | 15+ |
| Rutas frontend | 25+ paginas/API routes |
| Componentes React | 32 |

### Estado de salud del codigo

| Area | Calificacion | Detalle |
|------|-------------|---------|
| Arquitectura | **A** | Separacion limpia: services layer, models, views/APIs, componentes |
| Seguridad | **A-** | 2FA admin, Bandit CI, Sentry filtrado, webhook firmado; IP LAN en CSRF pendiente |
| Tipado frontend | **C+** | 84 instancias de `any` en 20+ archivos |
| Exception handling backend | **C** | 30+ `except Exception` broad sin tipo especifico |
| Cobertura de tests | **B-** | Pagos/inventario cubiertos; admin, API endpoints, shipping sin tests |
| Observabilidad | **B+** | Sentry backend+frontend; faltan metricas RED/APM y dashboards de negocio |
| Dependencias | **B-** | Next 14 (latest 16), React 18 (latest 19), ESLint 8 (latest 10) |

---

## 1. Analisis Estatico de Codigo

### 1.1 Grafo de Imports — Frontend

**Resultado: Sin imports circulares.** Flujo de dependencias unidireccional limpio:

```
types/ (sin deps internas)
  └── lib/ (depende de types)
       └── hooks/ (depende de lib, types)
       └── store/ (depende de lib)
            └── components/ (depende de lib, types, hooks, store)
                 └── app/ pages (depende de todo lo anterior)
```

### 1.2 Archivos Huerfanos y Codigo Muerto

**Frontend:**

| Archivo | Estado | Accion |
|---------|--------|--------|
| `frontend/store/ui.ts` | `useUIStore` exportado pero **nunca importado** en todo el codebase | Eliminar o reutilizar |
| Componentes en `components/` | Todos los 32 componentes verificados como **en uso** | OK |
| Bloques de codigo comentado | **Ninguno** encontrado (3+ lineas consecutivas) | OK |
| TODO/FIXME/HACK | **Ninguno** encontrado | OK |

**Backend:**

| Archivo | Estado | Accion |
|---------|--------|--------|
| `apps/orders/services/customers.py` | `get_or_create_customer()` — verificar si sigue en uso activo | Auditar referencias |
| `apps/orders/services/product_variants.py` | Utilidad pequena, probablemente en uso | Verificar |
| `apps/catalog/services/inventory_pool_bulk.py` | Usado por admin bulk load | Verificar integracion |
| Bloques de codigo comentado | **Ninguno** encontrado | OK |
| `print()` statements | **Ninguno** — usa logging correctamente | OK |
| TODO/FIXME/HACK | **Ninguno** encontrado | OK |

### 1.3 Inventario completo de `any` — Frontend (84 instancias)

#### Critico (tipos de datos de dominio sin tipar)

| Archivo | Instancias | Contexto |
|---------|-----------|----------|
| `app/producto/[slug]/page.tsx` | **20** | `product: any`, normalizers, error catches |
| `lib/api.ts` | **17** | `apiFetch<any>`, payload, response normalization |
| `app/categoria/[slug]/page.tsx` | **9** | Casts `as any` en resultados de API |
| `components/product/ProductCard.tsx` | **8** | `product: any` prop, acceso con `(product as any)?.` |
| `components/product/ProductGrid.tsx` | **3** | `products: any[]` prop |
| `components/home/HomepagePromos.tsx` | **8** | `extractArray<T>(res: any)`, filter/sort callbacks |
| `lib/errors/normalizeApiError.ts` | **6** | Payload inspection (aceptable por naturaleza dinamica) |
| `components/header/Header.tsx` | **2** | `categories?: any[]`, `navDepartments?: any[]` |

#### Medio (API proxy y admin)

| Archivo | Instancias | Contexto |
|---------|-----------|----------|
| `app/api/[...path]/route.ts` | **7** | `context: any` en todos los handlers HTTP |
| `lib/admin-api.ts` | **4** | `payload: any`, `err: any` |
| `app/admin/*/page.tsx` (8 archivos) | **11** | `catch (err: any)` en paginas admin |

#### Bajo (errores en catch — patron comun)

| Archivo | Instancias |
|---------|-----------|
| `store/cart-stock-slice.ts` | 1 (`catch (error: any)`) |
| `app/admin/login/page.tsx` | 2 |
| `app/admin/recuperacion/page.tsx` | 1 |
| `components/home/HomepagePromosClient.tsx` | 1 |

**Recomendacion:** Crear tipos en `types/` para respuestas de API (`ProductResponse`, `CategoryResponse`, `NavigationResponse`) y reemplazar progresivamente. Los `catch (e: any)` pueden cambiarse a `catch (e: unknown)` con type guard.

### 1.4 Console Statements — Frontend (36 instancias)

| Tipo | Cantidad | Archivos principales |
|------|----------|---------------------|
| `console.log` | 8 | `store/cart-stock-slice.ts` (6 — validacion de stock en desarrollo) |
| `console.warn` | 20 | `lib/api.ts`, `app/page.tsx`, `components/header/HeaderServer.tsx` (4), `HomepagePromos.tsx` (2), `lib/django-api-proxy.ts` |
| `console.error` | 8 | `CheckoutClient.tsx`, admin pages (inventario, ordenes, productos, etc.) |

**Accion:** Los `console.log` de `cart-stock-slice.ts` deben ir detras de flag dev o eliminarse. Los `console.warn/error` en server components y admin son aceptables como logging de desarrollo, pero considerar migrarlos a un logger estructurado o Sentry.

### 1.5 Exception Handling — Backend (30+ instancias broad)

**Archivos con mas `except Exception` sin tipo especifico:**

| Archivo | Instancias | Lineas |
|---------|-----------|--------|
| `apps/notifications/email_product_media.py` | **12** | 32, 60, 65, 140, 148, 160, 166, 175, 188, 206 |
| `apps/orders/services/stock.py` | **9** | 118, 129, 137, 170, 177, 188, 216, 252, 327 |
| `apps/notifications/emails.py` | **5** | 126, 154, 207, 225, 265 |
| `apps/notifications/email_context.py` | **3** | 88, 157, 185 |
| `apps/orders/services/create_order_from_cart.py` | **1** | 404 (silent pass) |
| `apps/orders/services/cart.py` | **1** | 27 |
| `apps/catalog/models.py` | **1** | 468 (`warm_imagekit_derivatives`) |

**Patron correcto existente** (en `payments.py`):
```python
except Exception:
    logger.exception("Fallo enviando email de pago confirmado")
```

**Accion:** Reemplazar con tipos especificos (`ValueError`, `KeyError`, `IOError`, etc.) o al menos agregar `logger.exception()` con contexto.

### 1.6 Complejidad Ciclomatica — Funciones Largas

#### Critico (>100 lineas)

| Funcion | Archivo | Lineas | Riesgo |
|---------|---------|--------|--------|
| `create_order_from_checkout()` | `orders/services/create_order_from_cart.py:324-502` | **179** | Orquestacion checkout end-to-end |
| `_normalize_checkout_items()` | `orders/services/create_order_from_cart.py:168-321` | **154** | Maneja formatos list y dict |
| `validate_items_stock()` | `orders/services/stock.py:142-279` | **138** | Agregacion y validacion de pools |
| `confirm_order_payment()` | `orders/services/payments.py:45-189` | **145** | Ruta critica de pago |

**Recomendacion:** Extraer helpers: `_validate_aggregated_qty()`, `_build_pool_maps()`, `_normalize_list_items()` / `_normalize_dict_items()`.

#### Archivos >300 lineas

| Archivo | Lineas | Estado |
|---------|--------|--------|
| `catalog/models.py` | ~1250 | OK (patron Django, multiples modelos) |
| `catalog/serializers.py` | ~1050 | OK (multiples serializers REST) |
| `catalog/admin.py` | ~800 | Candidato a dividir en submodulos |
| `orders/services/create_order_from_cart.py` | ~503 | Aceptable (single responsibility) |

---

## 2. Auditoria de Seguridad

### 2.1 Estado Actual — Sin hallazgos criticos

| Control | Estado | Detalle |
|---------|--------|---------|
| SECRET_KEY produccion | **OK** | `os.environ["DJANGO_SECRET_KEY"]` obligatorio; fallback solo en DEBUG |
| DEBUG produccion | **OK** | Default `False`, controlado por `DJANGO_DEBUG` env |
| SQL injection | **OK** | ORM exclusivo, sin `raw()` ni `cursor.execute()` |
| eval/exec | **OK** | Ninguno en `*.py`/`*.ts`/`*.tsx` |
| XSS | **OK** | Validacion de URLs CTA (bloquea `javascript:`, IPs) |
| 2FA Admin | **OK** | Django OTP + TOTP obligatorio |
| Admin IP restriction | **OK** | Middleware `AdminIPRestrictionMiddleware` con `ADMIN_ALLOWED_IPS` |
| Wompi webhook | **OK** | SHA256 signature validation sin exposicion de secreto |
| Sentry filtering | **OK** | `before_send` sanitiza password, card_number, cvv, email, token |
| SSL/HTTPS | **OK** | `SECURE_SSL_REDIRECT`, cookies secure en produccion |
| Bandit CI | **OK** | `bandit.yml` en push/PR a main, `-ll` (Medium+) |
| Rate limiting DRF | **OK** | Anon 60/min, checkout 5/min, stock 30/min (produccion) |
| Image upload | **OK** | 5MB max, extensiones .jpg/.jpeg/.png/.webp, UUID path |

### 2.2 Prioridad Media

- **CSRF_TRUSTED_ORIGINS** incluye IP LAN fija (`192.168.20.128`) en `config/settings.py:61` — mover a variable de entorno exclusivamente.
- **Proxy API Next** (`frontend/app/api/[...path]/route.ts`): 7 handlers con `context: any` — auditar que no amplie superficie (SSRF, headers).
- **Re-import** `urlparse` en `settings.py:275` (ya importado en linea 16) — menor, limpieza.

### 2.3 Hardening Recomendado

- Evaluar **CSP headers** para storefront.
- **Dependency audit** periodico: `pip audit` + `npm audit` en CI.
- **Log rotation** para archivos de log Django si no se usa stdout exclusivo.

---

## 3. Registro de Riesgos (Actualizado agosto 2026)

| # | Riesgo | Probabilidad | Impacto | Mitigacion |
|---|--------|--------------|---------|------------|
| 1 | 84 instancias `any` en frontend ocultan errores de tipos en runtime | Alta | Medio | Crear tipos para respuestas API; reemplazar progresivamente por archivo |
| 2 | 30+ `except Exception` broad silencian errores en backend | Alta | Alto | Agregar tipos especificos o `logger.exception()` con contexto |
| 3 | Dependencias frontend desactualizadas (Next 14→16, React 18→19) | Alta | Medio | Hoja de ruta de upgrade + E2E completo antes de bump |
| 4 | E2E sandbox solo Nequi; otros metodos sin E2E real | Alta | Medio | Anadir specs sandbox por metodo (patron Nequi) |
| 5 | Test coverage gaps: admin, API endpoints, shipping, inventory services | Media | Alto | Tests unitarios prioritarios para shipping y stock |
| 6 | Funciones >100 lineas en checkout/stock (4 funciones criticas) | Media | Medio | Refactor con helpers — no cambia logica, solo legibilidad |
| 7 | Metricas RED/APM fuera de Sentry | Media | Medio | Health/version/metricas propias; alertas de negocio |
| 8 | `catalog/admin.py` ~800 lineas — dificil de mantener | Baja | Bajo | Dividir en submodulos cuando toque refactor |
| 9 | 36 console statements en frontend (8 console.log debug) | Baja | Bajo | Flag dev o eliminar; migrar warns a logger |

---

## 4. Evaluacion del Stack

### 4.1 Que esta funcionando bien

- **Django + DRF** con services layer limpios, ORM transaccional, migraciones y tests de dominio.
- **Next 14 App Router** con fetch SSR, proxy `/api` same-origin, Image optimization (AVIF/WebP).
- **PostgreSQL** con indices adecuados, `select_for_update()` para concurrencia en inventario.
- **Zustand** para estado ligero (cart, auth, UI) — sin boilerplate Redux.
- **React Hook Form + Zod** para validacion TypeScript-first en checkout y admin.
- **Cloudflare R2** para media con CDN y ImageKit derivatives (thumb/medium/large/email).
- **Sentry** en backend y frontend con source maps, `before_send` sanitizado.
- **Framer Motion** para animaciones fluidas en storefront.
- **2FA + IP restriction** en admin — seguridad enterprise-grade.

### 4.2 Que deberia cambiar

- Planificar **upgrade mayor de Next/React** con ventana de QA dedicada.
- Reducir `any` hacia tipos generados o inferidos desde contratos API (Zod schemas → types).
- Refinar exception handling backend hacia tipos especificos.
- Ampliar test coverage en areas sin tests (shipping, admin API, inventory services).

### 4.3 Dependencias — Estado actual vs Latest

#### Frontend (npm)

| Paquete | Actual | Latest | Salto |
|---------|--------|--------|-------|
| next | 14.2.15 | 16.x | Major x2 |
| react | 18.3.1 | 19.x | Major |
| eslint | 8.57.1 | 10.x | Major x2 |
| typescript | 5.6.3 | 5.x latest | Minor |
| tailwindcss | 3.4.14 | 4.x | Major |
| @sentry/nextjs | 10.48.0 | latest | Verificar |
| framer-motion | 12.34.3 | latest | Verificar |
| zustand | 5.0.1 | 5.x | OK |
| zod | 3.23.8 | 3.x | OK |

#### Backend (pip)

| Paquete | Actual | Latest | Salto |
|---------|--------|--------|-------|
| Django | 5.2.11 | 5.2.x | OK (LTS) |
| djangorestframework | 3.15.0 | 3.15.x | OK |
| Pillow | 11.0.0 | 11.x | OK |
| boto3 | 1.42.52 | latest | Verificar |
| sentry-sdk | >=2.0.0 | latest | Verificar |
| psycopg2-binary | 2.9.9 | 2.9.x | OK |
| gunicorn | 21.2.0 | latest | Verificar |

### 4.4 Redis — Puntos de integracion recomendados

- **Cache** de listados catalogo / navegacion (TTL corto).
- **Rate limiting** distribuido si se escala horizontalmente.
- **Cola** ligera (RQ/Celery) para emails y jobs de analytics.

---

## 5. Cobertura de Tests

### 5.1 Tests Backend — Existentes

| Archivo | Tests | Cobertura |
|---------|-------|-----------|
| `apps/orders/tests.py` (361 lineas) | PaymentReferenceFormat (3), InventoryNotDecrementedAtCheckout (2), InventoryDecrementedOnPaymentConfirm (2), IdempotentPaymentConfirm (2), WompiWebhookIdempotency (1), ApiHealthView (1) | **Pagos + inventario + idempotencia** |
| `apps/catalog/tests.py` | Existente | Catalogo basico |
| `apps/customers/tests.py` | Existente | Customer basico |
| `apps/notifications/tests/test_email_assets.py` | Existente | Assets de email |
| `apps/notifications/tests/test_email_product_media.py` | Existente | Media URLs |

### 5.2 Tests E2E — Existentes

| Spec | Cobertura |
|------|-----------|
| `smoke.spec.ts` | 200 en home, `/health`, catalogo, PDP, checkout, legal, 404 |
| `catalog.spec.ts` | Grid, precio, navegacion a PDP, estado vacio, mobile |
| `product.spec.ts` | PDP contenido, variantes, guia tallas, agotado, mobile |
| `cart.spec.ts` | Add to cart, mini cart, eliminar, persistencia, mobile |
| `navigation.spec.ts` | Header, logo, menu mobile, routing categoria |
| `checkout.spec.ts` | Carga, validacion, envio, submit + widget stub, errores, stock warning, mobile |
| `payments-nequi-sandbox.spec.ts` | Sandbox Wompi real (Nequi): aprobado y declinado |

### 5.3 Gaps de Cobertura — Priorizados

#### Prioridad 1 (antes del proximo release)

| Area sin tests | Archivo(s) | Impacto |
|----------------|-----------|---------|
| Shipping cost calculation | `apps/orders/services/shipping.py` | Alto — afecta total de orden |
| Wompi webhook signature validation directa | `apps/orders/services/wompi.py` | Alto — seguridad de pagos |
| Order total recalculation | `apps/orders/models.py::_recalc_totals_in_memory()` | Alto — integridad financiera |
| Admin actions (inventory adjustments) | `apps/catalog/admin.py` | Medio — operaciones manuales |

#### Prioridad 2

| Area sin tests | Archivo(s) |
|----------------|-----------|
| Admin API views completos | `apps/admin_api/views_*.py` (9 archivos) |
| Checkout API endpoints | `apps/orders/views_api.py` |
| Stock management service | `apps/catalog/services/inventory.py` |
| Email content generation | `apps/notifications/emails.py`, `email_context.py` |
| Form validation | `apps/catalog/forms.py` |
| Customer upsert | `apps/customers/services/customer_upsert.py` |

### 5.4 E2E Pagos — Estado por metodo

| Metodo | E2E? | Notas |
|--------|------|-------|
| Tarjeta (widget) | Parcial | CI con stub; sin spec sandbox real |
| Nequi | Parcial | Sandbox real opt-in (`payments-nequi-sandbox.spec.ts`) |
| Daviplata | No | Datos en `WOMPI_SANDBOX`; sin spec |
| PSE | No | Datos en fixture; sin spec |
| Bancolombia QR / Puntos | No | Datos en fixture; sin spec |
| Correo pago completado | No | — |
| Correo password reset | No | — |

---

## 6. Hoja de Ruta de Observabilidad

### 6.1 Estado actual

- **Sentry Django:** `DjangoIntegration`, `LoggingIntegration`, `before_send` filtra datos sensibles. Comando: `python manage.py verify_sentry`.
- **Sentry Next.js:** `@sentry/nextjs` con `sentry.runtime.config.ts`, tunel `/api/sentry-tunnel`.
- **Logging:** Handlers a file + console para orders, catalog, customers, notifications, django.
- **Health:** `GET /api/health/` (Django), `GET /health` (Next.js) — ambos implementados.
- **Keep-alive:** Workflow `keep-alive.yml` cada 5 minutos ping a kamecol.com.

### 6.2 Monitoreo faltante

- Metricas RED/USE para API y tiempo de respuesta Wompi/Resend.
- Dashboard de ordenes atascadas en `PENDING` > N minutos.
- `GET /api/version` — git sha, build time.
- `GET /api/metrics` — formato Prometheus basico (latencias, contadores checkout).
- Alertas de negocio: productos con vistas altas y baja conversion.
- Embudos visitas → add to cart → checkout → paid por canal.

### 6.3 Eventos a instrumentar

- `checkout_started`, `checkout_submitted`, `wompi_widget_opened`, `wompi_callback_received`, `order_paid`, `webhook_signature_failed`, `stock_validation_failed`.
- Tracking existente en storefront — alinear con esquema versionado (`event_version: 1`).

---

## 7. Migraciones y Base de Datos

### 7.1 Estado de migraciones

| App | Cantidad | Observacion |
|-----|----------|-------------|
| catalog | 12 | Incluye data migration `0003b_backfill_category_department` |
| orders | 3 | Limpio |
| customers | 1 | Limpio |

**Recomendacion:** Considerar squash de catalog 0001-0005 cuando supere 20 migraciones. Data migration `0003b` limpiar despues de confirmar que todos los datos estan poblados.

### 7.2 Indices de base de datos

- Categorical: `(department, slug)`, `(category, parent, slug)`
- Inventory: `(category, value, color)` unique
- Product: `(slug)` unique
- Order: `(reference)` unique
- Customer: `(document_type, cedula)` unique
- Analytics: `event`, `session_id`, `product_id`, `timestamp`

---

## 8. Plan de Accion Priorizado (Actualizado agosto 2026)

### Inmediato (antes del proximo release)

| # | Tarea | Archivo(s) | Esfuerzo | Impacto |
|---|-------|-----------|----------|---------|
| 1 | Refinar exception handling: tipos especificos + logging | `email_product_media.py`, `stock.py`, `emails.py`, `email_context.py` | Medio | Alto |
| 2 | Tests para shipping, webhook validation, order totals | `shipping.py`, `wompi.py`, `models.py` | Medio | Alto |
| 3 | Eliminar `useUIStore` huerfano | `frontend/store/ui.ts` | Bajo | Bajo |
| 4 | Quitar `console.log` de cart stock o flag dev | `frontend/store/cart-stock-slice.ts` | Bajo | Bajo |

### Corto plazo (proximo sprint)

| # | Tarea | Archivo(s) | Esfuerzo | Impacto |
|---|-------|-----------|----------|---------|
| 5 | Tipar respuestas API (`ProductResponse`, `CategoryResponse`) | `types/*.ts`, `lib/api.ts` | Medio | Alto |
| 6 | Tipar `ProductCard`/`ProductGrid` props | `components/product/ProductCard.tsx`, `ProductGrid.tsx` | Bajo | Medio |
| 7 | Tipar API proxy `context` (Next.js params) | `app/api/[...path]/route.ts` | Bajo | Medio |
| 8 | Tests admin API views | `apps/admin_api/views_*.py` | Alto | Medio |
| 9 | Mover IP LAN de CSRF a env exclusivo | `config/settings.py` | Bajo | Medio |

### Medio plazo (roadmap)

| # | Tarea | Esfuerzo | Impacto |
|---|-------|----------|---------|
| 10 | Upgrade Next 15/16 + React 19 | Alto | Alto |
| 11 | Ampliar E2E sandbox Wompi (PSE, tarjeta, Daviplata, QR) | Alto | Alto |
| 12 | Refactorizar funciones >100 lineas (checkout/stock) | Medio | Medio |
| 13 | Dividir `catalog/admin.py` en submodulos | Medio | Bajo |
| 14 | Evaluar Redis (cache catalogo + rate limit + cola) | Medio | Medio |
| 15 | Metricas RED/APM + dashboards de negocio | Alto | Alto |
| 16 | E2E correos transaccionales (Resend test API / buzón) | Medio | Medio |
| 17 | Upgrade Tailwind 4 + ESLint 10 | Medio | Bajo |

### Completado

| Tarea | Fecha |
|-------|-------|
| Bandit en CI (`bandit.yml`) | 2026-04 |
| Health endpoint Django (`GET /api/health/`) | 2026-04 |
| Keep-alive workflow (`keep-alive.yml`) | 2026-04 |
| Sentry backend + frontend | 2026-04 |
| 2FA admin + IP restriction | 2026-04 |
| Rate limiting DRF (produccion) | 2026-04 |
| Grafo de imports frontend (verificado sin circulares) | 2026-08 |
| Inventario completo de `any` y console statements | 2026-08 |
| Auditoria de exception handling backend | 2026-08 |
| Auditoria de funciones huerfanas y codigo muerto | 2026-08 |

---

## Anexos — Comandos y herramientas

- **Bandit:** `bandit -r apps config -ll -c pyproject.toml`
- **Pyright:** `pyrightconfig.json` configurado para `config.settings`
- **ESLint:** `@typescript-eslint/no-explicit-any: off` (desactivado — contribuye a los 84 `any`)
- **Dependencias backend:** `requirements/base.txt` (Django 5.2.11, DRF 3.15.0, etc.)
- **Dependencias frontend:** `frontend/package.json` (Next 14.2.15, React 18.3.1, etc.)
- **CI workflows:** `bandit.yml` (seguridad), `e2e.yml` (Playwright), `keep-alive.yml` (ping produccion)
- **Tests:** `tests/README.md` para detalle de E2E. `apps/*/tests.py` para backend.

---

*Fin del documento. Proxima auditoria programada: verificar progreso de items 1-4 en sprint actual.*
