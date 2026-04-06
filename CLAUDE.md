# CLAUDE.md — kame.colStore

Instrucciones persistentes para Claude Code. Este archivo es la fuente de verdad del proyecto.

---

## Proyecto

Tienda virtual de ropa streetwear **Kame.col** (Bogotá, Colombia).
Stack: Django 5.2 backend API + Next.js 14.2 App Router frontend.
El backend expone **solo una API REST**; no hay UI Django para clientes finales.

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend API | Django 5.2 + DRF 3.15 + Python 3.11 |
| Frontend | Next.js 14.2 App Router + TypeScript |
| Estilos | Tailwind CSS + Framer Motion |
| Estado carrito | Zustand + localStorage (slices) |
| DB desarrollo | SQLite |
| DB producción | PostgreSQL (via `DATABASE_URL`) |
| Media | Cloudflare R2 (django-storages S3-compatible) |
| Email | Resend (transaccional) |
| Tests | Playwright E2E (`tests/e2e/`) |
| Hosting backend | Render |

---

## Contratos de arquitectura — NO violar

### Stock: fuente única = `InventoryPool`
- El stock **NUNCA** se lee desde `ProductVariant.stock`.
- `InventoryPool` es el modelo canónico: `(category, value, color) → quantity`.
- Los serializers y la validación de checkout consultan exclusivamente `InventoryPool`.
- Toda lógica de stock vive en `apps/catalog/services/inventory.py`.

### Media frontend: fuente única = `product-media.ts`
- Las URLs de imagen siempre pasan por `frontend/lib/product-media.ts`.
- No resolver URLs de imagen inline dentro de componentes.
- No hardcodear URLs de R2, Cloudinary ni ningún origen externo en componentes.

### Rutas internas: fuente única = `routes.ts`
- Todas las rutas del frontend viven en `frontend/lib/routes.ts`.
- No hardcodear paths (`/catalogo`, `/producto/...`, etc.) en ningún componente.

### HTTP frontend: fuente única = `api.ts` / `apiFetch()`
- Todas las llamadas al backend pasan por `apiFetch()` en `frontend/lib/api.ts`.
- No usar `fetch()` directamente en componentes ni páginas.
- `fetchJSON()` es **legacy** — no agregar más usos; migrar si se toca ese código.
- La política de caché (`next.revalidate`, `cache: "no-store"`) se declara en el callsite, nunca dentro de `apiFetch()`.

### Tipos TypeScript: fuente única = `catalog.ts`
- Todos los tipos canónicos del catálogo viven en `frontend/types/catalog.ts`.
- No definir interfaces de producto, categoría o variante fuera de ese archivo.

### Navegación pública: contrato = `Department → Category`
- El header y el menú mobile consumen `/api/navigation/` (departments + categories).
- Las listas planas de categorías (`/api/categories/`) son **legacy/fallback**.
- No reconstruir la navegación desde listas planas.

### Carrito
- Vive 100% en el cliente: Zustand + `localStorage`.
- Django **no tiene** estado de carrito.
- El backend revalida stock y recalcula precios en cada checkout.
- El store está dividido en slices: `cart-items-slice`, `cart-ui-slice`, `cart-stock-slice`.

---

## Reglas de desarrollo

### NO hacer
- No hardcodear slugs, precios, labels, rutas ni `city_codes`.
- No leer stock desde `ProductVariant.stock` — solo `InventoryPool`.
- No resolver URLs de imagen fuera de `product-media.ts`.
- No agregar endpoints sin documentar el contrato en este archivo o en el README.
- No modificar Django admin sin verificar que no rompe flujos operativos de pedidos.
- No tocar diseño editorial ni copy sin preservar el tono de marca Kame.col.
- No duplicar helpers (`extractArray`, `apiFetch`, etc. ya existen — no recrear inline).
- No habilitar `NEXT_ENABLE_IMAGE_OPTIMIZATION=true` sin validar todos los orígenes de media.
- No commitear secrets ni `.env` con valores reales.

### SÍ hacer
- Centralizar toda lógica de negocio en `apps/*/services/`.
- Documentar la política de caché explícitamente en cada función de `api.ts`.
- Preservar el modelo `Department → Category` en cualquier cambio de navegación.
- Usar `routes.ts` para generar rutas. Usar `product-media.ts` para URLs de imagen.
- Usar `apiFetch()` para todos los requests HTTP del frontend.
- Mantener los tipos en `catalog.ts` como la única fuente de verdad de contratos de API.

