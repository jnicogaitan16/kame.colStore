## 🚀 Kame.col

[![Django](https://img.shields.io/badge/backend-Django%205.2-green)]()
[![Next.js](https://img.shields.io/badge/frontend-Next.js%2014-black)]()
[![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL-blue)]()
[![Status](https://img.shields.io/badge/status-MVP%20Ready-success)]()
[![License](https://img.shields.io/badge/license-Restricted-orange)]()

## 🌐 Live Product

👕 **https://www.kamecol.com/**

Tienda virtual de ropa streetwear (**Kame.col**) con arquitectura moderna:  
**Backend Django + API REST + Frontend Next.js + Admin interno + Analytics + Tracking propio**


## ✨ Features

- 🛒 E-commerce completo (catálogo, carrito, checkout)
- 💳 Integración con **Wompi** (pagos + webhooks)
- 📦 Gestión de órdenes (PENDING → PAID → SHIPPED)
- 📊 Panel admin interno (dashboard, órdenes, inventario, clientes)
- 📈 Analytics + tracking de comportamiento (eventos reales)
- 🧠 Sistema de inventario robusto (`InventoryPool`)
- 🔐 Autenticación segura + soporte 2FA
- 📧 Emails transaccionales (Resend)
- 🧪 Tests E2E con Playwright


## 🧱 Tech Stack

| Layer | Tech |
|------|------|
| Backend | Django 5.2 + DRF |
| Frontend | Next.js 14 (App Router) |
| Database | PostgreSQL |
| State | Zustand |
| Styling | Tailwind CSS |
| Payments | Wompi |
| Emails | Resend |
| Testing | Playwright |
| Observabilidad | Sentry |


## 📸 Screenshots

### 🏠 Storefront
![Storefront](./docs/screenshots/storefront.png)

### 🛒 Checkout
![Checkout](./docs/screenshots/checkout.png)

### 📊 Admin Dashboard
![Dashboard](./docs/screenshots/admin-dashboard.png)

### 📦 Orders Management
![Orders](./docs/screenshots/orders.png)


## ⚡ Quick Start

### 1. Backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements/base.txt

Crear .env:

DJANGO_SECRET_KEY=
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

DB_NAME=kamecol_dev
DB_USER=tu_usuario
DB_PASSWORD=tu_password
DB_HOST=localhost
DB_PORT=5432

WOMPI_PUBLIC_KEY=pub_test_...
WOMPI_PRIVATE_KEY=prv_test_...
WOMPI_EVENTS_SECRET=...
WOMPI_INTEGRITY_SECRET=...

RESEND_API_KEY=

Configurar DB:

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME"),
        "USER": os.getenv("DB_USER"),
        "PASSWORD": os.getenv("DB_PASSWORD"),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}

Run:

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Observabilidad (Sentry) y ambientes

**Environment:** `DJANGO_ENV` (Django) y `NEXT_PUBLIC_ENV` o `NEXT_PUBLIC_DJANGO_ENV` (Next; si no hay, usa `NODE_ENV`). Local: `development`; producción: `production`. Backend y frontend usan **DSN distintos** (un proyecto Sentry por app). Sin **`SENTRY_DSN`** en el `.env` raíz, Django no inicializa Sentry.

**Dónde ver cada error:** el shell de Django envía al proyecto ligado a **`SENTRY_DSN`** (backend). El navegador envía al de **`NEXT_PUBLIC_SENTRY_DSN`** (frontend). En Sentry elegí el proyecto correcto en el selector; si solo abrís el del front, no verás los del back.

**Filtro “Environment” en Issues (frontend):** el SDK ya envía `environment` en cada evento. Si el desplegable del proyecto *kamecol-frontend* sigue vacío, revisá **Project Settings → Environments** (entornos ocultos) y/o filtrá con `environment:development` en la búsqueda. Opcional en Vercel: **`NEXT_PUBLIC_SENTRY_RELEASE`** o **`NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`** (commit del build) para `release` en Sentry y mejor correlación.

**No commitees** `.env`, `frontend/.env.local` ni el token de Sentry. DSN: **Sentry → Project → Client Keys**. Token de source maps (`SENTRY_AUTH_TOKEN`): **Settings → Auth Tokens** — en local conviene ponerlo en **`frontend/.env.local`** (no uses un archivo aparte; Next lo carga en `next build`).

**Render (backend, producción)**

```text
SENTRY_DSN=<DSN backend>
DJANGO_ENV=production
```

**Vercel (frontend, producción)**

```text
NEXT_PUBLIC_SENTRY_DSN=<DSN frontend>
NEXT_PUBLIC_ENV=production
SENTRY_AUTH_TOKEN=<token para source maps en build>
```

**Local:** `.env` → `SENTRY_DSN`, `DJANGO_ENV=development`. `frontend/.env.local` → `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_ENV=development`, y si compilás con Sentry en prod: `SENTRY_AUTH_TOKEN=...`.

**Probar backend (recomendado antes de prod):** `python manage.py verify_sentry` — envía un error de prueba y hace `flush`; falla si falta `SENTRY_DSN`. Opciones: `--timeout 15`, o `SENTRY_DEBUG=1 python manage.py verify_sentry` si no ves el evento en Sentry (proyecto del DSN backend, ventana 24h).

**Probar a mano:** `python manage.py shell` → `import sentry_sdk; sentry_sdk.capture_exception(Exception("test backend")); sentry_sdk.flush(timeout=5)` (sin `flush` el evento puede no salir antes de cerrar el shell). En el navegador (storefront, no solo `/admin`): `__KAME_SENTRY_TEST__.captureException(new Error("test front"))` y opcionalmente `await __KAME_SENTRY_TEST__.flush(5000)`. En dev el front usa `/api/sentry-tunnel`.

⸻

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

- Backend → http://localhost:8000
- Frontend → http://localhost:3000

⸻

🧠 Arquitectura

🔹 Inventory System
	•	InventoryPool es la única fuente de verdad
	•	Evita inconsistencias entre variantes

🔹 Cart System
	•	100% frontend (Zustand + localStorage)
	•	Backend revalida stock y precios

🔹 Checkout Flow

User → Checkout → Order (PENDING_PAYMENT)
     → Wompi Widget
     → Webhook
         → PAID → stock ↓ + email
         → FAILED → cancel

🔹 Tracking System

Eventos capturados:
	•	product_view
	•	add_to_cart
	•	checkout_start
	•	purchase_complete

Batch + sendBeacon para performance óptima

⸻

🧪 Testing

cd tests
npx playwright test

Incluye:
	•	Checkout flow
	•	Carrito
	•	Navegación
	•	Validaciones críticas

⸻

📦 Estructura

kame.colStore/
├── apps/
│   ├── catalog/
│   ├── orders/
│   ├── customers/
│   └── notifications/
├── config/
├── frontend/
├── templates/
└── tests/


⸻

🚚 Shipping Rules

Región	Costo
Bogotá	$14.900 COP
Nacional	$24.900 COP
+$170.000	Gratis


⸻

⚠️ Troubleshooting
	•	**502 / `Failed to reach backend` en `/api/...`** → Tener `DJANGO_API_BASE` en `frontend/.env.local` **no basta**: el proxy intenta conectar a esa URL y falla si Django no está levantado o el host/puerto no coincide. Arranca el API (`python manage.py runserver`, suele ser `http://127.0.0.1:8000`) y reinicia `npm run dev` si cambiaste el env.
	•	ECONNREFUSED :8000 → Backend no corriendo (misma causa que arriba)
	•	SECRET_KEY not found → Revisar .env
	•	Webhooks Wompi → usar ngrok http 8000
	•	Fuentes `/_next/static/media/*.woff2` 404 en dev → borrar `frontend/.next` y volver a ejecutar `npm run dev`

⸻

📌 Roadmap
	•	Integración con couriers (API real)
	•	Panel de promociones
	•	Recomendaciones de productos
	•	CI/CD pipeline
	•	Observabilidad ampliada (métricas, alertas)

⸻

👨‍💻 Author

Nicolás Gaitán
QA Engineer | Backend | E-commerce Builder

⸻

⭐ Contribuciones

PRs y feedback son bienvenidos.

---

## 🧪 Testing E2E (Playwright)

Los comandos y el detalle (cobertura por spec, Wompi sandbox, `.env.test`) están en **`tests/README.md`**. Visión de producto, riesgos y plan de pagos/correos: **`TECH_DEBT_AND_ROADMAP.md`**.

```bash
cd tests && npm ci && npx playwright install chromium
CI=true npx playwright test
```