from __future__ import annotations

from typing import Any, Dict, Iterable, List, Tuple

from apps.customers.models import Customer
from apps.orders.models import Order, OrderItem

from apps.customers.services.customer_upsert import get_or_create_customer_from_checkout
from apps.orders.services.payments import generate_payment_reference

from rest_framework.exceptions import ValidationError


def create_order_from_cart(
    customer: Customer,
    cart_items: Dict[int, dict],
    form_data: dict,
    subtotal: int,
) -> Order:
    # Local import to avoid circular dependencies between services modules
    from apps.orders.services.shipping import calculate_shipping_cost

    city_code = (form_data.get("city_code") or "").strip()

    shipping_cost = int(calculate_shipping_cost(subtotal=int(subtotal), city_code=city_code))
    total = int(subtotal) + int(shipping_cost)

    order = Order.objects.create(
        customer=customer,
        status=Order.Status.PENDING_PAYMENT,
        payment_method=(form_data.get("payment_method") or "transferencia"),
        # Snapshot
        full_name=(form_data.get("full_name") or ""),
        cedula=(form_data.get("cedula") or ""),
        document_type=(form_data.get("document_type") or "CC"),
        phone=(form_data.get("phone") or ""),
        email=(form_data.get("email") or "") or "",
        city_code=city_code,
        address=(form_data.get("address") or ""),
        notes=(form_data.get("notes") or "") or "",
        # Totals
        subtotal=int(subtotal),
        shipping_cost=int(shipping_cost),
        total=int(total),
    )

    for variant_id, item in cart_items.items():
        OrderItem.objects.create(
            order=order,
            product_variant_id=int(variant_id),
            quantity=int(item["qty"]),
            unit_price=int(item["unit_price"]),
        )

    return order


# --- Nuevas utilidades para checkout-based order creation ---