---

## Checklist obligatorio antes de commit

- [ ] `cd frontend && npm run lint` — sin errores
- [ ] `cd frontend && npm run build` — compila sin errores TypeScript
- [ ] `python manage.py check` — sin warnings
- [ ] Si se modificó `models.py`: `python manage.py makemigrations --check`
- [ ] Si se modificó lógica de stock: verificar que `InventoryPool` sigue siendo fuente única
- [ ] Si se agregó un endpoint: documentado en README + en este archivo
- [ ] Tests E2E críticos pasan: `smoke.spec.ts`, `checkout.spec.ts`, `cart.spec.ts`

---

## Endpoints API actuales

| Método | Endpoint | Descripción | Caché |
|---|---|---|---|
| GET | `/api/navigation/` | Departments + categories | 5 min ISR |
| GET | `/api/categories/` | Lista plana (legacy/fallback) | 5 min ISR |
| GET | `/api/products/` | Listado paginado con filtros | no-store |
| GET | `/api/catalogo/` | Vista catálogo (alias) | configurable |
| GET | `/api/products/<slug>/` | Detalle de producto + variantes | configurable |
| GET | `/api/homepage-banners/` | Banners hero | 5 min ISR |
| GET | `/api/homepage-promos/` | Promos (`?placement=TOP\|MID`) | 5 min ISR |
| GET | `/api/homepage-marquee-products/` | Productos del marquee | 5 min ISR |
| GET | `/api/homepage-story/` | Brand story | 5 min ISR |
| GET | `/api/orders/cities/` | Catálogo de ciudades | — |
| GET | `/api/orders/shipping-quote/` | Cotización de envío | — |
| POST | `/api/orders/stock-validate/` | Validación de stock pre-checkout | no-store |
| POST | `/api/orders/checkout/` | Crear orden | no-store |

---

## Estructura de módulos

```
apps/
  catalog/
    models.py             # Product, ProductVariant, Category, Department,
    │                     # InventoryPool, HomepageBanner, HomepagePromo, HomepageSection
    serializers.py        # Stock calculado desde InventoryPool
    views_api.py          # Endpoints públicos del catálogo
    services/
      inventory.py        # Lógica de stock — fuente única
      variant_sync.py     # Sincronización de variantes desde pool
  orders/
    models.py             # Order, OrderItem (status: PENDING_PAYMENT → PAID)
    views_api.py          # POST /checkout/, POST /stock-validate/
    services/
      cart_validation.py
      create_order_from_cart.py
      shipping.py         # Reglas Servientrega: Bogotá $10k, Nacional $20k, gratis >$170k
      payments.py
      stock.py
  customers/
    models.py             # Customer (fuente futura de CRM)
  notifications/
    emails.py             # Envío transaccional via Resend
    email_context.py      # Contexto de pedido para emails
    email_product_media.py # Resolución de imágenes para emails
  common/
    pagination.py         # RelativePageNumberPagination

config/
  settings.py             # Configuración central — leer antes de modificar settings
  urls.py                 # Root URL conf (prefijo /api/)

frontend/
  app/                    # Páginas App Router
    page.tsx              # Home (revalidate: 300)
    catalogo/             # Listado de productos
    producto/[slug]/      # PDP
    checkout/             # Flujo de compra
    categoria/[slug]/     # Filtrado por categoría
    legal/                # Términos y privacidad
  components/
    product/              # ProductCard, ProductGallery, SizeGuideDrawer, ProductGrid
    cart/                 # MiniCart, CartAddFlyout
    home/                 # HeroCarousel, BrandStory, HomepagePromos, HomeProductMarquee
    header/               # HeaderServer + navegación
    ui/                   # Primitivos: Button, Notice, PremiumLoader
  lib/
    api.ts                # Cliente HTTP — fuente única de transporte
    routes.ts             # Rutas — fuente única
    product-media.ts      # Media URLs — fuente única
    navigation-normalize.ts
    whatsapp.ts
  store/
    cart.ts               # Composición de slices Zustand
    cart-items-slice.ts
    cart-ui-slice.ts
    cart-stock-slice.ts
  types/
    catalog.ts            # Tipos TypeScript — fuente única del contrato API

tests/e2e/                # Playwright E2E
  smoke.spec.ts
  cart.spec.ts
  checkout.spec.ts
  product.spec.ts
  catalog.spec.ts
  navigation.spec.ts
```

