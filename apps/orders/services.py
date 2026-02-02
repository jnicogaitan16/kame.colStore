# apps/orders/services.py
from __future__ import annotations

from typing import Dict

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from django.apps import apps as django_apps

from apps.orders.models import Order


def _get_product_variant_model():
    """Return the ProductVariant model regardless of whether it's in catalog or products.

    This avoids hard-coding the import path and makes the service reusable across app layouts.
    """

    for app_label in ("catalog", "products"):
        try:
            return django_apps.get_model(app_label, "ProductVariant")
        except LookupError:
            continue

    raise ImportError(
        "No se encontró el modelo ProductVariant. Asegúrate de que exista en la app 'catalog' o 'products'."
    )


def confirm_order_payment(order: Order) -> None:
    """
    Confirma el pago de un pedido y descuenta stock exactamente una vez.

    Garantías:
    - Idempotencia: si ya fue procesado (PAID + stock_deducted_at), no descuenta de nuevo.
    - Concurrencia: bloquea el pedido y las variantes involucradas con select_for_update().
    - Atomicidad: todo ocurre dentro de una transacción.

    Errores:
    - Lanza ValidationError para casos de negocio (stock insuficiente, estado inválido, etc.).
    """

    if order.pk is None:
        raise ValidationError("El pedido debe estar guardado antes de confirmar pago.")

    with transaction.atomic():
        ProductVariant = _get_product_variant_model()
        # 1) Lock del pedido (evita doble procesamiento paralelo)
        locked_order = Order.objects.select_for_update().get(pk=order.pk)

        # 2) Validaciones por estado
        if locked_order.status in (Order.Status.CANCELLED, Order.Status.REFUNDED):
            raise ValidationError("No se puede confirmar pago para un pedido cancelado o reembolsado.")

        # 3) Idempotencia: ya descontado => no repetir
        if locked_order.status == Order.Status.PAID and locked_order.stock_deducted_at is not None:
            return

        # Permitimos:
        # - CREATED (flujo normal)
        # - PAID sin stock_deducted_at (estado inconsistente, pero recuperable)
        if locked_order.status not in (Order.Status.CREATED, Order.Status.PAID):
            raise ValidationError("Solo se puede confirmar pago para un pedido en estado CREATED.")

        # 4) Consolidar cantidades por variante
        required_by_variant: Dict[int, int] = {}
        items_qs = locked_order.items.select_related("product_variant").all()
        if not items_qs.exists():
            raise ValidationError("El pedido no tiene ítems para procesar.")

        for item in items_qs:
            vid = item.product_variant_id
            required_by_variant[vid] = required_by_variant.get(vid, 0) + item.quantity

        # 5) Lock de variantes + validación stock
        variants_qs = (
            ProductVariant.objects.select_for_update()
            .filter(id__in=required_by_variant.keys(), is_active=True)
        )
        variants_by_id = {v.id: v for v in variants_qs}

        missing = [vid for vid in required_by_variant.keys() if vid not in variants_by_id]
        if missing:
            raise ValidationError("Hay variantes inválidas o inactivas en el pedido.")

        for vid, required_qty in required_by_variant.items():
            variant = variants_by_id[vid]
            if variant.stock < required_qty:
                raise ValidationError(
                    f"Stock insuficiente para {variant}. Disponible: {variant.stock}, requerido: {required_qty}."
                )

        # 6) Descuento real (una sola vez)
        for vid, required_qty in required_by_variant.items():
            variant = variants_by_id[vid]
            variant.stock = variant.stock - required_qty
            variant.save(update_fields=["stock"])

        # 7) Total + estado + marcador idempotencia
        locked_order.recalculate_total()  # Ojo: este método hace save(total)
        locked_order.status = Order.Status.PAID
        locked_order.stock_deducted_at = timezone.now()
        locked_order.save(update_fields=["status", "stock_deducted_at"])
