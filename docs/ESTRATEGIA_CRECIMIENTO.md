# Kame.col — Estrategia de Crecimiento y Captacion de Clientes

> Creado: 2026-08-27. Contexto: tienda funcionando, descuentos activos, pero sin trafico organico ni conversiones.

---

## Diagnostico actual

### Lo que tienes

- Producto solido: tienda custom con checkout, pagos Wompi, descuentos, zoom, emails
- Dominio activo: kamecol.com
- Redes: LinkedIn (awareness tecnico), intentos en Instagram
- Descuentos activos para departamento Mujer (10%)

### Lo que te falta

- **Nadie te encuentra en Google.** No hay robots.txt, sitemap, ni Schema.org. Google probablemente no esta indexando tus productos correctamente.
- **No mides nada de marketing.** Sin Google Analytics, sin Meta Pixel. No sabes de donde vienen las visitas ni que hacen.
- **No tienes retargeting.** Alguien entra, ve un producto y se va. No puedes volver a alcanzarlo con un anuncio.
- **No hay trust signals visibles.** Sin logos de medios de pago, sin garantias visibles, sin reviews.

---

## Plan de accion por prioridad

### Fase 0 — Hacer visible la tienda en Google (1-2 dias)

**Sin esto, nada mas funciona.** Google necesita poder rastrear e indexar tus productos.

| Tarea | Detalle |
|-------|---------|
| Crear `robots.txt` | Permitir crawling en /, /producto/, /catalogo, /categoria/. Bloquear /admin/, /api/, /checkout/ |
| Crear `sitemap.xml` dinamico | Generar URLs de todos los productos activos, categorias y paginas principales con Next.js `sitemap.ts` |
| Schema.org Product (JSON-LD) | En cada PDP: nombre, precio, moneda COP, disponibilidad, imagen. Google muestra esto como rich result |
| Metadata en paginas de categoria | `app/categoria/[slug]/page.tsx` no tiene `generateMetadata` — Google no sabe que son esas paginas |
| Registrar en Google Search Console | Verificar dominio, enviar sitemap, monitorear indexacion |

**Impacto esperado:** en 2-4 semanas Google empieza a indexar productos. Busquedas como "camiseta oversize bogota" o "ropa streetwear colombia" empiezan a mostrar kamecol.com.

### Fase 1 — Medir para decidir (1 dia)

| Tarea | Detalle |
|-------|---------|
| Google Analytics 4 (GA4) | Script en layout.tsx. Mide trafico, fuentes, paginas vistas, bounce rate |
| Meta Pixel (Facebook/Instagram) | Script en layout.tsx. Permite retargeting y medir conversiones de anuncios |
| Eventos de conversion | Configurar: `view_item`, `add_to_cart`, `begin_checkout`, `purchase` en GA4 y Meta Pixel |

**Impacto:** sabes cuantas personas entran, de donde vienen, que miran y donde abandonan. Sin esto, cualquier inversion en ads es a ciegas.

### Fase 2 — Trust signals y conversion (1-2 dias)

| Tarea | Detalle |
|-------|---------|
| Logos de medios de pago | Visa, Mastercard, Nequi, PSE, Daviplata + logo Wompi. En footer y en checkout |
| Texto de garantia | "Compra segura", "Envios a toda Colombia", "Pago protegido por Wompi" |
| Politica de devoluciones visible | Link en footer y en PDP. Genera confianza para primera compra |
| WhatsApp flotante | Boton visible en todas las paginas para atencion directa |

**Sobre los logos de pago:** SI ayudan. Un estudio de Baymard Institute muestra que el 18% de abandonos de carrito es por falta de confianza en la seguridad del pago. Los logos de Visa/Mastercard/Nequi no son decoracion — son señales de que el pago es seguro. Colocarlos en:
- Footer de toda la tienda
- Seccion de resumen en checkout (antes del boton de pagar)
- Opcionalmente en el PDP debajo del boton "Agregar al carrito"

### Fase 3 — Contenido que atrae (continuo)

| Canal | Estrategia |
|-------|-----------|
| Instagram | Publicar 3-4 fotos/reels por semana. Fotos reales de producto, no mockups. Lookbooks, combinaciones, behind-the-scenes. Usar hashtags locales: #ModaBogota #StreetWearColombia #RopaUrbana |
| TikTok | Videos cortos mostrando productos, proceso de empaque, outfits. Tendencia en Colombia para moda |
| Google Shopping (gratis) | Registrar en Google Merchant Center. Tus productos aparecen en la pestaña Shopping de Google sin pagar ads |
| LinkedIn | Dejar de hablar de tecnologia. Hablar del producto, de moda, de emprendimiento. La gente no compra ropa porque esta hecha en Next.js |

