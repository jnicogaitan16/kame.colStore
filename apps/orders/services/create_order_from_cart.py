from __future__ import annotations

from typing import Any, Dict, Iterable, List, Tuple

from apps.customers.models import Customer
from apps.orders.models import Order, OrderItem

from apps.customers.services.customer_upsert import get_or_create_customer_from_checkout
from apps.orders.services.payments import generate_payment_reference


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

def _normalize_checkout_items(items: Any) -> List[Dict[str, Any]]:
    """
    Normaliza el payload de items del checkout a una lista de dicts con:
    - product_variant_id (int)
    - quantity (int)
    - unit_price (int)

    Soporta formatos comunes:
    1) Lista: [{"product_variant_id": 1, "quantity": 2, "unit_price": 10000}, ...]
    2) Dict por variant_id: { "1": {"qty": 2, "unit_price": 10000}, ... }  (formato cart)
    """
    if not items:
        return []

    if isinstance(items, list):
        normalized: List[Dict[str, Any]] = []
        for it in items:
            if not isinstance(it, dict):
                continue
            pv = it.get("product_variant_id", it.get("variant_id", it.get("productVariantId")))
            qty = it.get("quantity", it.get("qty"))
            price = it.get("unit_price", it.get("unitPrice", it.get("price")))
            if pv is None or qty is None or price is None:
                continue
            normalized.append(
                {
                    "product_variant_id": int(pv),
                    "quantity": int(qty),
                    "unit_price": int(price),
                }
            )
        return normalized

    if isinstance(items, dict):
        normalized = []
        for variant_id, it in items.items():
            if not isinstance(it, dict):
                continue
            qty = it.get("quantity", it.get("qty"))
            price = it.get("unit_price", it.get("unitPrice", it.get("price")))
            if qty is None or price is None:
                continue
            normalized.append(
                {
                    "product_variant_id": int(variant_id),
                    "quantity": int(qty),
                    "unit_price": int(price),
                }
            )
        return normalized

    return []


def create_order_from_checkout(payload: Dict[str, Any]) -> Order:
    """
    Un solo lugar para crear Customer + Order + OrderItems desde checkout.

    Reglas:
    - Valida campos mínimos
    - NO descuenta stock aquí (eso ocurre al confirmar pago)
    - Genera payment_reference única
    - Calcula costos/totales

    Expected keys (mínimo):
    - items (list|dict)
    - full_name
    - document_type
    - cedula
    - city_code
    - address
    Optional:
    - email, phone, notes, payment_method
    """
    items = _normalize_checkout_items(payload.get("items"))
    if not items:
        raise ValueError("El checkout debe incluir items no vacíos.")

    full_name = (payload.get("full_name") or "").strip()
    document_type = (payload.get("document_type") or "").strip()
    cedula = (payload.get("cedula") or "").strip()

    city_code = (payload.get("city_code") or "").strip()
    address = (payload.get("address") or "").strip()

    if not full_name:
        raise ValueError("full_name es requerido.")
    if not document_type or not cedula:
        raise ValueError("document_type y cedula son requeridos.")
    if not city_code:
        raise ValueError("city_code es requerido.")
    if not address:
        raise ValueError("address es requerido.")

    # 1) Customer upsert centralizado (por doc)
    customer = get_or_create_customer_from_checkout(
        {
            "full_name": full_name,
            "document_type": document_type,
            "cedula": cedula,
            "email": payload.get("email"),
            "phone": payload.get("phone"),
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
        phone=(payload.get("phone") or "") or "",
        email=(payload.get("email") or "") or "",
        # Snapshot (envío)
        city_code=city_code,
        address=address,
        notes=(payload.get("notes") or "") or "",
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