from __future__ import annotations

import logging
from typing import Dict, Tuple

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.customers.models import Customer
from apps.orders.models import Order, OrderItem
from apps.orders.services.create_order_from_cart import create_order_from_cart
from apps.orders.services.payments import confirm_order_payment
from apps.orders.services.product_variants import get_product_variant_model

logger = logging.getLogger(__name__)


def validate_and_prepare_order_item(order_item: OrderItem) -> None:
    """Valida y prepara un OrderItem antes de guardarlo."""

    if order_item.pk and order_item.order.status == Order.Status.PAID:
        raise ValidationError("No se pueden modificar items de una orden ya pagada.")

    if order_item._state.adding and (order_item.unit_price is None or order_item.unit_price == 0):
        if order_item.product_variant and order_item.product_variant.product:
            order_item.unit_price = order_item.product_variant.product.price


def validate_cart(cart: dict) -> Tuple[Dict[int, dict], int]:
    """Valida el carrito y calcula el subtotal.

    cart: {variant_id: {"qty": int, "unit_price": int?}, ...}

    Si unit_price no viene en sesión, se deriva desde variant.product.price.
    """

    ProductVariant = get_product_variant_model()

    if not cart:
        raise ValidationError("El carrito está vacío.")

    try:
        variant_ids = [int(v_id) for v_id in cart.keys()]
    except (TypeError, ValueError):
        raise ValidationError("Carrito inválido: variantes incorrectas.")

    variants_qs = ProductVariant.objects.select_for_update().filter(id__in=variant_ids)
    variants_by_id = {v.id: v for v in variants_qs}

    missing_ids = [v_id for v_id in variant_ids if v_id not in variants_by_id]
    if missing_ids:
        raise ValidationError(
            f"Algunos productos del carrito ya no existen: {', '.join(map(str, missing_ids))}."
        )

    validated_items: Dict[int, dict] = {}
    subtotal = 0

    for variant_id_raw, item in cart.items():
        try:
            variant_id = int(variant_id_raw)
            qty = int(item.get("qty", 0))
            unit_price = int(item.get("unit_price", 0))
        except (TypeError, ValueError):
            raise ValidationError("Carrito inválido: cantidades o precios incorrectos.")

        if qty <= 0:
            raise ValidationError("Carrito inválido: la cantidad debe ser mayor a 0.")

        variant = variants_by_id[variant_id]

        if not getattr(variant, "is_active", True):
            raise ValidationError(f"La variante '{variant}' no está disponible.")

        stock = None
        for field_name in ("stock", "stock_qty", "available_stock"):
            if hasattr(variant, field_name):
                stock_value = getattr(variant, field_name)
                if stock_value is not None:
                    stock = int(stock_value)
                    break

        if stock is not None and qty > stock:
            raise ValidationError(
                f"Stock insuficiente para '{variant}'. Disponible: {stock}, solicitado: {qty}."
            )

        if unit_price <= 0:
            try:
                unit_price = int(getattr(getattr(variant, "product", None), "price", 0) or 0)
            except (TypeError, ValueError):
                unit_price = 0

        if unit_price <= 0:
            raise ValidationError(f"No se pudo determinar el precio para '{variant}'.")

        validated_items[variant_id] = {"qty": qty, "unit_price": unit_price}
        subtotal += qty * unit_price

    return validated_items, subtotal


def get_or_create_customer_from_form_data(form_data: dict) -> Customer:
    """Obtiene o crea un Customer a partir de los datos del checkout."""

    from django.db import IntegrityError

    full_name = form_data.get("full_name", "").strip()
    if not full_name:
        first_name = form_data.get("cedula", "")
        last_name = ""
    else:
        full_name_parts = full_name.split(maxsplit=1)
        first_name = full_name_parts[0]
        last_name = full_name_parts[1] if len(full_name_parts) > 1 else ""

    cedula = form_data.get("cedula", "")
    email = form_data.get("email") or ""
    phone = form_data.get("phone", "")

    try:
        customer, _created = Customer.objects.get_or_create(
            cedula=cedula,
            defaults={
                "first_name": first_name,
                "last_name": last_name,
                "phone": phone,
                "email": email,
            },
        )
        return customer
    except IntegrityError as e:
        try:
            customer = Customer.objects.get(cedula=cedula)
            if phone and not customer.phone:
                customer.phone = phone
            if email and not customer.email:
                customer.email = email
            if first_name and customer.first_name != first_name:
                if not customer.first_name or customer.first_name == customer.cedula:
                    customer.first_name = first_name
                    customer.last_name = last_name
            customer.save()
            return customer
        except Customer.DoesNotExist:
            if email:
                try:
                    customer = Customer.objects.get(email=email)
                    if customer.cedula != cedula:
                        raise ValidationError(f"El email '{email}' ya está registrado con otra cédula.")
                    return customer
                except Customer.DoesNotExist:
                    pass

        raise ValidationError("Error al crear o obtener el cliente.") from e


# ---- Cart (session-based) helpers ----
from .cart import (  # noqa: E402
    CART_SESSION_KEY,
    CartLine,
    add_to_cart,
    clear_cart,
    get_cart,
    remove_from_cart,
    update_qty,
    validate_cart as validate_session_cart,
)