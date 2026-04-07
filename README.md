```markdown
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
| Pasarela de pagos | Wompi (Widget + Webhooks) |
| Emails transaccionales | Resend |
| 2FA Admin | django-otp + django-two-factor-auth |
| DB desarrollo | SQLite |
| DB producción | PostgreSQL |

---

## Inicio rápido

### Backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements/base.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Frontend

Requiere **Node.js 18+**.

```bash
cd frontend
npm install
npm run dev
```

Django en `:8000`, Next.js en `:3000`.

---

## Variables de entorno

### Backend (`.env` en raíz)

```env
DJANGO_SECRET_KEY=
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=sqlite:///db.sqlite3

# Wompi
WOMPI_PUBLIC_KEY=pub_test_...
WOMPI_PRIVATE_KEY=prv_test_...
WOMPI_EVENTS_SECRET=test_events_...
WOMPI_INTEGRITY_SECRET=test_integrity_...

# Email
RESEND_API_KEY=
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_WOMPI_PUBLIC_KEY=pub_test_...
NEXT_PUBLIC_WHATSAPP_PHONE=57XXXXXXXXXX
```

---

## Estructura

```
kame.colStore/
├── apps/
│   ├── catalog/          # Productos, variantes, categorías, InventoryPool
│   ├── orders/           # Checkout, órdenes, integración Wompi
│   │   └── services/     # Lógica de negocio (cart, stock, shipping, wompi)
│   ├── customers/        # Modelo de cliente
│   └── notifications/    # Emails transaccionales (Resend)
├── config/               # settings.py, urls.py
├── templates/
│   ├── admin/            # Overrides del admin Django
│   └── emails/           # Templates HTML de emails
├── frontend/
│   ├── app/
│   │   ├── catalogo/     # Listado de productos
│   │   ├── producto/     # Detalle de producto (PDP)
│   │   └── checkout/     # Flujo de compra + página de resultado
│   ├── components/       # Componentes React (product, cart, ui)
│   ├── lib/              # Cliente API, helpers de Wompi, normalización
│   ├── store/            # Estado global (Zustand)
│   └── types/            # Tipos TypeScript canónicos
└── tests/
    └── e2e/              # Tests Playwright (checkout, cart, product, navigation)
```

---

## Arquitectura

### Stock — `InventoryPool`

El stock no se lee de `ProductVariant.stock`. `InventoryPool` es la fuente única — los serializers y la validación de checkout lo consultan exclusivamente.

### Carrito

100% cliente (Zustand + `localStorage`). Django no tiene estado de carrito. El frontend envía el snapshot al crear la orden; el backend revalida stock y recalcula precios.

### Flujo de compra

```
Cliente → checkout → orden PENDING_PAYMENT
       → Widget Wompi (firma de integridad desde backend)
       → Pago aprobado → webhook → PAID + stock descontado + email
                       → Pago rechazado → CANCELLED
```

### Admin

Requiere **2FA** para todos los usuarios staff. Configurar en `/account/two-factor/setup/` tras crear el superusuario. Compatible con Google Authenticator, Authy y similares.

---

## Tests E2E

```bash
# Local (requiere Django en :8000 y Next.js en :3000)
cd tests && npx playwright test

# Simular CI
cd frontend && npm run build
cd ../tests && CI=true npx playwright test
```

---

## Envíos (Servientrega)

| Destino | Costo |
|---|---|
| Bogotá D.C. | $10.000 COP |
| Nacional | $20.000 COP |
| Pedidos desde $170.000 | Gratis |

---

## Troubleshooting

**`ECONNREFUSED :8000`** — Django no está corriendo.  
**`SECRET_KEY not found`** — Crear `.env` con `DJANGO_SECRET_KEY`.  
**Webhook Wompi 404 en local** — Exponer con `ngrok http 8000` y agregar el dominio a `DJANGO_ALLOWED_HOSTS`.
```