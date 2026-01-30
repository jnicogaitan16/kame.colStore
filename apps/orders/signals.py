"""Signals for the orders app.

Keeps Order.total in sync when OrderItem rows are created/updated/deleted.
"""

from __future__ import annotations

from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import OrderItem


def _recalculate_order_total(order_id: int) -> None:
    """Recalculate total for an order id (safe to call multiple times)."""
    # Import inside to avoid any potential import cycles during app loading.
    from .models import Order

    try:
        order = Order.objects.get(pk=order_id)
    except Order.DoesNotExist:
        return

    order.recalculate_total()


@receiver(post_save, sender=OrderItem)
def recalc_total_on_item_save(sender, instance: OrderItem, **kwargs) -> None:
    """Recalculate total when an item is created/updated."""
    transaction.on_commit(lambda: _recalculate_order_total(instance.order_id))


@receiver(post_delete, sender=OrderItem)
def recalc_total_on_item_delete(sender, instance: OrderItem, **kwargs) -> None:
    """Recalculate total when an item is deleted."""
    transaction.on_commit(lambda: _recalculate_order_total(instance.order_id))