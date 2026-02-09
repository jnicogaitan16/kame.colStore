# Kame.colStore

Sistema de gestión de tienda en línea desarrollado con Django para la venta de productos personalizados (camisetas, hoodies, mugs, cuadros, etc.).

## 🚀 Características

- **Gestión de Catálogo**: Productos con variantes (tallas, colores, tipos)
- **Sistema de Pedidos**: Checkout completo con validación de stock
- **Gestión de Clientes**: Registro y seguimiento de clientes
- **Cálculo de Envío**: Sistema de envío con envío gratis a partir de cierto monto
- **Admin Django**: Interfaz administrativa completa y personalizada
- **Validación de Stock**: Control de inventario por variante de producto

## ⚡ Comandos rápidos (TL;DR)

### Backend (Django)
```bash
# Activar entorno virtual
source .venv/bin/activate

# Levantar backend
python manage.py runserver
```

### Migraciones
```bash
python manage.py makemigrations
python manage.py migrate
```

### Frontend (Next.js)

⚠️ **Importante**: Este proyecto usa **Next.js 14**, que requiere **Node.js 18 o superior**.  
Si usas Node 16, `npm install` mostrará warnings de engine y `next` no se instalará correctamente
(lo que provoca el error `sh: next: command not found`).

```bash
cd frontend
npm install
npm run dev
```

### Detener servidores
```bash
Ctrl + C
```

## 📋 Requisitos

- Python 3.10+
- Django 6.0+
- Node.js **18+ (recomendado Node 20)**
- npm 9+
- SQLite (desarrollo) / PostgreSQL (producción recomendado)

## 🔧 Instalación

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd kame.colStore
```

### 2. Crear entorno virtual

```bash
python -m venv .venv
source .venv/bin/activate  # En Windows: .venv\Scripts\activate
```

### 3. Instalar dependencias

```bash
pip install -r requirements/base.txt
```

### 4. Configurar variables de entorno

Crear archivo `.env` en la raíz del proyecto:

```env
DJANGO_SECRET_KEY=tu-clave-secreta-aqui-genera-una-nueva
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
```

**⚠️ Importante**: Genera una nueva `SECRET_KEY` para producción. Puedes usar:

```python
from django.core.management.utils import get_random_secret_key
print(get_random_secret_key())
```

### 5. Aplicar migraciones

```bash
python manage.py migrate
```

### 6. Crear superusuario (opcional)

```bash
python manage.py createsuperuser
```

### 7. Ejecutar servidor de desarrollo

```bash
python manage.py runserver
```

El sitio estará disponible en `http://127.0.0.1:8000/`

## 🟢 Node.js Version

Este proyecto ha sido probado con:

- Node.js 20.x ✅ (recomendado)
- Node.js 18.x ✅ (compatible)

Se recomienda usar **nvm** para manejar versiones de Node:

```bash
nvm install 20
nvm use 20
nvm alias default 20
```

## 📁 Estructura del Proyecto

```
kame.colStore/
├── apps/
│   ├── catalog/          # Gestión de productos y categorías
│   ├── customers/        # Gestión de clientes
│   └── orders/          # Sistema de pedidos
│       ├── services/     # Lógica de negocio
│       │   ├── __init__.py
│       │   └── shipping.py
│       ├── static/       # Archivos estáticos (JS)
│       └── templates/    # Plantillas HTML
├── config/              # Configuración del proyecto
├── templates/           # Plantillas globales
├── requirements/        # Dependencias
└── manage.py
```

## 🏗️ Arquitectura

### Separación de Responsabilidades

- **Modelos** (`models.py`): Definición de datos y métodos básicos
- **Servicios** (`services/`): Lógica de negocio centralizada
- **Vistas** (`views.py`): Coordinación de requests/responses
- **Admin** (`admin.py`): Interfaz administrativa personalizada

### Servicios Principales

- `validate_cart()`: Valida carrito y calcula subtotal
- `get_or_create_customer_from_form_data()`: Gestión de clientes
- `create_order_from_cart()`: Creación de órdenes
- `confirm_order_payment()`: Confirmación de pago y descuento de stock
- `validate_and_prepare_order_item()`: Validación de items de orden

## 🔐 Seguridad

- Variables de entorno para configuración sensible
- Validación de stock antes de crear órdenes
- Transacciones atómicas para operaciones críticas
- Manejo robusto de errores de integridad (cédulas/emails duplicados)
- CSRF protection en endpoints sensibles

## 📊 Modelos Principales

### Product
- Categoría, nombre, descripción, precio
- Stock global (para productos sin variantes)
- Stock por variante (ProductVariant)

### ProductVariant
- Tipo de variante (talla, medida, tipo de mug)
- Valor y color (para productos de vestimenta)
- Stock individual por variante

### Order
- Estado: PENDING_PAYMENT, CREATED, PAID, CANCELLED, REFUNDED
- Información de cliente y envío (snapshot)
- Totales calculados automáticamente

### Customer
- Información de contacto
- Cédula única (validación de formato)
- Email único

## 🛠️ Comandos Útiles

### Desarrollo

```bash
# Crear migraciones
python manage.py makemigrations

# Aplicar migraciones
python manage.py migrate

# Ejecutar servidor
python manage.py runserver

# Shell de Django
python manage.py shell
```

### Producción

```bash
# Recolectar archivos estáticos
python manage.py collectstatic --noinput

# Verificar configuración
python manage.py check --deploy
```

## 📝 Notas de Desarrollo

### Variantes de Productos

El sistema soporta diferentes tipos de variantes según la categoría:

- **Camisetas/Hoodies**: Requieren talla (S/M/L/XL/2XL) y color
- **Cuadros**: Requieren medida (ej: "30x40")
- **Mugs**: Requieren tipo (ej: "MAGICO")
- **Otros**: Texto libre

### Cálculo de Envío

- Envío gratis a partir de $150,000 COP
- Bogotá D.C.: $10,000 COP
- Nacional: $20,000 COP

### Validación de Stock

- Se valida stock antes de crear la orden
- Se usa `select_for_update()` para evitar condiciones de carrera
- El stock se descuenta solo cuando se confirma el pago

## 🐛 Troubleshooting

### Error: "cannot import name 'validate_cart'"

Asegúrate de que el archivo `apps/orders/services/__init__.py` existe y contiene todas las funciones de servicio.

### Error: "SECRET_KEY not found"

Crea el archivo `.env` en la raíz del proyecto con las variables de entorno necesarias.

### Error de migraciones

```bash
python manage.py makemigrations
python manage.py migrate
```

## 📄 Licencia

[Especificar licencia si aplica]

## 👥 Contribuidores

[Agregar información de contribuidores]

## 📞 Soporte

[Agregar información de contacto/soporte]
