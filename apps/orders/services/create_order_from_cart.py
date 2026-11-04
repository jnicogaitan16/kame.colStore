from __future__ import annotations

from typing import Any, Dict

from apps.common.crypto import make_blind_index
from apps.customers.models import Customer
from apps.orders.models import Order, OrderItem

from apps.orders.services.payments import generate_payment_reference

from django.db import IntegrityError, transaction


def create_order_from_cart(
    customer: Customer,
    cart_items: list[dict],
    form_data: dict,
    subtotal: int,
    payment_method: str = "transferencia",
) -> Order:
    # Local import to avoid circular dependencies between services modules
    from apps.orders.services.shipping import calculate_shipping_cost

    city_code = (form_data.get("city_code") or "").strip()

    shipping_cost = int(calculate_shipping_cost(subtotal=int(subtotal), city_code=city_code))
    total = int(subtotal) + int(shipping_cost)

    with transaction.atomic():
        order = Order.objects.create(
            customer=customer,
            status=Order.Status.PENDING_PAYMENT,
            payment_method=(payment_method or "transferencia"),
            payment_reference=None,  # se asigna tras conocer order.id
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
        ref = generate_payment_reference(order.id)
        Order.objects.filter(pk=order.pk).update(payment_reference=ref)
        order.payment_reference = ref

    for item in cart_items:
        unit_price = int(item["unit_price"])
        original_price = int(item.get("original_price") or unit_price)
        OrderItem.objects.create(
            order=order,
            product_variant_id=int(item["product_variant_id"]),
            quantity=int(item["qty"]),
            unit_price=unit_price,
            original_price=original_price,
        )

    return order


# --- Customer resolver utility for checkout (safe upsert) ---

def resolve_customer_from_checkout(payload_customer: Dict[str, Any]) -> Customer:
    """Resolve a Customer without creating duplicates.

    Regla final: Documento manda
      - Si viene documento (cedula): buscar por (document_type, cedula). Si no existe, crear.
        En este caso NO se busca por email.
      - Solo si NO viene documento: buscar por email; si no existe, crear (si el modelo lo permite).

    Nota:
      - Nunca actualiza un Customer existente (0 updates).
      - first_name/last_name se derivan desde full_name para cumplir modelo.
    """

    def _norm(value: Any) -> str:
        return (value or "").strip()

    def _norm_email(value: Any) -> str:
        return (value or "").strip().lower()

    def _split_full_name(full_name: str) -> tuple[str, str]:
        parts = (full_name or "").strip().split()
        if not parts:
            return "-", ""
        if len(parts) == 1:
            return parts[0], ""
        return parts[0], " ".join(parts[1:])

    full_name = _norm(payload_customer.get("full_name"))
    document_type = _norm(payload_customer.get("document_type")) or "CC"

    # Accept legacy naming: cedula / document_number / document
    cedula = _norm(
        payload_customer.get("cedula")
        or payload_customer.get("document_number")
        or payload_customer.get("document")
    )

    email_norm = _norm_email(payload_customer.get("email"))
    phone = _norm(payload_customer.get("phone"))

    first_name, last_name = _split_full_name(full_name)

    # A) SI hay documento: SOLO documento
    if cedula:
        cedula_h = make_blind_index(cedula)
        existing = Customer.objects.filter(document_type=document_type, cedula_hash=cedula_h).first()
        if existing is not None:
            return existing

        try:
            return Customer.objects.create(
                document_type=document_type,
                cedula=cedula,
                first_name=first_name,
                last_name=last_name,
                email=(email_norm or None),
                phone=(phone or ""),
            )
        except IntegrityError:
            # Carrera por UNIQUE(document_type, cedula_hash)
            existing = Customer.objects.filter(document_type=document_type, cedula_hash=cedula_h).first()
            if existing is not None:
                return existing
            raise

    # B) SI NO hay documento: fallback por email
    if email_norm:
        existing = Customer.objects.filter(email=email_norm).first()
        if existing is not None:
            return existing

        # Crear nuevo (si tu modelo permite cedula vacía). Si no, este create fallará y es correcto.
        try:
            return Customer.objects.create(
                document_type=document_type,
                cedula="",
                first_name=first_name,
                last_name=last_name,
                email=(email_norm or None),
                phone=(phone or ""),
            )
        except IntegrityError:
            existing = Customer.objects.filter(email=email_norm).first()
            if existing is not None:
                return existing
            raise

    # Sin documento y sin email: intentar crear (si el modelo lo permite). Si no, debe fallar.
    return Customer.objects.create(
        document_type=document_type,
        cedula="",
        first_name=first_name,
        last_name=last_name,
        email=None,
        phone=(phone or ""),
    )
