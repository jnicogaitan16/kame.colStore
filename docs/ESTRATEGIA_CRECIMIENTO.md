# Kame.col — Estrategia de Crecimiento y Captacion de Clientes

> Creado: 2026-08-27. Contexto: tienda funcionando, descuentos activos, pero sin trafico organico ni conversiones.

---

## Diagnostico actual (actualizado 2026-08-27)

### Lo que tienes (mas de lo que parece)

**Storefront:**
- Tienda custom (Django + Next.js) con checkout completo, pagos Wompi (6 metodos), emails transaccionales
- Sistema de descuentos configurable (por tienda, departamento, categoria, producto) con vigencia por fechas
- Zoom fullscreen estilo Instagram en PDP mobile
- Auto-sync de variantes desde InventoryPool

**Admin panel completo (Next.js):**
- **Dashboard:** ventas totales, ticket promedio, conversion rate, revenue en riesgo, ventas diarias, top 5 productos, embudo de conversion, ordenes recientes
- **Analitica:** embudo completo (vista → click → cart → checkout → compra), rendimiento por producto (vistas, clics, conv. %, CTR), actividad diaria, mix de eventos, checkout steps detallados, 37 sesiones unicas rastreadas
- **Recuperacion:** listado de ordenes pendientes de pago con envio de email de recordatorio individual o masivo (rate limit 24h), template HTML con WhatsApp fallback
- **Ordenes:** filtros por estado/fecha/busqueda, acciones (enviar, cancelar, recordatorio), historial de status
- **Clientes:** CRM con LTV, frecuencia de compra, historial de ordenes, top productos comprados, edicion de perfil
- **Catalogo:** CRUD productos, variantes, categorias, departamentos, inventario, homepage banners/promos/secciones, descuentos

**Tracking de eventos (custom, ya funcional):**
- 8 tipos de eventos: home_visit, product_view, product_click, add_to_cart, checkout_start, checkout_step, purchase_complete, cart_abandon
- Session tracking por tab (UUID), batching cada 5s, beacon on unload
- Checkout steps granulares: formulario, ciudad envio, orden lista, widget Wompi abierto

### Lo que falta

- **Google no te encuentra.** No hay robots.txt, sitemap ni Schema.org — probablemente no indexa tus productos.
- **No sabes DE DONDE vienen las visitas.** Tu analitica mide QUE hacen dentro de la tienda, pero no de donde llegaron (Google, Instagram, WhatsApp, directo). Sin GA4, no puedes atribuir trafico a fuente.
- **No puedes hacer retargeting.** Sin Meta Pixel, no puedes mostrar ads a personas que visitaron pero no compraron.
- **Falta confianza visual.** Sin logos de medios de pago, sin garantias visibles en checkout/PDP.

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

**Impacto:** Ya sabes QUE hacen los visitantes (gracias al tracking interno). Ahora sabras DE DONDE vienen y podras hacer retargeting. Sin esto, cualquier inversion en ads es a ciegas.

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

## Ventajas competitivas que ya tienes (y debes explotar)

| Capacidad | Como usarla para crecer |
|-----------|------------------------|
| Embudo de conversion con checkout steps | Identifica DONDE pierdes clientes: si 96% clickea pero solo 15% agrega al carrito, el problema es el PDP, no el trafico |
| Recuperacion de pagos pendientes | Activa recordatorios masivos cada 24h — cada orden recuperada es venta directa sin costo de adquisicion |
| Rendimiento por producto (conv. %, CTR) | Prioriza los productos con alto CTR + baja conversion para mejorar sus fotos/descripcion. Los de alta conversion van a ads |
| Revenue en riesgo (dashboard) | Monitorea diario — cada peso en pendiente es dinero que puedes recuperar con un email o WhatsApp |
| Descuentos por departamento | Usa para campanas estacionales (Dia de la Mujer → depto Mujer 15%. Black Friday → store_wide 20%) |
| CRM con LTV | Identifica tus mejores clientes para descuentos exclusivos o acceso anticipado a nuevos diseños |

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

## Plan de Ejecucion por Sprints

### Sprint G1 — SEO Fundacional (ser visible en Google)

**Rama:** `feature/seo-foundation`
**Tiempo estimado:** 3-4 horas
**Sin esto, nada mas funciona.**

#### G1.1 — robots.txt

**Skill:** `/dev` + `/seo-marketing`
**Archivo:** `frontend/app/robots.ts`

Crear archivo `robots.ts` con las reglas:
- Allow: `/`, `/producto/`, `/catalogo`, `/categoria/`
- Disallow: `/admin/`, `/api/`, `/checkout/`, `/health`
- Sitemap: `https://www.kamecol.com/sitemap.xml`

