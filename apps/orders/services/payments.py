from __future__ import annotations

import logging
from typing import Dict

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.orders.models import Order
from apps.orders.services.product_variants import get_product_variant_model

logger = logging.getLogger(__name__)


def confirm_order_payment(order: Order) -> None:
    """Confirma el pago de un pedido, descuenta stock e implementa idempotencia.

    Esta función es segura para múltiples ejecuciones sobre la misma orden.
    """

    if order.pk is None:
        raise ValidationError("El pedido debe estar guardado antes de confirmar pago.")

    logger.info(f"Confirmando pago para orden #{order.id}")

    with transaction.atomic():
        ProductVariant = get_product_variant_model()

        locked_order = Order.objects.select_for_update().get(pk=order.pk)

        # Estados terminales
        if locked_order.status in (Order.Status.CANCELLED, Order.Status.REFUNDED):
            raise ValidationError("No se puede confirmar pago para un pedido cancelado o reembolsado.")

        # Idempotencia: ya pagada y con stock descontado
        if locked_order.status == Order.Status.PAID and locked_order.stock_deducted_at:
            order.status = locked_order.status
            order.total = locked_order.total
            order.subtotal = locked_order.subtotal
            order.shipping_cost = locked_order.shipping_cost
            order.payment_confirmed_at = locked_order.payment_confirmed_at
            order.stock_deducted_at = locked_order.stock_deducted_at
            return

        if locked_order.status not in (Order.Status.CREATED, Order.Status.PENDING_PAYMENT, Order.Status.PAID):
            raise ValidationError("Estado inválido para confirmar pago.")

        # Agrupar cantidades requeridas por variante
        required_by_variant: Dict[int, int] = {}
        items = locked_order.items.select_related("product_variant").all()
        if not items:
            raise ValidationError("La orden no tiene ítems asociados.")

        for item in items:
            vid = item.product_variant_id
            required_by_variant[vid] = required_by_variant.get(vid, 0) + item.quantity

        # Lock de variantes
        variants = (
            ProductVariant.objects.select_for_update()
            .filter(id__in=required_by_variant.keys(), is_active=True)
            .select_related("product")
        )
        variants_by_id = {v.id: v for v in variants}

        missing = [vid for vid in required_by_variant if vid not in variants_by_id]
        if missing:
            raise ValidationError("Hay variantes inválidas o inactivas en el pedido.")

        # Validar stock
        for vid, required_qty in required_by_variant.items():
            variant = variants_by_id[vid]
            if variant.stock < required_qty:
                raise ValidationError(
                    f"Stock insuficiente para {variant}. Disponible: {variant.stock}, requerido: {required_qty}."
                )

        # Descontar stock
        for vid, required_qty in required_by_variant.items():
            variant = variants_by_id[vid]
            variant.stock -= required_qty
            variant.save(update_fields=["stock"])

        # Actualizar orden
        locked_order.recalculate_total()
        locked_order.status = Order.Status.PAID
        locked_order.payment_confirmed_at = timezone.now()
        locked_order.stock_deducted_at = timezone.now()
        locked_order.save(update_fields=["status", "payment_confirmed_at", "stock_deducted_at"])

        # Reflejar cambios en instancia externa
        order.status = locked_order.status
        order.total = locked_order.total
        order.subtotal = locked_order.subtotal
        order.shipping_cost = locked_order.shipping_cost
        order.payment_confirmed_at = locked_order.payment_confirmed_at
        order.stock_deducted_at = locked_order.stock_deducted_at
