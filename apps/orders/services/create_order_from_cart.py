

from __future__ import annotations

from typing import Dict

from apps.customers.models import Customer
from apps.orders.models import Order, OrderItem
from apps.orders.services.shipping import calculate_shipping_cost


def create_order_from_cart(
    customer: Customer,
    cart_items: Dict[int, dict],
    form_data: dict,
    subtotal: int,
) -> Order:
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