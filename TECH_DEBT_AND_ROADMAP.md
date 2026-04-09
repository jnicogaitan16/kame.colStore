# Kame.col — Deuda Técnica, Riesgos y Hoja de Ruta de Mejoras

> Generado: 2026-04-09 | Modo: Solo lectura — cero modificaciones al código fuente durante la auditoría (salvo la creación de este documento y referencias en documentación del repo).

## Resumen Ejecutivo

Monorepo **Django 5.2 + DRF** (`apps/*`, `config/`) y **Next.js 14 App Router** (`frontend/`), con **PostgreSQL**, pagos **Wompi**, correo **Resend** y E2E **Playwright** (`tests/`). El producto está maduro para MVP; los mayores huecos son **observabilidad unificada (Sentry/métricas)**, **higiene de secretos en logs**, **ampliación E2E de medios de pago y correos**, y **reducción de `any` / deuda de tipos** en el frontend. Las dependencias de frontend tienen **saltos mayores** disponibles (Next 16, React 19, ESLint 10) que conviene planificar como proyecto aparte.

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

- **`WOMPI_EVENTS_SECRET` en logs:** En `apps/orders/services/wompi.py`, `validate_webhook_signature` construye `parts` que **incluye el secreto** y lo registra con `logger.warning("WOMPI SIG parts=%s", parts)`. Esto puede **volcar el secreto de firma de webhooks** en agregadores de logs. Mitigar: eliminar ese log o enmascarar; nunca loguear el secreto ni el string concatenado completo en producción.
- **DEBUG / SECRET_KEY:** `config/settings.py` usa `DEBUG` desde env; en `DEBUG=True` hay fallback `SECRET_KEY` por defecto — aceptable solo en local; asegurar que producción siempre tenga `DJANGO_DEBUG` falso y `DJANGO_SECRET_KEY` fuerte.

### 2.2 Prioridad Media

- **CSRF_TRUSTED_ORIGINS** incluye IP LAN fija (`192.168.20.128`) — revisar en despliegues; preferir solo env.
- **Proxy API Next** (`frontend/app/api/[...path]/route.ts`): revisar que no amplíe superficie (métodos, headers, SSRF) — auditoría manual recomendada.
- **Bandit:** No ejecutado (módulo no instalado en el Python del entorno de auditoría). Ejecutar en CI: `bandit -r apps config`.

### 2.3 Baja Prioridad / Hardening

- Sin `eval`/`exec` en `*.py`/`*.ts`/`*.tsx` (búsqueda puntual).
- Sin `raw(` / `cursor.execute(` en Python (búsqueda puntual).
- **Wompi:** Firma de integridad (widget) y validación de webhook por SHA256 alineadas con documentación; completitud lógica buena salvo el riesgo de logging anterior.

---

## 3. Registro de Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Fuga de `WOMPI_EVENTS_SECRET` vía logs | Media | Crítico | Quitar/mascar logs; rotar secreto si hubo exposición |
| Condiciones de carrera en stock bajo carga extrema | Baja–Media | Alto | Mantener `transaction.atomic()` en servicios; pruebas de concurrencia; considerar `select_for_update` donde falte |
| Dependencias frontend desactualizadas (Next/React major) | Alta | Medio | Hoja de ruta de upgrade + E2E completo antes de bump |
| E2E no cubre Nequi/Daviplata/correos | Alta | Medio | Specs y fixtures dedicados; sandbox Wompi + Resend test API |
| Ausencia de Sentry/APM | Media | Medio | Integrar Django + Next; alertas en 5xx y latencia checkout |
| Mock Playwright vs SSR Next desalineado | Media | Bajo | Ya parcialmente mitigado en el repo (`DJANGO_API_BASE` al mock); documentar para devs |

---

## 4. Evaluación del Stack

### 4.1 Qué está funcionando bien

- **Django + DRF** encaja con admin rico, ORM, migraciones y tests de dominio (`orders/tests.py` en inventario + pagos).
- **Next 14 App Router** con fetch SSR y proxy `/api` es coherente con túneles y same-origin en el navegador.
- **PostgreSQL** adecuado para transaccionalidad e integridad de pedidos.

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

- **Logging** Python vía `logging` en servicios Wompi y órdenes; **sin Sentry** (búsqueda sin coincidencias).
- **Frontend:** `console.log` de depuración en `cart-stock-slice.ts` (validación de stock).
- **Health:** Next expone `GET /health` (`frontend/app/health/route.ts`); smoke Playwright lo valida. Backend: evaluar `/api/health` o similar para balanceadores.

### 5.2 Estrategia de logging (DB vs archivos estructurados)

- **Producción:** JSON estructurado a stdout (12-factor); correlación `request_id` / `order_id` / `reference` Wompi.
- **No** persistir logs de aplicación en PostgreSQL salvo tabla de auditoría mínima si hay compliance.

### 5.3 Plan de integración de Sentry

- **Django:** `sentry-sdk` con `DjangoIntegration`, filtrar PII en checkout.
- **Next.js:** `@sentry/nextjs` en server + edge; sample rate en cliente.
- Alertas: picos 5xx en `checkout`, `wompi-webhook`, errores de firma.

### 5.4 Monitoreo faltante

- Métricas RED/USE para API y tiempo de respuesta Wompi/Resend.
- Dashboard de órdenes atascadas en `PENDING` > N minutos.

---

## 6. Cobertura E2E — Estado y Plan

