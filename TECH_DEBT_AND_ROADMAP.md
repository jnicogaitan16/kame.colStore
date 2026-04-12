# Kame.col — Deuda Técnica, Riesgos y Hoja de Ruta de Mejoras

> Auditoría inicial: 2026-04-09. Actualizado: 2026-04-11 — **E2E Wompi sandbox:** solo **`payments-nequi-sandbox.spec.ts`** + `payments-sandbox-helpers.ts` (flujo Nequi aprobado/declinado contra widget y backend reales); no hay specs sandbox para tarjeta/PSE/Daviplata/QR/Puntos (datos de prueba siguen en `wompi-sandbox.ts`). CI estándar: mock + stub en `checkout.spec.ts`. Job opcional en `e2e.yml` (push a `main`, secret `E2E_SANDBOX_BASE_URL`): ver §6. **Django:** `GET /api/health/` mínimo para probes/túneles. **Pyright:** `pyrightconfig.json`. El **README raíz** no documenta el detalle de pagos E2E; este archivo y `tests/README.md` sí.

## Resumen Ejecutivo

Monorepo **Django 5.2 + DRF** (`apps/*`, `config/`) y **Next.js 14 App Router** (`frontend/`), con **PostgreSQL**, pagos **Wompi**, correo **Resend** y E2E **Playwright** (`tests/`). El producto está maduro para MVP. **Sentry** ya cubre errores en backend y storefront; **CI en GitHub Actions** incluye **E2E** (build Next + Playwright, `e2e.yml`) y **Bandit** solo sobre Python (`apps/`, `config/`). La **documentación de uso** vive en **`README.md`** (alineado a lo esencial; detalle de deuda y plan sigue en este documento).

Siguen como huecos relevantes **métricas RED/APM fuera de Sentry**, **E2E sandbox para el resto de métodos Wompi** (tarjeta, PSE, Daviplata, QR, Puntos: hoy solo **Nequi** en sandbox mide integración real; el checkout en CI sigue con **stub**), **correos transaccionales en E2E**, y **reducción de `any` / deuda de tipos** en el frontend. Las dependencias de frontend tienen **saltos mayores** disponibles (Next 16, React 19, ESLint 10) que conviene planificar como proyecto aparte.

---

## 1. Análisis Estático de Código

### 1.1 Archivos Huérfanos y Código Muerto

- No se ejecutó un grafo de imports completo (trabajo costoso). **Recomendación:** `vulture` / cobertura + revisión manual de `apps/*/management/commands/` y scripts sueltos.
- **Inventario:** 97 archivos `*.py`, 113 `*.ts`/`*.tsx` (excl. `node_modules` / `.next` / `__pycache__`).

### 1.2 Duplicación de Código

- Patrones repetidos en páginas **admin** de catálogo (`catch (err: any)`, flujos fetch similares).
- `extractArray` / normalización de promos en **homepage** (`page.tsx` vs `HomepagePromos.tsx`) — candidato a util compartido.

### 1.3 Tipado

- **Frontend:** Uso extendido de `any` en `ProductGrid`, rutas `app/api/[...path]/route.ts` (`context: any`), varias páginas admin y PDP server (`product: any`).
- **Backend:** Tests y servicios usan buen estilo en zonas críticas (`from __future__ import annotations` en `orders/tests.py`, etc.); revisar vistas voluminosas (`apps/catalog/admin.py` ~800+ líneas) para división y tipos donde aplique.

### 1.4 Puntos de Alta Complejidad

- `apps/catalog/admin.py`, `ProductDetailClient.tsx`, `views_api.py` (órdenes/checkout/Wompi): alta densidad de reglas de negocio; priorizar tests unitarios/API y diagramas de secuencia para pagos e inventario.

---

## 2. Auditoría de Seguridad

### 2.1 Crítico (corregir antes del próximo deploy)

- **DEBUG / SECRET_KEY:** `config/settings.py` usa `DEBUG` desde env; en `DEBUG=True` hay fallback `SECRET_KEY` por defecto — aceptable solo en local; asegurar que producción siempre tenga `DJANGO_DEBUG` falso y `DJANGO_SECRET_KEY` fuerte.

