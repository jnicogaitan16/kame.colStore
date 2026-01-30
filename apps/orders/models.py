from django.core.exceptions import ValidationError
from django.db import models, transaction

from apps.catalog.models import ProductVariant
from apps.customers.models import Customer


class Order(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PAID = "paid", "Paid"
        SHIPPED = "shipped", "Shipped"
        CANCELLED = "cancelled", "Cancelled"

    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="orders",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    total = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )

    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def recalculate_total(self) -> None:
        """Recalculate and persist the order total from its items."""
        total = sum(
            (item.quantity * item.unit_price)
            for item in self.items.all()
            if item.unit_price is not None
        )
        self.total = total
        self.save(update_fields=["total"])

    def mark_paid_and_decrement_stock(self) -> None:
        """Mark order as PAID and decrement stock by variant.

        Production notes:
        - Uses `select_for_update()` to prevent overselling under concurrency.
        - Validates available stock before decrementing.
        - Performs all operations atomically.

        This method is intentionally explicit and should be called from a service layer
        (e.g. after payment confirmation / COD confirmation), not automatically from `save()`.
        """

        with transaction.atomic():
            # Lock the order row to avoid double-processing.
            order = Order.objects.select_for_update().get(pk=self.pk)

            if order.status != Order.Status.DRAFT:
                raise ValidationError("Solo se puede pagar un pedido en estado DRAFT.")

            # Aggregate requested qty per variant to minimize locks/updates.
            required_by_variant: dict[int, int] = {}
            for item in order.items.select_related("product_variant").all():
                required_by_variant[item.product_variant_id] = (
                    required_by_variant.get(item.product_variant_id, 0) + item.quantity
                )

            # Lock variants and validate stock.
            variants_qs = (
                ProductVariant.objects.select_for_update()
                .filter(id__in=required_by_variant.keys(), is_active=True)
                .select_related("product")
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

            # Decrement stock.
            for vid, required_qty in required_by_variant.items():
                variant = variants_by_id[vid]
                variant.stock = variant.stock - required_qty
                variant.save(update_fields=["stock"])

            # Persist totals and status.
            order.recalculate_total()
            order.status = Order.Status.PAID
            order.save(update_fields=["status"])

            # Reflect latest state on the instance.
            self.status = order.status
            self.total = order.total

    def __str__(self) -> str:
        return f"Order #{self.id} - {self.customer}"


class OrderItem(models.Model):
    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product_variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.PROTECT,
        related_name="order_items",
    )

    quantity = models.PositiveIntegerField(default=1)

    # 👇 CLAVE: permitir vacío para que el admin no obligue a llenarlo
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["order", "product_variant"],
                name="uniq_order_variant",
            ),
        ]

    def save(self, *args, **kwargs):
        """
        Si es un item nuevo y no viene precio definido,
        toma automáticamente el precio base del producto asociado
        a la variante (product_variant.product.price).
        """
        if self._state.adding and (self.unit_price is None or self.unit_price == 0):
            if self.product_variant and self.product_variant.product:
                self.unit_price = self.product_variant.product.price

        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"Order #{self.order_id} - {self.product_variant} x{self.quantity}"

    @property
    def line_total(self):
        return self.quantity * (self.unit_price or 0)