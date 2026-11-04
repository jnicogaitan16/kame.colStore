# Plan — Borrar `create_order_from_checkout`

| | |
|---|---|
| **Repo** | `kame.colStore` |
| **Rama** | `chore/remove-create-order-from-checkout` |
| **Base** | `main` (`694529b`) |
| **Objetivo** | Eliminar el segundo creador de órdenes (muerto e inseguro) sin tocar el cobro real |
| **Fuera de alcance** | Turnstile, cifrado, webhook timestamp, ambiente DEV, `get_or_create_customer_from_checkout`, carrito Django de sesión |

---

## 1. Qué se cambia (y qué no)

### Se borra

Archivo único: `apps/orders/services/create_order_from_cart.py`

| Símbolo | Líneas actuales | Por qué |
|---|---|---|
| `_normalize_checkout_items` | ~173–326 | Helper privado. Solo lo llama la función muerta. |
| `create_order_from_checkout` | ~329–508 | Nadie la importa. Acepta `unit_price` del cliente. |

También: comentario `# --- Nuevas utilidades para checkout-based order creation ---` (línea ~171).  
Imports: quitar `List` y `Tuple` de `typing` si quedan sin uso. Dejar `Any, Dict` — los usa `resolve_customer_from_checkout`.

### No se toca

| Pieza | Por qué |
|---|---|
| `create_order_from_cart` (líneas 18–68) | La llama `CheckoutAPIView` (`views_api.py:481`) |
| `resolve_customer_from_checkout` (líneas 74–169) | La llama `CheckoutAPIView` (`views_api.py:371`) |
| `apps/orders/services/__init__.py` | Solo reexporta `create_order_from_cart` |
| `apps/orders/views_api.py` | Recálculo de precio + Wompi |
| `apps/orders/urls_api.py` | `POST /api/checkout/` |
| Frontend (`CheckoutClient`, `lib/api.ts`) | Sigue pegándole a `/checkout/` |
| `views_cart.py` | Legacy; no entra en esta cadena |
| `customers/services/customer_upsert.py` | Otro leftover; **otro PR** |

### Cadena de cobro que debe quedar idéntica

```
CheckoutClient
    POST /api/checkout/
        CheckoutAPIView
            resolve_customer_from_checkout
            get_product_discount_info      ← precio desde DB
            create_order_from_cart         ← Order + OrderItem
                Wompi firma order.total
```

Criterio de no-regresión: **mismo status, mismo stock, mismo total, misma firma** para un carrito dado.

---

## 2. Impacto

| Superficie | Impacto | Mitigación |
|---|---|---|
| Checkout Next → Django | Nulo si no se toca la vista | No editar `views_api.py` salvo que un import se rompa (no debería) |
| Wompi widget / webhook | Nulo | Firma usa `order.total` creado por `create_order_from_cart` |
| Stock `InventoryPool` | Nulo | El descuento sigue en `confirm_order_payment`, no en create |
| Admin órdenes / clientes | Nulo | No importan esas funciones |
| Emails (Resend) | Nulo | Disparan en confirmación de pago |
| Tests actuales | Nulo | Ninguno referencia los símbolos a borrar |
| Import público | Nulo | `__init__.py` no exporta la función muerta |
| Tamaño del módulo | −~336 líneas | `create_order_from_cart.py` queda ~170 líneas (create + resolve) |

Riesgo residual: un import olvidado en un notebook/script local fuera del repo. Mitigación: `rg create_order_from_checkout` en el monorepo **después** del corte (debe dar 0 en `.py`).

---

## 3. Pasos de implementación (orden fijo)

1. Baseline: correr tests de órdenes **antes** de borrar (sección 4.1). Guardar conteo de OK.
2. En `create_order_from_cart.py`, borrar desde el comentario de línea ~171 hasta EOF. Debe quedar el archivo cerrado en `resolve_customer_from_checkout`.
3. Ajustar `from typing import Any, Dict`.
4. `rg` en el repo: `create_order_from_checkout` y `_normalize_checkout_items` → 0 hits en código (el plan y `MEJORAS.md` pueden mencionar el nombre).
5. Añadir **un** test de API (sección 4.2) que fije el contrato de precio.
6. Correr la batería de no-regresión (sección 4.3).
7. Smoke local del storefront (sección 4.4) si hay Docker + `.env`.
8. Commit atómico. No mezclar docs de KAI ni `MEJORAS.md`.

Commit sugerido:

```
chore(orders): remove unused create_order_from_checkout

The live checkout already prices from the database via CheckoutAPIView.
This leftover accepted client unit_price and had no callers.
```

---

## 4. Casos de prueba

### 4.1 Baseline (antes del corte)

Desde la raíz, con Postgres local o SQLite de test:

```bash
python manage.py test apps.orders apps.catalog apps.customers apps.notifications --verbosity=2
```

**Esperado:** la misma cantidad de tests OK que en `main`. Hoy el bloque de órdenes cubre, entre otros:

| Clase | Qué demuestra que no debemos romper |
|---|---|
| `PaymentReferenceFormatTest` | `KAME-{id}-{random}` |
| `InventoryNotDecrementedAtCheckoutTest` | Stock intacto al crear orden |
| `InventoryDecrementedOnPaymentConfirmTest` | Stock baja al pagar |
| `IdempotentPaymentConfirmTest` | No doble descuento |
| `WompiWebhookIdempotencyTest` | Webhook repetido |
| `WompiIntegritySignatureTest` | Firma widget |
| `WompiWebhookSignatureValidationTest` | Checksum |
| `ShippingCostTest` | Bogotá / nacional / umbral |
| `OrderRecalcTotalsTest` | Totales |
| `DiscountRule*` / `DiscountCalculationTest` | Precio con descuento |
| `AdminNewSaleNotificationTest` | Email al dueño al confirmar |

