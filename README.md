## 🚀 Kame.col

[![Django](https://img.shields.io/badge/backend-Django%205.2-green)]()
[![Next.js](https://img.shields.io/badge/frontend-Next.js%2014-black)]()
[![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL-blue)]()
[![Status](https://img.shields.io/badge/status-MVP%20Ready-success)]()
[![License](https://img.shields.io/badge/license-MIT-lightgrey)]()

Tienda virtual de ropa streetwear (**Kame.col**) con arquitectura moderna:  
**Backend Django + API REST + Frontend Next.js + Admin interno + Analytics + Tracking propio**

---

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

---

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

---

## 📸 Screenshots

### 🏠 Storefront
![Storefront](./docs/screenshots/storefront.png)

### 🛒 Checkout
![Checkout](./docs/screenshots/checkout.png)

### 📊 Admin Dashboard
![Dashboard](./docs/screenshots/admin-dashboard.png)

### 📦 Orders Management
![Orders](./docs/screenshots/orders.png)

---

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


⸻

2. Frontend

cd frontend
npm install
npm run dev

	•	Backend → http://localhost:8000
	•	Frontend → http://localhost:3000

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
	•	ECONNREFUSED :8000 → Backend no corriendo
	•	SECRET_KEY not found → Revisar .env
	•	Webhooks Wompi → usar ngrok http 8000

⸻

📌 Roadmap
	•	Integración con couriers (API real)
	•	Panel de promociones
	•	Recomendaciones de productos
	•	CI/CD pipeline
	•	Observabilidad (logs + metrics)

⸻

👨‍💻 Author

Nicolás Gaitán
QA Engineer | Backend | E-commerce Builder

⸻

⭐ Contribuciones

PRs y feedback son bienvenidos.