**Verificacion:**
- [ ] `curl https://www.kamecol.com/robots.txt` retorna las reglas
- [ ] Google Search Console puede leer el robots.txt

#### G1.2 — Sitemap dinamico

**Skill:** `/dev` + `/seo-marketing` + `/dba`
**Archivo:** `frontend/app/sitemap.ts`

Generar sitemap XML dinamico que incluya:
- Homepage (`/`)
- Catalogo (`/catalogo`)
- Todas las categorias activas (`/categoria/{slug}`)
- Todos los productos activos (`/producto/{slug}`)
- Legal (`/legal/politica-de-privacidad`)

Para obtener productos y categorias, fetch desde Django API (`/api/products/` y `/api/categories/`) con `changeFrequency` y `priority`:
- Homepage: priority 1.0, changefreq daily
- Productos: priority 0.8, changefreq weekly
- Categorias: priority 0.7, changefreq weekly
- Legal: priority 0.3, changefreq yearly

**Verificacion:**
- [ ] `curl https://www.kamecol.com/sitemap.xml` retorna XML valido
- [ ] Contiene URLs de todos los productos activos
- [ ] Validar con https://www.xml-sitemaps.com/validate-xml-sitemap.html

#### G1.3 — Schema.org Product JSON-LD

**Skill:** `/dev` + `/seo-marketing`
**Archivo:** `frontend/app/producto/[slug]/page.tsx`

Agregar `<script type="application/ld+json">` en el PDP con:
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "...",
  "description": "...",
  "image": "...",
  "brand": { "@type": "Brand", "name": "Kame.col" },
  "offers": {
    "@type": "Offer",
    "price": "...",
    "priceCurrency": "COP",
    "availability": "https://schema.org/InStock | OutOfStock",
    "url": "https://www.kamecol.com/producto/{slug}"
  }
}
```

Si el producto tiene descuento, agregar `offers.priceValidUntil` y `offers.discount`.

**Verificacion:**
- [ ] Validar con https://search.google.com/test/rich-results
- [ ] Google muestra precio en COP en resultados de busqueda

#### G1.4 — Metadata en paginas de categoria y homepage

**Skill:** `/dev`
**Archivos:** `frontend/app/categoria/[slug]/page.tsx`, `frontend/app/page.tsx`

**Categoria:** Agregar `generateMetadata` con:
- Title: `{Categoria} | Kame.col`
- Description: `Explora nuestra coleccion de {categoria}. Envios a toda Colombia.`
- OpenGraph image: imagen del primer producto de la categoria

**Homepage:** Agregar `export const metadata` con:
- Title: `Kame.col — Streetwear Colombiano`
- Description: orientada a busqueda local ("ropa urbana bogota", "streetwear colombia")

**Verificacion:**
- [ ] View source en cada pagina muestra og:title, og:description, og:image correctos
- [ ] Compartir URL de categoria en WhatsApp muestra preview correcto

#### G1.5 — Google Search Console (manual)

**Skill:** `/seo-marketing`
**No requiere codigo — configuracion manual.**

1. Ir a https://search.google.com/search-console
2. Agregar propiedad `https://www.kamecol.com`
3. Verificar via DNS TXT record o meta tag
4. Enviar sitemap: `https://www.kamecol.com/sitemap.xml`
5. Solicitar indexacion de homepage y paginas principales

**Verificacion:**
- [ ] Propiedad verificada
- [ ] Sitemap enviado y procesado
- [ ] Monitorear errores de indexacion en 48h

---

### Sprint G2 — Atribucion de trafico (saber DE DONDE vienen)

**Rama:** `feature/analytics-tracking`
**Tiempo estimado:** 2-3 horas
**Prerequisito:** Crear cuentas de GA4 y Meta Business antes de empezar.

**Nota:** Ya tenemos tracking interno completo (8 tipos de eventos, embudo, rendimiento por producto). Lo que falta es saber la FUENTE del trafico (Google vs Instagram vs directo) y habilitar retargeting. GA4 y Meta Pixel se agregan como BRIDGE sobre el tracker existente (`frontend/lib/tracker.ts`), no como reemplazo.

#### G2.1 — Google Analytics 4

**Skill:** `/dev` + `/campaign-manager`
**Archivos:** `frontend/app/layout.tsx`, nuevo `frontend/components/analytics/GoogleAnalytics.tsx`

Implementar GA4 con gtag.js:
- Cargar script de gtag.js via `next/script` con strategy `afterInteractive`
- ID de medicion via `NEXT_PUBLIC_GA_MEASUREMENT_ID` env var
- Solo cargar en produccion (`process.env.NODE_ENV === 'production'`)

