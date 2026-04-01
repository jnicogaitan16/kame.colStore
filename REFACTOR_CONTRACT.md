# Contrato de Refactor y Depuración — kame.colStore

> Fecha: 2026-04-01
> Autor: Nico Gaitán + Claude Code
> Basado en: auditoría de código muerto realizada el 2026-04-01

---

## Reglas generales

- Cada fase se ejecuta en una **PR separada** con título `refactor(phase-N): <descripción>`.
- Antes de mergear una fase, **la app debe correr sin errores** (`next dev` + `python manage.py check --deploy`).
- Cada eliminación de archivo va acompañada de **búsqueda de referencia** confirmada (grep/IDE) antes de borrar.
- No se mezclan fases. Fase N+1 no empieza hasta que Fase N está mergeada.
- En caso de duda sobre si algo se usa en runtime (e.g. vía string dinámico), se **comenta** primero en un commit separado, se despliega, se monitorea, y luego se elimina.

---

## Fase 1 — Eliminación de archivos sin referencias (riesgo: NULO)

**Criterio de entrada:** rama limpia desde `main`.
**Criterio de salida:** `next build` pasa, `python manage.py check` pasa.

### Frontend — archivos a eliminar

| Archivo | Validación previa |
|---|---|
| `frontend/components/ui/uiClasses.ts` | `grep -r "uiClasses"` devuelve 0 resultados |
| `frontend/lib/site-config.ts` | `grep -r "siteConfig"` devuelve 0 resultados |
| `frontend/lib/constants.ts` | `grep -r "BREB_PHONE"` devuelve 0 resultados |
| `frontend/hooks/useBodyScrollLock.ts` | `grep -r "useBodyScrollLock"` devuelve 0 resultados |
| `frontend/hooks/useHorizontalDrawerDrag.ts` | `grep -r "useHorizontalDrawerDrag"` devuelve 0 resultados |
| `frontend/hooks/useRouteLoadingOverlay.ts` | `grep -r "useRouteLoadingOverlay"` devuelve 0 resultados |
| `frontend/components/ui/DelayedLoader.tsx` | `grep -r "DelayedLoader"` devuelve 0 resultados |

### Python — archivos a eliminar

| Archivo | Validación previa |
|---|---|
| `apps/catalog/views.py` | Solo contiene stub. Confirmar que ningún `urls.py` importa de él |
| `apps/customers/views.py` | Solo contiene stub. Confirmar que ningún `urls.py` importa de él |
| `apps/orders/templatetags/money.py` | `grep -r "load money"` devuelve 0 resultados en templates |
| `apps/catalog/services/inventory_bulk.py` | `grep -r "inventory_bulk"` devuelve 0 resultados |

**Entregable:** PR `refactor(phase-1): remove dead files with no references`

---

## Fase 2 — Funciones y clases muertas (riesgo: BAJO)

**Criterio de entrada:** Fase 1 mergeada.
**Criterio de salida:** tests pasan, `next build` pasa, `python manage.py check` pasa.

### Frontend

| Archivo | Acción |
|---|---|
| `frontend/lib/product-media.ts` | Eliminar `getProductViewerImages()` |
| `frontend/lib/whatsapp.ts` | Quitar `export` de `normalizePhoneDigits()` (hacer privada) |
| `frontend/lib/navigation-normalize.ts` | Quitar `export` de `normalizeText`, `normalizeSlug`, `normalizeSortOrder` (hacer privadas) |

### Python

| Archivo | Acción |
|---|---|
| `apps/orders/views_api.py` | Eliminar `stock_validate_view` (FBV, línea ~118) |
| `apps/orders/views_api.py` | Eliminar `CsrfCookieAPIView` (línea ~229) |
| `apps/catalog/views_api.py` | Eliminar `NavigationAPIView` (línea ~79), reemplazada por `NavigationListAPIView` |
| `apps/catalog/views_api.py` | Eliminar alias `HomepageStoryAPIView` (línea ~343) |
| `apps/notifications/email_product_media.py` | Eliminar `build_email_order_items()` — duplicado muerto de `_build_email_items()` |

**Entregable:** PR `refactor(phase-2): remove dead functions and classes`

---

## Fase 3 — Consolidar duplicados (riesgo: MEDIO)

**Criterio de entrada:** Fase 2 mergeada.
**Criterio de salida:** tests pasan, emails de pedido funcionan en staging, `next build` pasa.

