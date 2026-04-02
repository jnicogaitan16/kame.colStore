# Kame.colStore

Tienda virtual de ropa streetwear (Kame.col) — backend Django 5.2 + storefront público Next.js 14. El backend expone una API REST consumida exclusivamente por el frontend; no hay UI Django para clientes.

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend API | Django 5.2 + Django REST Framework 3.15 |
| Frontend | Next.js 14.2 (App Router) |
| Carrito cliente | Zustand + localStorage |
| Estilos | Tailwind CSS |
| Animaciones | Framer Motion |
| DB desarrollo | SQLite |
| DB producción | PostgreSQL |

---

## Inicio rápido

### Backend

```bash
# Instalar dependencias
python -m venv .venv
source .venv/bin/activate
pip install -r requirements/base.txt

# Configurar entorno (ver sección Variables de entorno)
cp .env.example .env  # o crear manualmente

# Migraciones y servidor
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Frontend

Requiere **Node.js 18+ (recomendado Node 20)**.

```bash
cd frontend
npm install
npm run dev
```

Levantar ambos servidores en paralelo: Django en `:8000`, Next.js en `:3000`.

---

## Variables de entorno

### Backend (`.env` en raíz)

```env
DJANGO_SECRET_KEY=genera-una-clave-segura
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=sqlite:///db.sqlite3

# Media y URLs públicas
PUBLIC_SITE_URL=http://localhost:3000

# Email (Resend)
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# WhatsApp soporte
SUPPORT_WHATSAPP=57XXXXXXXXXX
```

### Frontend (`.env.local` en `frontend/`)

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_WHATSAPP_PHONE=57XXXXXXXXXX
```

---

## Estructura del proyecto

```
kame.colStore/
├── apps/
│   ├── catalog/                 # Productos, categorías, departamentos, InventoryPool
│   │   ├── models.py            # Product, ProductVariant, Category, InventoryPool, ...
│   │   ├── serializers.py       # Serializers con stock desde InventoryPool
│   │   └── views_api.py         # API pública del catálogo (/api/*)
│   ├── orders/                  # Checkout y pedidos
│   │   ├── services/            # Lógica de negocio desacoplada
│   │   │   ├── cart_validation.py
│   │   │   ├── create_order_from_cart.py
│   │   │   ├── shipping.py
│   │   │   ├── payments.py
│   │   │   └── stock.py
│   │   ├── views.py             # Vistas utilitarias del admin (customer_snapshot, variant_price)
│   │   ├── views_api.py         # API REST del checkout (/api/orders/*)
│   │   └── static/orders/js/    # JS del admin (cálculo de envío y precios)
│   ├── customers/               # Modelo Cliente
│   ├── notifications/           # Emails transaccionales (Resend)
│   │   ├── emails.py            # Envío de emails
│   │   ├── email_context.py     # Contexto para emails de pedido
│   │   ├── email_product_media.py  # Resolución de imágenes para emails
│   │   └── email_utils.py       # Utilidades compartidas (format_cop, _build_variant_label)
│   └── common/                  # Utilidades compartidas entre apps
├── config/                      # Configuración Django (settings, urls, wsgi)
├── templates/
│   ├── admin/                   # Overrides del admin Django
│   └── emails/                  # Templates HTML de emails transaccionales
├── frontend/
│   ├── app/                     # Páginas Next.js (App Router)
│   │   ├── page.tsx             # Home
│   │   ├── catalogo/            # Listado de productos
│   │   ├── producto/[slug]/     # Detalle de producto
│   │   ├── checkout/            # Flujo de compra
│   │   └── legal/               # Páginas legales
│   ├── components/              # Componentes React
│   │   ├── product/             # ProductCard, ProductGallery, SizeGuideDrawer, ...
│   │   ├── cart/                # MiniCart, CartAddFlyout
│   │   └── ui/                  # Button, Notice, PremiumLoader, ...
│   ├── lib/                     # Utilidades y cliente API
│   │   ├── api.ts               # apiFetch + funciones tipadas por endpoint
│   │   ├── product-media.ts     # Normalización de URLs de imagen (fuente única)
│   │   ├── navigation-normalize.ts  # Normalización de datos de navegación
│   │   └── whatsapp.ts          # Builder de links wa.me
│   ├── store/cart.ts            # Estado del carrito (Zustand + persist)
│   └── types/catalog.ts         # Tipos TypeScript canónicos del catálogo
├── requirements/
│   ├── base.txt                 # Dependencias comunes
│   └── ...
└── manage.py
```

---

## Arquitectura

### API Backend → Frontend

El frontend Next.js **nunca renderiza vistas Django**. Toda la comunicación es via API REST:

| Prefijo | Descripción |
|---|---|
| `GET /api/navigation/` | Departamentos y categorías activas |
| `GET /api/products/` | Listado de productos paginado |
| `GET /api/products/<slug>/` | Detalle de producto con variantes y stock |
| `GET /api/orders/cities/` | Catálogo de ciudades para envío |
| `GET /api/orders/shipping-quote/` | Cotización de envío por ciudad y subtotal |
| `POST /api/orders/stock-validate/` | Validación de stock antes de checkout |
| `POST /api/orders/checkout/` | Creación de orden (recalcula precios en backend) |

### Stock — fuente única: `InventoryPool`

El stock no se lee de `ProductVariant.stock`. `InventoryPool` es el modelo canónico:

- Cada entrada define `(category, value, color) → quantity`
- Los serializers y la validación de checkout consultan exclusivamente `InventoryPool`
- El admin permite carga masiva de inventario por categoría

### Carrito

El carrito vive **100% en el cliente** (Zustand + `localStorage`). Django no tiene estado de carrito. El frontend envía el snapshot del carrito al crear la orden; el backend revalida stock y recalcula todos los precios.

### Emails transaccionales

Los emails de confirmación de pago se envían vía **Resend**. El módulo `apps/notifications/` construye el contexto (`email_context.py`), resuelve imágenes de producto (`email_product_media.py`) y envía con `emails.py`.

---

## Flujo de compra

```
1. Cliente agrega productos → carrito Zustand (localStorage)
2. Checkout → POST /api/orders/stock-validate/ (validación previa)
3. Submit → POST /api/orders/checkout/ (backend crea orden, descuenta nada aún)
4. Orden queda en PENDING_PAYMENT
5. Cliente realiza transferencia bancaria
6. Admin confirma pago desde Django Admin
7. confirm_order_payment() → descuenta stock + envía email de confirmación
8. Orden pasa a PAID
```

---

## Envíos

Operador principal: **Servientrega** (nacional).

| Destino | Costo |
|---|---|
| Bogotá D.C. | $10.000 COP |
| Nacional | $20.000 COP |
| Desde $170.000 COP | Gratis |

Configuración en `apps/orders/services/shipping.py`.

---

## Comandos útiles

```bash
# Verificar configuración
python manage.py check --deploy

# Shell Django
python manage.py shell

# Recolectar estáticos (producción)
python manage.py collectstatic --noinput

# Build Next.js
cd frontend && npm run build
```

---

## Troubleshooting

**`sh: next: command not found`**
Node.js < 18. Instalar Node 20 con nvm: `nvm install 20 && nvm use 20`.

**`ECONNREFUSED 127.0.0.1:8000`** en Next.js
Django no está corriendo. El frontend muestra estado vacío sin crashear — comportamiento esperado.

**`SECRET_KEY not found`**
Crear `.env` en la raíz del proyecto con `DJANGO_SECRET_KEY`.