**Eventos ecommerce a configurar (estandar GA4):**

| Evento | Donde | Datos |
|--------|-------|-------|
| `page_view` | Automatico por gtag | — |
| `view_item` | PDP load | item_id, item_name, price, currency: COP |
| `add_to_cart` | Click "Agregar al carrito" | item_id, item_name, price, quantity |
| `begin_checkout` | Acceso a /checkout | items, value, currency |
| `purchase` | Pagina resultado exitoso | transaction_id, value, items, shipping |

**Verificacion:**
- [ ] GA4 Real-Time muestra visitas
- [ ] Eventos de ecommerce llegan a GA4 > Events
- [ ] No se carga en desarrollo (localhost)

#### G2.2 — Meta Pixel (Facebook/Instagram)

**Skill:** `/dev` + `/campaign-manager`
**Archivos:** `frontend/app/layout.tsx`, nuevo `frontend/components/analytics/MetaPixel.tsx`

Implementar Meta Pixel:
- Script via `next/script` con strategy `afterInteractive`
- Pixel ID via `NEXT_PUBLIC_META_PIXEL_ID` env var
- Solo produccion

**Eventos a enviar:**

| Evento Meta | Cuando | Datos |
|-------------|--------|-------|
| `PageView` | Cada pagina | Automatico |
| `ViewContent` | PDP load | content_ids, content_type: product, value, currency: COP |
| `AddToCart` | Click agregar | content_ids, content_type: product, value |
| `InitiateCheckout` | Acceso a /checkout | content_ids, num_items, value |
| `Purchase` | Compra exitosa | content_ids, value, currency: COP |

**Verificacion:**
- [ ] Meta Pixel Helper (extension Chrome) detecta el pixel
- [ ] Eventos aparecen en Meta Events Manager > Test Events
- [ ] No se dispara en desarrollo

#### G2.3 — Bridge: tracker existente → GA4 + Pixel

**Skill:** `/dev`
**Archivo:** `frontend/lib/tracker.ts`, `frontend/hooks/useTracking.ts`

El tracker custom (`KameTracker`) ya captura 8 tipos de eventos con batching, session tracking y beacon. El bridge agrega disparo paralelo a GA4 y Meta Pixel sin modificar la logica existente.

**Mapeo de eventos:**

| Evento interno (tracker.ts) | GA4 (gtag) | Meta Pixel (fbq) |
|------------------------------|-----------|-----------------|
| `product_view` | `view_item` | `ViewContent` |
| `product_click` | `select_item` | — |
| `add_to_cart` | `add_to_cart` | `AddToCart` |
| `checkout_start` | `begin_checkout` | `InitiateCheckout` |
| `purchase_complete` | `purchase` | `Purchase` |
| `home_visit` | — (page_view automatico) | — (PageView automatico) |

**Implementacion:** Agregar funcion `emitToExternalAnalytics(event, data)` que se llama desde los hooks de tracking existentes (`useTracking.ts`). No modificar la clase `KameTracker` — el bridge vive en el hook layer.

**Verificacion:**
- [ ] Un solo `addToCart` dispara: API interna + gtag + fbq
- [ ] Datos consistentes entre los 3 destinos
- [ ] purchase_complete envia transaction_id y value a GA4 y Pixel

---

### Sprint G3 — Trust Signals y Conversion (generar confianza)

**Rama:** `feature/trust-signals`
**Tiempo estimado:** 3-4 horas

#### G3.1 — Logos de medios de pago en footer

**Skill:** `/dev` + `/product-designer`
**Archivos:** `frontend/components/layout/Footer.tsx` (o donde este el footer)

Agregar seccion "Medios de pago" con logos de:
- Visa, Mastercard (iconos SVG o PNG pequenos)
- Nequi, PSE, Daviplata, Bancolombia
- Logo Wompi como procesador

Estilo: iconos en gris (monocromo) sobre fondo claro, tamaño 28-36px. Texto: "Pagos seguros procesados por Wompi".

Los iconos SVG de medios de pago se pueden obtener de:
- Wompi docs (proveen kit de marca)
- https://simpleicons.org/ (Visa, Mastercard)
- Logos oficiales de Nequi, PSE, Daviplata (publicos)

**Verificacion:**
- [ ] Logos visibles en footer de toda la tienda
- [ ] Se ven bien en mobile y desktop
- [ ] No afectan performance (SVG inline o sprites)

#### G3.2 — Trust badges en checkout

**Skill:** `/dev` + `/product-designer` + `/sales-optimizer`
**Archivo:** `frontend/app/checkout/CheckoutClient.tsx`