**Resuelto (verificado en código):** en `apps/orders/services/wompi.py`, `validate_webhook_signature` ya no registra `parts` ni datos que expongan `WOMPI_EVENTS_SECRET`; solo logs seguros (`debug` con `reference`, `warning` con `transaction_id` si firma inválida).

### 2.2 Prioridad Media

- **CSRF_TRUSTED_ORIGINS** incluye IP LAN fija (`192.168.20.128`) — revisar en despliegues; preferir solo env.
- **Proxy API Next** (`frontend/app/api/[...path]/route.ts`): revisar que no amplíe superficie (métodos, headers, SSRF) — auditoría manual recomendada.
- **Bandit:** CI en `.github/workflows/bandit.yml` (PR y push a `main`); config en `pyproject.toml` (skip **B104** por falsos positivos Django; `# nosec B310` en `urlopen` hacia API HTTPS de Resend). Local igual que CI: `bandit -r apps config -ll -c pyproject.toml`. Sin `-ll` suelen listarse ~16 avisos **Low** (`B110`/`B112`); ver **`README.md`** (sección Bandit).

### 2.3 Baja Prioridad / Hardening

- Sin `eval`/`exec` en `*.py`/`*.ts`/`*.tsx` (búsqueda puntual).
- Sin `raw(` / `cursor.execute(` en Python (búsqueda puntual).
- **Wompi:** Firma de integridad (widget) y validación de webhook por SHA256 alineadas con documentación; logging de firma sin exposición de secreto (ver §2.1).

---

## 3. Registro de Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Dependencias frontend desactualizadas (Next/React major) | Alta | Medio | Hoja de ruta de upgrade + E2E completo antes de bump |
| E2E sandbox solo Nequi; otros métodos y correos sin E2E real | Alta | Medio | Añadir specs sandbox (patrón Nequi) o stub suficiente en CI; Resend test API / buzón para correos |
| Métricas RED/APM y dashboards fuera de Sentry | Media | Medio | Health/version/métricas propias; alertas de negocio (órdenes atascadas); completar reglas en Sentry (5xx, latencia checkout) |
| Mock Playwright vs SSR Next desalineado | Media | Bajo | Ya parcialmente mitigado en el repo (`DJANGO_API_BASE` al mock); documentar para devs |

---

## 4. Evaluación del Stack

### 4.1 Qué está funcionando bien

- **Django + DRF** encaja con admin rico, ORM, migraciones y tests de dominio (`orders/tests.py` en inventario + pagos).
- **Next 14 App Router** con fetch SSR y proxy `/api` es coherente con túneles y same-origin en el navegador.
- **PostgreSQL** adecuado para transaccionalidad e integridad de pedidos.
- **Onboarding y operación:** `README.md` con tech stack, quick start, Sentry (resumen), tabla CI (Bandit vs E2E), enlaces a `tests/README.md` y a este archivo.

### 4.2 Qué debería cambiar

- Planificar **upgrade mayor de Next/React** con ventana de QA dedicada.
- Reducir `any` en el frontend hacia tipos generados o Zod inferidos desde contratos API.

### 4.3 Redis — Puntos de integración recomendados

- **Caché** de listados catálogo / navegación (TTL corto).
- **Rate limiting** distribuido para webhooks y endpoints públicos (si se escala horizontalmente).
- **Cola** ligera (opcional) para envío de correos y jobs de analytics.

### 4.4 Recomendación de cola de tareas asíncronas

- **Corto plazo:** Django `database` o **Redis + RQ/Celery** para emails y reprocesamiento de webhooks.
- **Largo plazo:** Si el volumen crece, workers dedicados con dead-letter y reintentos idempotentes (webhook Wompi ya documentado como idempotente en vistas).

---

## 5. Hoja de Ruta de Observabilidad

### 5.1 Estado actual