### Fase 4 — Primer presupuesto de publicidad ($50-150K COP/semana)

| Canal | Presupuesto | Objetivo |
|-------|------------|----------|
| Instagram Ads | $80-100K/semana | Trafico al sitio. Audiencia: mujeres 18-35, Bogota, intereses moda urbana |
| Google Ads (Search) | $50-70K/semana | Capturar busquedas de intencion: "comprar camiseta oversize", "ropa streetwear bogota" |

**Importante:** NO gastes en publicidad hasta tener GA4 + Meta Pixel instalados. Sin medicion, no puedes optimizar.

### Fase 5 — Retargeting y email (semana 3+)

| Tarea | Detalle |
|-------|---------|
| Retargeting Meta | Mostrar anuncios a personas que visitaron la tienda pero no compraron |
| Abandoned cart email | Email automatico a clientes que dejaron productos en checkout (requiere capturar email pre-pago) |
| Newsletter | Capturar emails en el sitio (popup o banner). Enviar novedades, descuentos exclusivos |

---

## Quick wins que puedes hacer hoy

1. **Publicar en Instagram** una foto real de un producto con descuento activo. Link en bio a kamecol.com
2. **Compartir en WhatsApp** el link de un producto con descuento a amigos/conocidos. El boca a boca es el canal #1 en Colombia
3. **Pedir a 5 personas** que entren a la tienda y te den feedback honesto (que les confunde, que les falta, por que no comprarian)

---

## Sobre los logos de pago

**Implementacion recomendada:**

```
Footer:
┌──────────────────────────────────────────┐
│  Medios de pago                          │
│  [Visa] [Mastercard] [Nequi] [PSE]      │
│  [Daviplata] [Bancolombia]              │
│  Pagos seguros con Wompi                 │
└──────────────────────────────────────────┘

Checkout (antes del boton pagar):
┌──────────────────────────────────────────┐
│  🔒 Pago seguro                          │
│  [Visa] [MC] [Nequi] [PSE] [Daviplata]  │
│  Procesado por Wompi                     │
└──────────────────────────────────────────┘
```

Los logos son gratuitos de usar (son marcas de los medios de pago). Wompi los provee en su documentacion.

---

## Metricas objetivo (primeros 3 meses)

| Metrica | Meta mes 1 | Meta mes 2 | Meta mes 3 |
|---------|-----------|-----------|-----------|
| Sesiones/mes | 500 | 1.500 | 3.000 |
| Tasa de conversion | 0.5% | 1% | 1.5% |
| Ordenes/mes | 2-3 | 10-15 | 30-45 |
| AOV (ticket promedio) | $70.000 | $80.000 | $85.000 |
| Fuentes de trafico | 80% directo/social | 50% organico, 30% social, 20% ads | 40% organico, 30% ads, 30% social |

---

## Lo que NO hacer

- **No gastes en ads sin medicion.** Primero GA4 + Pixel, despues presupuesto.
- **No publiques mockups en Instagram.** Fotos reales, personas reales, outfits reales.
- **No hables de tecnologia en redes.** A nadie le importa si usas Django o Shopify. Vende el producto, no el stack.
- **No esperes resultados inmediatos.** SEO toma 2-3 meses. Ads toma 2-4 semanas de aprendizaje. El primer mes es de datos, no de ventas.
- **No copies a marcas grandes.** Ellas tienen presupuesto de millones. Tu ventaja es ser cercano, personal, directo por WhatsApp.

---

## Orden de ejecucion tecnico

| # | Tarea | Skill | Esfuerzo | Impacto |
|---|-------|-------|----------|---------|
| 1 | robots.txt + sitemap.ts | `/dev` + `/seo-marketing` | 1 hora | Critico — sin esto Google no indexa |
| 2 | Schema.org Product JSON-LD | `/dev` + `/seo-marketing` | 2 horas | Alto — rich results en Google |
| 3 | Metadata en categoria page | `/dev` | 30 min | Alto — paginas de categoria indexables |
| 4 | Google Analytics 4 | `/dev` + `/campaign-manager` | 1 hora | Critico — base de toda medicion |
| 5 | Meta Pixel | `/dev` + `/campaign-manager` | 1 hora | Alto — retargeting + conversion tracking |
| 6 | Logos de pago en footer/checkout | `/dev` + `/product-designer` | 1 hora | Medio — trust signals |
| 7 | Google Search Console | `/seo-marketing` | 30 min | Alto — monitorear indexacion |
| 8 | Google Merchant Center (Shopping gratis) | `/seo-marketing` | 2 horas | Alto — productos en Google Shopping |

---

*Este documento es una guia viva. Actualizar con resultados reales cada 2 semanas.*