### 3a — Tipos TypeScript duplicados

**Problema:** `SizeGuide`/`SizeGuideRow` definidos en dos lugares.
- `frontend/types/catalog.ts` — canónico
- `frontend/components/product/sizeGuideData.ts` — duplicado

**Acción:**
1. Eliminar las definiciones de tipo de `sizeGuideData.ts`
2. Actualizar `SizeGuideDrawer.tsx` para importar desde `@/types/catalog`
3. Si `sizeGuideData.ts` queda vacío o solo con datos, evaluar si moverlo a `frontend/data/`

### 3b — Utilidades de email duplicadas

**Problema:** `email_context.py` y `email_product_media.py` duplican `format_cop()` y `_build_variant_label()`.

**Acción:**
1. Crear `apps/notifications/email_utils.py` con las versiones canónicas de `format_cop()` y `_build_variant_label()`
2. Actualizar `email_context.py` y `email_product_media.py` para importar desde `email_utils.py`
3. Eliminar las definiciones locales duplicadas

### 3c — Fallback defensivo en `email_product_media.py`

**Problema:** `public_media_url()` y `_spec_url()` se reimplementan localmente en `email_product_media.py` como fallback.

**Acción:**
1. Confirmar que el import desde `catalog.serializers` nunca falla en producción
2. Si es estable, eliminar el bloque try/except y usar solo el import directo
3. Si hay riesgo real de import circular, mover las funciones a un módulo compartido como `apps/shared/media.py`

**Entregable:** PR `refactor(phase-3): consolidate duplicate utilities`

---

## Fase 4 — Limpieza del legado Django (riesgo: ALTO)

**Criterio de entrada:** Fase 3 mergeada. Confirmar con el equipo que no hay integraciones externas que usen las URLs legacy.
**Criterio de salida:** Smoke test del checkout moderno (Next.js → API), monitoreo de 404s en logs durante 24h.

> ⚠️ Esta fase requiere revisión manual antes de ejecutar. Las URLs legacy pueden tener tráfico residual (bots, integraciones, etc.).

### Paso 1 — Auditar tráfico

Antes de eliminar, revisar logs de acceso (Nginx/Gunicorn) para confirmar que estas rutas no reciben tráfico real:
- `/orders/checkout/`
- `/orders/checkout/success/`
- `/orders/shipping-quote/`
- `/cart/`
- `/cart/add/`, `/cart/remove/`, etc.

### Paso 2 — Devolver 410 Gone

En lugar de eliminar directamente, reemplazar las vistas legacy con respuestas `410 Gone` por **al menos 2 semanas**. Esto permite detectar integraciones que aún dependan de ellas.

```python
# views_cart.py — reemplazar cada vista con:
from django.http import HttpResponseGone
def add_to_cart(request):
    return HttpResponseGone("Esta API ha sido deprecada. Usar /api/orders/")
```

### Paso 3 — Eliminar código

Una vez confirmado que no hay tráfico:
1. Eliminar `apps/orders/views_cart.py`
2. Limpiar `apps/orders/views.py` (remover checkout views, dejar solo lo que siga en uso)
3. Actualizar `apps/orders/urls.py` para remover las rutas afectadas
4. Eliminar templates HTML huérfanos: `cart.html`, `checkout.html` (si no tienen otro uso)

**Entregable:** PR `refactor(phase-4): remove legacy django template checkout flow`

---

## Checklist de cierre por fase

```
[ ] grep final para confirmar que no quedan referencias al código eliminado
[ ] next build pasa sin errores ni warnings nuevos
[ ] python manage.py check --deploy pasa
[ ] python manage.py test (si hay tests)
[ ] PR revisada y aprobada
[ ] Mergeada a main
[ ] Deploy a staging y smoke test manual
```

---

## Estimación de impacto

| Fase | Archivos eliminados | Líneas aprox. eliminadas | Riesgo |
|---|---|---|---|
| 1 | ~11 archivos | ~250 líneas | Nulo |
| 2 | 0 archivos, ~8 funciones/clases | ~150 líneas | Bajo |
| 3 | 0 archivos, refactor de 3 módulos | -~100 líneas netas | Medio |
| 4 | ~2 archivos + templates | ~400+ líneas | Alto |
| **Total** | | **~900 líneas** | |