- **Sentry — Django:** `sentry-sdk` en `config/settings.py` (`DjangoIntegration`, `LoggingIntegration`, `before_send` para filtrar datos sensibles en `request.data`). Variable `SENTRY_DSN`; `DJANGO_ENV` como `environment`. Si el DSN es inválido (p. ej. typo en Render), se registra advertencia y la app arranca sin Sentry (`BadDsn`). Comando: `python manage.py verify_sentry`.
- **Sentry — Next.js:** `@sentry/nextjs` con `frontend/sentry.runtime.config.ts` (server/edge vía `instrumentation.ts`) e init en cliente (`SentryBrowserInit`). Túnel `/api/sentry-tunnel` en desarrollo según configuración del proyecto.
- **Logging** clásico Python sigue en servicios Wompi y órdenes, complementario a Sentry.
- **Frontend:** `console.log` de depuración en `cart-stock-slice.ts` (validación de stock).
- **Health:** Next expone `GET /health` (`frontend/app/health/route.ts`); smoke Playwright lo valida. Backend: **`GET /api/health/`** en Django (`config/views.py`, `config/urls.py`) — JSON `{"status":"ok"}` para balanceadores y túneles (ngrok).

### 5.2 Estrategia de logging (DB vs archivos estructurados)

- **Producción:** JSON estructurado a stdout (12-factor); correlación `request_id` / `order_id` / `reference` Wompi.
- **No** persistir logs de aplicación en PostgreSQL salvo tabla de auditoría mínima si hay compliance.

### 5.3 Sentry — seguimiento recomendado

- Configurar en la UI de Sentry: alertas por picos de 5xx, errores en rutas de checkout y webhooks Wompi; releases/source maps en deploy (frontend build plugin con token si aplica).
- Revisar periódicamente sample rates (`traces_sample_rate` / cliente) según volumen y coste.
- Mantener `SENTRY_DSN` correcto en cada entorno (una sola URL por variable; no mezclar con otras vars en el mismo campo en el panel del host).

### 5.4 Monitoreo faltante

- Métricas RED/USE para API y tiempo de respuesta Wompi/Resend.
- Dashboard de órdenes atascadas en `PENDING` > N minutos.

---

## 6. Cobertura E2E — Estado y Plan

**CI:** workflow **`e2e.yml`** (push/PR a `main`): job **Playwright E2E** — mock backend, build Next, tests Playwright estándar (sin Wompi real). En **push a `main`**, si existe el secret **`E2E_SANDBOX_BASE_URL`**, un segundo job ejecuta el spec sandbox Nequi contra la URL desplegada (`needs: e2e`). Sin secret, ese job no corre. Análisis Python: **`bandit.yml`**.

**Alcance E2E y pagos:** no hay una suite E2E que cubra *todos* los métodos de pago. El único flujo **browser + Wompi sandbox real** implementado es **Nequi** (casos aprobado y declinado → URL de resultado), para medir la integración checkout → widget → resultado. En CI principal el checkout usa **stub** del widget; otros métodos no tienen spec sandbox dedicado (datos de prueba siguen en `WOMPI_SANDBOX` para el día que se añadan).

Guía operativa: **`tests/README.md`**. El **README raíz** no detalla esto; remite a este §6 y a `tests/README.md`.

### 6.1 Cobertura actual por método de pago

| Método / canal | ¿E2E? | Notas |
|----------------|-------|--------|
| Tarjeta (widget) | Parcial | **CI:** `checkout.spec.ts` con stub `mockWompiWidget` APPROVED/DECLINED. **Sandbox real:** no hay spec E2E de tarjeta en repo (solo Nequi en sandbox; reintroducir si hace falta). |
| Tarjeta débito | No | Mismo widget; escenarios BIN distintos pendientes si Wompi los documenta aparte. |
| Nequi | Parcial | `WOMPI_SANDBOX.nequi` + `payments-nequi-sandbox.spec.ts` + `payments-sandbox-helpers.ts` (widget real en sandbox opt-in). |
| Daviplata | No (sandbox E2E) | Datos de prueba en `WOMPI_SANDBOX.daviplata`; sin spec Playwright sandbox. |
| PSE | No (sandbox E2E) | Datos en fixture; sin spec Playwright sandbox. |
| Bancolombia QR / Puntos Colombia | No (sandbox E2E) | Datos en fixture; sin spec Playwright sandbox. |
| Correo pago completado | No | — |
| Correo recuperación contraseña | No | — |