def _normalize_checkout_items(items: Any) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Normaliza items del checkout y acumula rechazos.

    Retorna:
      - normalized: lista de dicts con keys: product_variant_id, quantity, unit_price, _index
      - rejected: lista de dicts con: index, reason, detail?

    Soporta formatos:
      1) Lista: [{"product_variant_id": 1, "quantity": 2, "unit_price": 10000}, ...]
      2) Dict por variant_id: {"1": {"qty": 2, "unit_price": 10000}, ...}  (formato cart)

    Tolerancias:
      - variant id puede venir como: product_variant_id | variant_id | product_variant
      - quantity puede venir como: quantity | qty
      - unit_price puede venir como: unit_price | unitPrice | price
    """
    normalized: List[Dict[str, Any]] = []
    rejected: List[Dict[str, Any]] = []

    if not items:
        return normalized, rejected

    def _reject(idx: int, reason: str, detail: str | None = None) -> None:
        row: Dict[str, Any] = {"index": idx, "reason": reason}
        if detail:
            row["detail"] = detail
        rejected.append(row)

    # Case 1: list of dicts
    if isinstance(items, list):
        for idx, it in enumerate(items):
            if not isinstance(it, dict):
                _reject(idx, "bad_payload", "item is not an object")
                continue

            variant_id = (
                it.get("product_variant_id")
                or it.get("variant_id")
                or it.get("product_variant")
                or it.get("variant_id")
                or it.get("variantId")
            )
            if variant_id is None:
                _reject(idx, "missing_variant_id")
                continue

            try:
                pv_id = int(variant_id)
            except (TypeError, ValueError):
                _reject(idx, "bad_variant_id", f"value={variant_id!r}")
                continue

            qty_raw = it.get("quantity", it.get("qty"))
            if qty_raw is None:
                _reject(idx, "missing_quantity")
                continue
            try:
                qty = int(qty_raw)
            except (TypeError, ValueError):
                _reject(idx, "bad_quantity", f"value={qty_raw!r}")
                continue
            if qty <= 0:
                _reject(idx, "bad_quantity", "quantity must be > 0")
                continue

            price_raw = it.get("unit_price", it.get("unitPrice", it.get("price")))
            if price_raw is None:
                _reject(idx, "missing_unit_price")
                continue
            try:
                price = int(price_raw)
            except (TypeError, ValueError):
                _reject(idx, "bad_unit_price", f"value={price_raw!r}")
                continue
            if price < 0:
                _reject(idx, "bad_unit_price", "unit_price must be >= 0")
                continue

            normalized.append(
                {
                    "product_variant_id": pv_id,
                    "quantity": qty,
                    "unit_price": price,
                    "_index": idx,
                }
            )

        return normalized, rejected

    # Case 2: dict keyed by variant_id
    if isinstance(items, dict):
        # Stable indices for rejection messages
        for idx, (variant_key, it) in enumerate(items.items()):
            if not isinstance(it, dict):
                _reject(idx, "bad_payload", "item is not an object")
                continue

            # In dict-format, the key is the variant id, but allow fallback inside too.
            variant_id = (
                it.get("product_variant_id")
                or it.get("variant_id")
                or it.get("product_variant")
                or variant_key
            )
            if variant_id is None:
                _reject(idx, "missing_variant_id")
                continue

            try:
                pv_id = int(variant_id)
            except (TypeError, ValueError):
                _reject(idx, "bad_variant_id", f"value={variant_id!r}")
                continue

            qty_raw = it.get("quantity", it.get("qty"))
            if qty_raw is None:
                _reject(idx, "missing_quantity")
                continue
            try:
                qty = int(qty_raw)
            except (TypeError, ValueError):
                _reject(idx, "bad_quantity", f"value={qty_raw!r}")
                continue
            if qty <= 0:
                _reject(idx, "bad_quantity", "quantity must be > 0")
                continue

            price_raw = it.get("unit_price", it.get("unitPrice", it.get("price")))
            if price_raw is None:
                _reject(idx, "missing_unit_price")
                continue
            try:
                price = int(price_raw)
            except (TypeError, ValueError):
                _reject(idx, "bad_unit_price", f"value={price_raw!r}")
                continue
            if price < 0:
                _reject(idx, "bad_unit_price", "unit_price must be >= 0")
                continue

            normalized.append(
                {
                    "product_variant_id": pv_id,
                    "quantity": qty,
                    "unit_price": price,
                    "_index": idx,
                }
            )

        return normalized, rejected

    # Unknown format
    rejected.append({"index": 0, "reason": "bad_payload", "detail": "items must be a list or object"})
    return [], rejected


def create_order_from_checkout(payload: Dict[str, Any]) -> Order:
    """
    Un solo lugar para crear Customer + Order + OrderItems desde checkout.

    Reglas:
    - Valida campos mínimos
    - NO descuenta stock aquí (eso ocurre al confirmar pago)
    - Genera payment_reference única
    - Calcula costos/totales

    Payload soportado:
    - items (list|dict)
    - customer: { full_name, document_type, document_number|cedula, email?, phone? }
    - shipping_address: { city_code, address, notes? }
    - payment_method?

    Backward compatible (flat):
    - full_name, document_type, cedula, email?, phone?, city_code, address, notes?, payment_method?
    """
    # Soportar payload anidado (frontend): customer + shipping_address
    customer_payload = payload.get("customer") if isinstance(payload.get("customer"), dict) else {}
    shipping_payload = payload.get("shipping_address") if isinstance(payload.get("shipping_address"), dict) else {}

    # Flatten con fallback a llaves flat (backward compatible)
    full_name = (payload.get("full_name") or customer_payload.get("full_name") or "").strip()
    document_type = (payload.get("document_type") or customer_payload.get("document_type") or "").strip()

    # Alias: backend históricamente usa `cedula`, frontend envía `document_number`
    cedula = (
        payload.get("cedula")
        or customer_payload.get("cedula")
        or customer_payload.get("document_number")
        or ""
    ).strip()

    city_code = (payload.get("city_code") or shipping_payload.get("city_code") or "").strip()
    address = (payload.get("address") or shipping_payload.get("address") or "").strip()

    email = (payload.get("email") or customer_payload.get("email") or "") or ""
    phone = (payload.get("phone") or customer_payload.get("phone") or "") or ""
    notes = (payload.get("notes") or shipping_payload.get("notes") or "") or ""

    items, rejected = _normalize_checkout_items(payload.get("items"))

    # Validar existencia/estado de variantes (si el modelo existe en este proyecto)
    variant_ids = [int(it["product_variant_id"]) for it in items]
    active_by_id: Dict[int, bool] = {}

    if variant_ids:
        try:
            from apps.catalog.models import ProductVariant  # type: ignore

            qs = ProductVariant.objects.filter(id__in=variant_ids)
            found = {int(v.id): v for v in qs}

            for it in list(items):
                pv_id = int(it["product_variant_id"])
                idx = int(it.get("_index", 0))

                v = found.get(pv_id)
                if v is None:
                    rejected.append({"index": idx, "reason": "missing_variant", "detail": f"id={pv_id}"})
                    items.remove(it)
                    continue

                is_active = bool(getattr(v, "is_active", True))
                active_by_id[pv_id] = is_active
                if not is_active:
                    rejected.append({"index": idx, "reason": "inactive_variant", "detail": f"id={pv_id}"})
                    items.remove(it)

        except Exception:
            # Si no existe catalog/models.py o no hay campo is_active, no romper checkout.
            pass

    if not items:
        raise ValidationError(
            {
                "items": ["El checkout debe incluir items válidos (no vacíos)."],
                "rejected": rejected,
            }
        )

    if not full_name:
        raise ValidationError({"full_name": ["Este campo es requerido."]})
    if not document_type or not cedula:
        raise ValidationError({"document_type": ["Este campo es requerido."], "cedula": ["Este campo es requerido."]})
    if not city_code:
        raise ValidationError({"city_code": ["Este campo es requerido."]})
    if not address:
        raise ValidationError({"address": ["Este campo es requerido."]})

    # 1) Customer upsert centralizado (por doc)
    customer = get_or_create_customer_from_checkout(
        {
            "full_name": full_name,
            "document_type": document_type,
            "cedula": cedula,
            "email": email,
            "phone": phone,
        }
    )

    # 2) Calcular subtotal
    subtotal = 0
    for it in items:
        subtotal += int(it["unit_price"]) * int(it["quantity"])

    # Local import to avoid circular dependencies between services modules
    from apps.orders.services.shipping import calculate_shipping_cost

    shipping_cost = int(calculate_shipping_cost(subtotal=int(subtotal), city_code=city_code))
    total = int(subtotal) + int(shipping_cost)

    # 3) Crear Order en PENDING_PAYMENT + snapshot datos
    order = Order.objects.create(
        customer=customer,
        status=Order.Status.PENDING_PAYMENT,
        payment_method=(payload.get("payment_method") or "transferencia"),
        payment_reference=generate_payment_reference(),
        # Snapshot (cliente)
        full_name=full_name,
        cedula=cedula,
        document_type=document_type,
        phone=(phone or "") or "",
        email=(email or "") or "",
        # Snapshot (envío)
        city_code=city_code,
        address=address,
        notes=(notes or "") or "",
        # Totals (se recalculan abajo también)
        subtotal=int(subtotal),
        shipping_cost=int(shipping_cost),
        total=int(total),
    )

    # 4) Crear items
    for it in items:
        OrderItem.objects.create(
            order=order,
            product_variant_id=int(it["product_variant_id"]),
            quantity=int(it["quantity"]),
            unit_price=int(it["unit_price"]),
        )

    # 5) Recalcular totales si el modelo lo soporta; si no, mantener lo calculado arriba.
    try:
        order.recalculate_total()
        order.save(update_fields=["subtotal", "shipping_cost", "total"])
    except AttributeError:
        # El modelo no expone recalculate_total(); los totales ya fueron seteados.
        pass

    # Enviar email de pedido creado
    try:
        from apps.notifications.emails import send_order_created_email
        send_order_created_email(order)
    except Exception:
        # No romper checkout si el email falla
        pass
    return order