Agregar antes del boton de pago:
- Icono de candado + "Pago seguro"
- Logos de medios de pago (version compacta)
- "Procesado por Wompi" con logo

**Verificacion:**
- [ ] Visible en mobile antes de scrollear al boton de pago
- [ ] No interfiere con el flujo de checkout

#### G3.3 — Politica de devoluciones

**Skill:** `/dev` + `/customer-experience`
**Archivos:** `frontend/app/legal/devoluciones/page.tsx` (nueva pagina), footer

Crear pagina `/legal/devoluciones` con politica clara:
- Plazo de devolucion (ej: 5 dias habiles)
- Condiciones (producto sin uso, con etiqueta)
- Proceso (contactar via WhatsApp)

Agregar link en footer y en PDP (debajo del boton "Agregar al carrito").

**Verificacion:**
- [ ] Pagina accesible desde footer
- [ ] Link visible en PDP
- [ ] Texto claro y sin jerga legal excesiva

#### G3.4 — Texto de envio y garantias en PDP

**Skill:** `/dev` + `/product-designer`
**Archivo:** `frontend/app/producto/[slug]/ProductDetailClient.tsx`

Agregar debajo de los botones de compra:
- "Envios a toda Colombia"
- "Envio gratis en compras desde $170.000"
- "Cambios y devoluciones en 5 dias"

Iconos pequenos (camion, escudo, reloj) + texto en gris. No llamativo, solo informativo.

**Verificacion:**
- [ ] Visible en PDP mobile sin scroll excesivo
- [ ] Threshold de envio gratis coincide con `FREE_SHIPPING_THRESHOLD` del backend

---

### Sprint G4 — Google Shopping + Preparacion para Ads

**Rama:** Sin rama — configuracion manual en plataformas externas.
**Tiempo estimado:** 2-3 horas
**Prerequisito:** Sprints G1 y G2 completados y en produccion.

#### G4.1 — Google Merchant Center

**Skill:** `/seo-marketing` + `/campaign-manager`
**No requiere codigo.**

1. Crear cuenta en https://merchants.google.com
2. Verificar dominio (ya hecho si Search Console esta configurado)
3. Subir feed de productos:
   - Opcion A: URL del sitemap + Schema.org (Google lo extrae automaticamente)
   - Opcion B: Feed XML/CSV manual con productos
4. Configurar envio (Colombia, tarifas fijas)
5. Esperar aprobacion (1-3 dias)

**Resultado:** productos de kamecol.com aparecen en Google Shopping **gratis** (tab Shopping).

#### G4.2 — Preparar audiencias para ads

**Skill:** `/campaign-manager` + `/strategist`
**No requiere codigo.**

Configurar en Meta Business Manager:
- Audiencia personalizada: visitantes del sitio (ultimos 30 dias) — requiere Meta Pixel activo
- Audiencia lookalike: personas similares a visitantes
- Audiencia por intereses: moda urbana, streetwear, Bogota, 18-35 anos

Configurar en Google Ads:
- Audiencia de remarketing: visitantes del sitio (requiere GA4 activo)
- Keywords research: "camiseta oversize bogota", "ropa streetwear colombia", "comprar ropa urbana"

#### G4.3 — Primer campaña Instagram Ads ($80-100K COP)

**Skill:** `/campaign-manager`
**No requiere codigo.**

Campaña de trafico con:
- Objetivo: trafico al sitio
- Audiencia: mujeres 18-35, Bogota, intereses moda/streetwear
- Creative: foto real de producto con descuento + texto corto
- CTA: "Ver coleccion"
- Duracion: 7 dias
- Presupuesto: $12-15K COP/dia

**Verificacion:**
- [ ] GA4 muestra trafico desde instagram.com
- [ ] Meta Events Manager muestra conversiones
- [ ] Costo por click < $500 COP

---

## Resumen de Sprints

| Sprint | Foco | Tiempo | Impacto |
|--------|------|--------|---------|
| **G1** | SEO fundacional (robots, sitemap, schema, metadata) | 3-4h | Google empieza a indexar — base de todo |
| **G2** | Analytics (GA4, Meta Pixel, eventos ecommerce) | 2-3h | Mides todo — base para optimizar |
| **G3** | Trust signals (logos pago, garantias, devoluciones) | 3-4h | Mas confianza → mas conversion |
| **G4** | Google Shopping + primer campaña ads | 2-3h | Primeros clientes pagados + shopping gratis |

**Orden obligatorio:** G1 → G2 → G3 → G4. Cada sprint desbloquea el siguiente.

---

*Este documento es una guia viva. Actualizar con resultados reales cada 2 semanas.*