**Specs existentes (archivo → foco):**

| Archivo | Cobertura principal |
|---------|---------------------|
| `smoke.spec.ts` | 200 en home, `/health`, catálogo, PDP test, checkout, legal, 404 |
| `catalog.spec.ts` | Grid, precio, navegación a PDP, estado vacío, mobile |
| `product.spec.ts` | PDP contenido, variantes, guía tallas, agotado, mobile |
| `cart.spec.ts` | Add to cart, mini cart, eliminar, persistencia, mobile |
| `navigation.spec.ts` | Header, logo, menú mobile (un caso `fixme`), routing categoría |
| `checkout.spec.ts` | Carga, validación formulario, envío, submit + widget stub, errores API, stock warning, mobile |
| `payments-nequi-sandbox.spec.ts` | Sandbox Wompi real (Nequi): excluido del config CI; ver `tests/README.md` § E2E Wompi sandbox |

**Tests backend Python:** `apps/orders/tests.py` (referencias + inventario + idempotencia webhook), `apps/catalog/tests.py`, `apps/customers/tests.py`.

### 6.2 Trabajo pendiente en E2E pagos (detalle)

1. **Tarjeta / otros métodos sandbox:** si se necesitan de nuevo, añadir specs y ampliar `payments-sandbox-helpers.ts` (hoy solo Nequi); datos públicos en [docs.wompi.co](https://docs.wompi.co) y `WOMPI_SANDBOX`.
2. **`payments-debit.spec.ts`** (opcional): si Wompi expone flujos distintos por débito en sandbox.
3. **Daviplata / PSE / QR / Puntos (sandbox):** nuevos specs + helpers del widget (patrón Nequi) si la cuenta sandbox los expone de forma estable.
4. **`tests/e2e/emails-order-paid.spec.ts`**: tras pago mock o sandbox, verificar recepción vía **Resend test API** o buzón de prueba (Mailosaur, Ethereal) — aserciones sobre orden, monto, ítems.
5. **`tests/e2e/emails-password-reset.spec.ts`**: solicitud reset → enlace en email → completar flujo (requiere backend test env).

Cada spec debe incluir **happy path + error path** y limpiar estado (DB o referencias únicas) donde aplique.

### 6.3 Fixtures de pagos en el repo

- **`tests/e2e/fixtures/wompi-sandbox.ts`:** objeto `WOMPI_SANDBOX` (`as const`) con tarjeta, Nequi, PSE, Daviplata, Bancolombia QR, Puntos Colombia — valores de prueba **públicos** según documentación Wompi; **no** incluye claves.
- **Secretos:** `NEXT_PUBLIC_WOMPI_PUBLIC_KEY`, integridad y webhook en `.env` del backend y `frontend/.env.local` (mismo criterio que desarrollo); no duplicar en el repo.
- **Pendiente útil (no E2E):** payload de webhook de ejemplo (`transaction.updated`) con `signature.properties` / `checksum` alineados a `validate_webhook_signature` para tests de integración Django, si se quiere un archivo dedicado aparte del fixture de checkout.

### 6.4 Estrategia mocking vs sandbox real

| Enfoque | Cuándo usar |
|---------|-------------|
| `page.route()` + stubs (actual checkout) | Regresión rápida CI, sin red; no valida contrato real Wompi |
| Sandbox Wompi | Antes de release, validar firmas, 3DS si aplica, y métodos PSE/Nequi/Daviplata |
| Webhook | Tests Django con cuerpo firmado correctamente; E2E opcional con túnel (ngrok) solo en staging |

**Variables:** las llaves Wompi siguen en el entorno de la app (no hace falta duplicarlas en `tests/.env.test` salvo que se cargue dotenv en el runner). Para correos E2E futuros: `RESEND_API_KEY_TEST`, `MAIL_TEST_INBOX`, etc.

---

## 7. Fundamentos para Mantenimiento Autónomo

### 7.1 Eventos a instrumentar ahora

- `checkout_started`, `checkout_submitted`, `wompi_widget_opened`, `wompi_callback_received` (status), `order_paid`, `webhook_signature_failed`, `stock_validation_failed`.
- Ya existe tracking en storefront — alinear nombres y payloads con un **esquema versionado** (`event_version: 1`).

### 7.2 Esquema de eventos recomendado

```json
{
  "event": "order_paid",
  "version": 1,
  "ts": "ISO-8601",
  "order_id": 0,
  "reference": "KAME-…",
  "amount_cop": 0,
  "payment_method": "wompi_card|nequi|…"
}
```

### 7.3 Endpoints legibles por agentes a construir

- `GET /api/health/` — **implementado** (respuesta mínima); ampliar opcionalmente a DB up, migraciones, cola.
- `GET /api/version` — git sha, build time.
- `GET /api/metrics` — formato Prometheus básico (latencias, contadores de checkout) detrás de auth interna.

### 7.4 Brechas en analíticas del admin

- Embudos **visitas → add to cart → checkout → paid** por canal.
- Alertas de **productos con vistas altas y baja conversión**.
- Export CSV programado de órdenes pendientes.

---

## 8. Plan de Acción Priorizado

| # | Tarea | Archivo(s) afectado(s) | Esfuerzo | Impacto | Categoría |
|---|--------|-------------------------|----------|---------|-----------|
| 1 | ~~Ejecutar Bandit en CI~~ **Hecho** | `.github/workflows/bandit.yml`, `pyproject.toml`, `apps/notifications/emails.py` (`nosec B310`), `README.md` (sección Bandit + stack) | — | — | Seguridad |
| 2 | Ampliar E2E sandbox Wompi más allá de Nequi (PSE, tarjeta, Daviplata, QR, Puntos) | `tests/e2e/`, `payments-sandbox-helpers.ts`, `wompi-sandbox.ts` | Alto | Alto | QA |
| 3 | Quitar `console.log` de cart stock o poner detrás de flag dev | `frontend/store/cart-stock-slice.ts` | Bajo | Bajo | Higiene |
| 4 | Tipar `ProductGrid` y rutas API | `frontend/components/product/ProductGrid.tsx`, `app/api/*` | Medio | Medio | Deuda técnica |
| 5 | Hoja de ruta upgrade Next 15/16 + React 19 | `frontend/package.json` | Alto | Alto | Stack |
| 6 | ~~Health mínimo Django (`GET /api/health/`)~~ **Hecho**; ampliar a DB/version/métricas | `config/urls.py`, `config/views.py` | Medio | Medio | Ops |
| 7 | Evaluar Redis (caché catálogo + rate limit) | Infra, settings | Medio | Medio | Escala |

---

## Anexos — Comandos y herramientas

- **`README.md`:** entrada principal — quick start, Sentry, Bandit, tabla CI, troubleshooting operativo (p. ej. ngrok); **no** documenta alcance E2E por método de pago. Cobertura, sandbox Wompi y jobs opcionales: **§6** aquí y **`tests/README.md`**.
- **Bandit (recordatorio):** CI = `bandit -r apps config -ll -c pyproject.toml`. Auditoría con Low: mismo comando **sin** `-ll` (salida ≠ 0 con avisos Low es esperable).
- **Dependencias backend:** `requirements/base.txt` (p.ej. Django 5.2.11, DRF 3.15.0). `pip list --outdated` en el entorno global del auditor solo mostró herramientas pip/wheel; **re-ejecutar dentro de `.venv` del proyecto** para el inventario real.
- **Dependencias frontend (`npm outdated`):** Next/React/ESLint/Tailwind con versiones **Latest** muy por encima de las actuales — planificar upgrades mayor.
- **pytest / migrate:** Requieren entorno virtual con dependencias instaladas.

---

*Fin del documento.*
