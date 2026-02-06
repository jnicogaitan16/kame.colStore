# Kame.col Store – Frontend (Next.js)

Frontend público mobile-first: Next.js 14, Tailwind, Swiper, Zustand.

## Stack

- **Next.js 14** (App Router) + **Tailwind CSS**
- **Swiper** – galería en detalle de producto
- **Zustand** – carrito + persist en `localStorage`
- **React Hook Form + Zod** – previsto para checkout

## Requisitos

- Node 18+
- Backend Django con API en `http://127.0.0.1:8000` (o configurar `NEXT_PUBLIC_API_URL`)

## Configuración

1. Instalar dependencias:

   ```bash
   cd frontend && npm install
   ```

2. Crear `.env.local` en la raíz de `frontend/`:

   ```env
   NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
   ```

   Si el backend corre en otro host/puerto, ajusta la URL (sin trailing slash).

## Desarrollo

```bash
 npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Asegúrate de que el backend Django esté corriendo para que la API responda.

## Páginas MVP

- **/** – Home (hero, categorías, destacados)
- **/categoria/[slug]** – Listado por categoría
- **/producto/[slug]** – Detalle con galería (Swiper), variantes (talla/color), “Agregar al carrito”
- Mini-cart en drawer (botón en header)
- **/checkout** – Placeholder (formulario en siguiente iteración)

## Build

```bash
npm run build
npm start
```