---

## Flujo de compra (referencia operativa)

```
1. Cliente agrega productos → carrito Zustand (localStorage)
2. Checkout → POST /api/orders/stock-validate/ (validación previa, no bloquea)
3. Submit → POST /api/orders/checkout/ (backend crea orden, recalcula precios)
4. Orden: PENDING_PAYMENT
5. Cliente realiza transferencia bancaria
6. Admin confirma pago en Django Admin
7. confirm_order_payment() → descuenta stock + envía email de confirmación (Resend)
8. Orden: PAID
```

---

## Envíos (Servientrega)

| Destino | Costo |
|---|---|
| Bogotá D.C. | $10.000 COP |
| Nacional | $20.000 COP |
| Subtotal ≥ $170.000 COP | Gratis |

Lógica en `apps/orders/services/shipping.py`.

---

## Variables de entorno relevantes

### Backend (`.env` en raíz)
```
DJANGO_SECRET_KEY=
DJANGO_DEBUG=
DJANGO_ALLOWED_HOSTS=
DATABASE_URL=
R2_BUCKET_NAME=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_ACCOUNT_ID=
R2_PUBLIC_BASE_URL=
RESEND_API_KEY=
TRANSACTIONAL_FROM_EMAIL=
EMAIL_TRANSACTIONAL_PROVIDER=resend
SUPPORT_WHATSAPP=57XXXXXXXXXX
```

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=/api
DJANGO_API_BASE=http://localhost:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_WHATSAPP_PHONE=57XXXXXXXXXX
NEXT_ENABLE_IMAGE_OPTIMIZATION=false
```

---

## Subagentes definidos

### `repo-auditor`
Lee el repo completo y devuelve: mapa de módulos, deuda técnica, duplicados, código legado, quick wins, riesgos de seguridad.
```
Prompt base: "Audita kame.colStore completo. Lee CLAUDE.md primero.
Devuelve hallazgos por categoría: deuda técnica, duplicados,
seguridad, quick wins. Sé concreto y referencia archivos reales."
```

### `analytics-architect`
Diseña el sistema propio de tracking de eventos: esquema, endpoint collector, tablas derivadas, dashboard base.

### `admin-ux-reviewer`
Revisa el Django admin actual. Propone mejoras de UX operativa, previews de producto, estados de pedido, vistas de stock.

### `security-reviewer`
Revisa: endpoints públicos sin autenticación, validación de uploads, headers HTTP, CSRF/CORS, secrets, permisos del admin, logs de acciones sensibles.

### `brand-copy-reviewer`
Revisa tono, naming, badges, copy de PDP, emails y home contra la voz editorial de Kame.col.

---

## Roadmap de mejoras (prioridad descendente)

1. **Sistema de tracking de eventos propio** — captura de page_view, pdp_view, add_to_cart, checkout_start, payment_confirmed
2. **CRM ligero** — tabla customer con eventos, segmentos, automatizaciones mínimas
3. **Admin premium** — previews reales, vistas operativas, trazabilidad de cambios
4. **Image optimization** — habilitar `NEXT_ENABLE_IMAGE_OPTIMIZATION` con validación completa de orígenes
5. **Dashboard de negocio** — conversión por categoría, funnel, AOV, top productos
6. **IA sobre datos reales** — insights, segmentación asistida, recomendaciones

---

## Deuda técnica conocida (Abril 2026)

- `LANGUAGE_CODE = 'en-us'` y `TIME_ZONE = 'UTC'` — pendiente ajuste a Colombia (`es-co` / `America/Bogota`)
- `fetchJSON()` marcado como legacy — migrar callers restantes a `apiFetch()`
- `extractArray()` duplicado en `api.ts` y `app/page.tsx` — consolidar
- `getHomepageStory()` tiene 3 candidatos de URL legacy — limpiar cuando API esté estabilizada
- `NEXT_ENABLE_IMAGE_OPTIMIZATION` deshabilitado — pendiente validación de orígenes R2
- `scripts/fix_catalog_migration_history.py` — indicio de historial de migración irregular; revisar estado actual
- `.venv/` con subdirectorios duplicados (`bin 2`, `bin 3`) — limpiar entorno virtual
- No hay middleware de rate limiting en endpoints públicos de la API
- No hay CRM propio — `apps/customers/` tiene el modelo base pero sin lógica de segmentación
- No hay sistema de tracking de eventos — cero datos de conversión propios
