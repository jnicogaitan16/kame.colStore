from __future__ import annotations

from django.core.exceptions import ValidationError

from apps.orders.models import Order, OrderItem


def validate_and_prepare_order_item(order_item: OrderItem) -> None:
    """Valida y prepara un OrderItem antes de guardarlo.

    Reglas:
    - Bloquear edición si la orden está PAID.
    - Si el item es nuevo y unit_price viene vacío/0, usar el precio del Product asociado a la variante.
    """

    # Bloqueo si la orden ya está pagada.
    # Nota: En el admin, al cambiar el estado del Order, Django puede re-guardar los inlines
    # aunque no hayan cambiado. Permitimos ese "save" sin cambios, pero bloqueamos:
    # - crear nuevos items
    # - modificar quantity / unit_price / product_variant de items existentes
    if order_item.order and order_item.order.status == Order.Status.PAID:
        # No permitir crear nuevos items en una orden pagada
        if order_item._state.adding or not order_item.pk:
            raise ValidationError("No se pueden crear items en una orden ya pagada.")

        # Si es un item existente, permitir guardar SOLO si no hay cambios reales
        try:
            original = OrderItem.objects.get(pk=order_item.pk)
        except OrderItem.DoesNotExist:
            raise ValidationError("No se pueden modificar items de una orden ya pagada.")

        same_product_variant = original.product_variant_id == order_item.product_variant_id
        same_qty = original.quantity == order_item.quantity
        same_unit_price = (original.unit_price or 0) == (order_item.unit_price or 0)

        if not (same_product_variant and same_qty and same_unit_price):
            raise ValidationError("No se pueden modificar items de una orden ya pagada.")

    # Default unit_price en creación
    if order_item._state.adding and (order_item.unit_price is None or order_item.unit_price == 0):
        if order_item.product_variant and getattr(order_item.product_variant, "product", None):
            order_item.unit_price = order_item.product_variant.product.price
