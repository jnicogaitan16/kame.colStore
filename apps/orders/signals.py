"""Signals for the orders app.

Keeps Order.total in sync when OrderItem rows are created/updated/deleted.

Nota: Order.save() ya recalcula totales automáticamente, pero las señales
son necesarias para casos donde se modifiquen items directamente sin pasar
por Order.save() (ej: bulk operations, admin inline edits, etc).
"""

from __future__ import annotations

import logging

from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import OrderItem

logger = logging.getLogger(__name__)


def _recalculate_order_total(order_id: int, skip_if_recent: bool = True) -> None:
    """
    Recalculate total for an order id.

    Args:
        order_id: ID de la orden a recalcular.
        skip_if_recent: Si True, evita recalcular si la orden fue guardada recientemente
                        (para evitar doble cálculo cuando Order.save() ya lo hizo).
    """
    # Import inside to avoid any potential import cycles during app loading.
    from .models import Order

    try:
        order = Order.objects.get(pk=order_id)
    except Order.DoesNotExist:
        logger.warning(f"Intento de recalcular total para orden inexistente: {order_id}")
        return

    # Si skip_if_recent es True y la orden fue actualizada recientemente (últimos 2 segundos),
    # probablemente Order.save() ya recalculó el total. Evitamos doble cálculo.
    if skip_if_recent:
        from django.utils import timezone
        from datetime import timedelta
        if order.updated_at and (timezone.now() - order.updated_at) < timedelta(seconds=2):
            logger.debug(f"Saltando recálculo de orden #{order_id} (ya fue recalculado recientemente)")
            return

    logger.debug(f"Recalculando total para orden #{order_id}")
    order.recalculate_total()


@receiver(post_save, sender=OrderItem)
def recalc_total_on_item_save(sender, instance: OrderItem, **kwargs) -> None:
    """
    Recalculate total when an item is created/updated.

    Usa transaction.on_commit para asegurar que el recálculo ocurre después
    de que la transacción se confirme, evitando problemas de consistencia.
    """
    # Solo recalcular si el item tiene una orden asociada
    if not instance.order_id:
        return

    transaction.on_commit(
        lambda: _recalculate_order_total(instance.order_id, skip_if_recent=True)
    )


@receiver(post_delete, sender=OrderItem)
def recalc_total_on_item_delete(sender, instance: OrderItem, **kwargs) -> None:
    """
    Recalculate total when an item is deleted.

    Guardamos el order_id antes de que se elimine el objeto.
    """
    order_id = instance.order_id
    if not order_id:
        return

    transaction.on_commit(
        lambda: _recalculate_order_total(order_id, skip_if_recent=False)
    )