Si el baseline falla, **no borrar nada**.

### 4.2 Test nuevo obligatorio (contrato de precio)

Añadir en `apps/orders/tests.py` una clase que pegue al endpoint vivo, no al servicio muerto.

**TC-API-01 — el cliente no puede bajar el precio**

- Arrange: producto `price=50_000`, sin `DiscountRule`, variante activa, pool con stock ≥ 1.
- Act: `POST /api/checkout/` (y `/api/checkout` sin slash) con `items: [{ product_variant_id, quantity: 1, unit_price: 1 }]`.
- Assert:
  - HTTP 201
  - `OrderItem.unit_price == 50000` (no `1`)
  - `order.subtotal` usa 50_000
  - `order.status == PENDING_PAYMENT`
  - `InventoryPool.quantity` no cambia

**TC-API-02 — descuento sigue saliendo de DB**

- Arrange: `DiscountRule` de producto 20 %.
- Act: mismo POST con `unit_price: 1`.
- Assert: `unit_price` del item = precio con descuento (`apply_discount` / `get_product_discount_info`), no `1`.

**TC-API-03 — import muerto**

```python
import apps.orders.services.create_order_from_cart as m
self.assertFalse(hasattr(m, "create_order_from_checkout"))
self.assertFalse(hasattr(m, "_normalize_checkout_items"))
self.assertTrue(hasattr(m, "create_order_from_cart"))
self.assertTrue(hasattr(m, "resolve_customer_from_checkout"))
```

Payload mínimo del POST (campos que ya valida `CheckoutSerializer`): `customer` (full_name, cedula, email, phone, document_type), `shipping_address` (city_code `BOG`, address), `items`, `payment_method`.

### 4.3 No-regresión automática (después del corte)

```bash
python manage.py test apps.orders apps.catalog apps.customers apps.notifications --verbosity=2
```

**Go:** 0 fallos y conteo ≥ baseline + 3 tests nuevos.

E2E mock (no levanta Django; valida que el front no cambió):

```bash
cd tests && CI=true npx playwright test e2e/checkout.spec.ts e2e/cart.spec.ts e2e/smoke.spec.ts
```

**Go:** verdes. Si fallan, el cambio de backend no es la causa (el spec mockea `/api/checkout/`). Anotar y no bloquear el PR de Python, salvo que hayas tocado frontend (no debes).

### 4.4 Smoke manual (local, Wompi sandbox)

Solo si el entorno local está arriba (`docker compose` Postgres + `runserver` + `npm run dev`).

| # | Pasos | Resultado esperado |
|---|---|---|
| S1 | Home → PDP → talla/color → añadir al carrito | Mini-cart con precio de lista |
| S2 | Checkout, datos válidos, ciudad Bogotá | Quote de envío coherente |
| S3 | En DevTools, interceptar POST `/api/checkout/` y forzar `unit_price: 1` | La respuesta 201 trae `subtotal` del precio real, no 1 COP |
| S4 | Abrir widget Wompi (sandbox) | `amount_in_cents` = `order.total * 100` |
| S5 | No pagar / cancelar | Orden `PENDING_PAYMENT`; stock igual |
| S6 | Admin → órdenes | La orden nueva se ve; cliente por cédula no duplicado si repetís S3 |

Wompi live **prohibido** en este PR.

### 4.5 Señal de que algo se rompió (abortar)

- 500 en `POST /api/checkout/`
- Orden con `unit_price` igual al enviado por el cliente
- Stock bajó al crear la orden
- `ImportError` de `create_order_from_cart` o `resolve_customer_from_checkout`
- Tests de webhook/firma rojos
- Emails al confirmar pago dejan de salir (no deberíamos tocar `payments.py`; si salen rojos, el commit tocó de más)

Rollback: `git revert` del commit o `git checkout main -- apps/orders/services/create_order_from_cart.py`.

---

## 5. Matriz de responsables (este PR)

| Rol | Qué hace aquí |
|---|---|
| `/dev` | Corte de las dos funciones + imports |
| `/qa` | Baseline, TC-API-01/02/03, suite órdenes |
| `/security` | Confirmar que no queda camino con precio del cliente (`rg unit_price` en create) |
| `/devops` | Nada (sin deploy extra; merge a `main` como cualquier chore) |
| Resto de skills JARVIS/KameCol | No participan |

---

## 6. Definition of done

- [ ] Rama `chore/remove-create-order-from-checkout` (ya creada)
- [ ] `create_order_from_checkout` y `_normalize_checkout_items` no existen en `.py`
- [ ] `create_order_from_cart` y `resolve_customer_from_checkout` intactos
- [ ] TC-API-01, 02 y 03 verdes
- [ ] `manage.py test apps.orders` verde
- [ ] `rg create_order_from_checkout --glob '*.py'` vacío
- [ ] Sin cambios en frontend, urls, Wompi, admin
- [ ] Un solo commit de código (+ este plan si se versiona)

---

## 7. Explicitamente no en esta rama

- `get_or_create_customer_from_checkout` (también muerto; PR aparte cuando toque customers)
- Fail-closed Turnstile / `FIELD_ENCRYPTION_KEY`
- Ventana de timestamp del webhook
- Makefile / Render “dev”
- Extraer `CheckoutAPIView.post` a otro service