Guía operativa (comandos, tabla de specs, plantilla `.env.test`): **`tests/README.md`**.

### 6.1 Cobertura actual por método de pago

| Método / canal | ¿E2E? | Notas |
|----------------|-------|--------|
| Tarjeta (crédito genérica vía widget) | Parcial | `checkout.spec.ts`: stub `mockWompiWidget` APPROVED/DECLINED; **no** usa tarjetas de prueba reales Wompi |
| Tarjeta débito | No | — |
| Nequi | No | — |
| Daviplata | No | — |
| PSE u otros | No | No auditado en specs |
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

**Tests backend Python:** `apps/orders/tests.py` (referencias + inventario + idempotencia webhook), `apps/catalog/tests.py`, `apps/customers/tests.py`.

### 6.2 Specs faltantes con casos de prueba detallados

1. **`tests/e2e/payments-card-sandbox.spec.ts`** (sandbox real o grabación): happy path tarjeta aprobada; declinada; fondos insuficientes; datos inválidos — usando **tarjetas de prueba oficiales** de [docs.wompi.co](https://docs.wompi.co).
2. **`tests/e2e/payments-debit.spec.ts`**: mismos escenarios si Wompi expone BIN/métodos distintos en sandbox.
3. **`tests/e2e/payments-nequi.spec.ts`**: número sandbox aprobado vs rechazo/timeout (según documentación Wompi actual).
4. **`tests/e2e/payments-daviplata.spec.ts`**: análogo Nequi.
5. **`tests/e2e/emails-order-paid.spec.ts`**: tras pago mock o sandbox, verificar recepción vía **Resend test API** o buzón de prueba (Mailosaur, Ethereal) — aserciones sobre orden, monto, ítems.
6. **`tests/e2e/emails-password-reset.spec.ts`**: solicitud reset → enlace en email → completar flujo (requiere backend test env).

Cada spec debe incluir **happy path + error path** y limpiar estado (DB o referencias únicas).

### 6.3 Fixtures de pagos recomendados

Crear `tests/e2e/fixtures/payment-data.ts` con:

- Constantes para **tarjetas de prueba** (número, CVV, expiración) según entorno `test` Wompi — **no hardcodear claves**; leer de `tests/.env.test`.
- Placeholders para **Nequi / Daviplata** (números sandbox documentados por Wompi).
- **Payload de webhook** de ejemplo (`transaction.updated`) con `signature.properties`, `checksum`, `timestamp` coherentes con `validate_webhook_signature` (para tests de integración o contract tests en Django, no solo E2E).

### 6.4 Estrategia mocking vs sandbox real

| Enfoque | Cuándo usar |
|---------|-------------|
| `page.route()` + stubs (actual checkout) | Regresión rápida CI, sin red; no valida contrato real Wompi |
| Sandbox Wompi | Antes de release, validar firmas, 3DS si aplica, y métodos PSE/Nequi/Daviplata |
| Webhook | Tests Django con cuerpo firmado correctamente; E2E opcional con túnel (ngrok) solo en staging |

**`tests/.env.test` sugerido:** `WOMPI_PUBLIC_KEY_TEST`, `WOMPI_INTEGRITY_SECRET_TEST`, `WOMPI_EVENTS_SECRET_TEST` (solo sandbox), `TEST_CARD_APPROVED`, `TEST_CARD_DECLINED`, `TEST_NEQUI_NUMBER`, `TEST_DAVIPLATA_NUMBER`, `RESEND_API_KEY_TEST`, `MAIL_TEST_INBOX`.

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

- `GET /api/health` — DB up, migraciones aplicadas, cola opcional.
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
| 1 | Eliminar logs que incluyan `WOMPI_EVENTS_SECRET` o concatenación sensible | `apps/orders/services/wompi.py` | Bajo | Crítico | Seguridad |
| 2 | Ejecutar Bandit en CI | `.github/workflows/*` | Bajo | Medio | Seguridad |
| 3 | Integrar Sentry Django + Next | `config/settings.py`, `frontend/*` | Medio | Alto | Observabilidad |
| 4 | E2E sandbox tarjeta + Nequi/Daviplata (staging) | `tests/e2e/*`, fixtures | Alto | Alto | QA |
| 5 | Quitar `console.log` de cart stock o poner detrás de flag dev | `frontend/store/cart-stock-slice.ts` | Bajo | Bajo | Higiene |
| 6 | Tipar `ProductGrid` y rutas API | `frontend/components/product/ProductGrid.tsx`, `app/api/*` | Medio | Medio | Deuda técnica |
| 7 | Hoja de ruta upgrade Next 15/16 + React 19 | `frontend/package.json` | Alto | Alto | Stack |
| 8 | Health check Django + métricas | `config/urls.py`, nueva vista | Medio | Medio | Ops |
| 9 | Evaluar Redis (caché catálogo + rate limit) | Infra, settings | Medio | Medio | Escala |

---

## Anexos — Comandos y herramientas

- **Dependencias backend:** `requirements/base.txt` (p.ej. Django 5.2.11, DRF 3.15.0). `pip list --outdated` en el entorno global del auditor solo mostró herramientas pip/wheel; **re-ejecutar dentro de `.venv` del proyecto** para el inventario real.
- **Dependencias frontend (`npm outdated`):** Next/React/ESLint/Tailwind con versiones **Latest** muy por encima de las actuales — planificar upgrades mayor.
- **pytest / migrate:** Requieren entorno virtual con dependencias instaladas.

---

*Fin del documento.*
