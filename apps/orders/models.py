from django.db import models

from apps.catalog.models import ProductVariant
from apps.customers.models import Customer


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING_PAYMENT = "pending_payment", "Pending payment"
        CREATED = "created", "Created"
        PAID = "paid", "Paid"
        CANCELLED = "cancelled", "Cancelled"
        REFUNDED = "refunded", "Refunded"

    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="orders",
    )
    # flujo pago anticipado
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PENDING_PAYMENT,
    )
    payment_method = models.CharField(
        max_length=20,
        default="transferencia",
    )
    payment_confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    payment_reference = models.CharField(
        max_length=80,
        blank=True,
    )

    # snapshot entrega + contacto
    full_name = models.CharField(max_length=150, blank=True, default="")
    cedula = models.CharField(max_length=20, blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    email = models.EmailField(blank=True, default="")

    city_code = models.CharField(max_length=30, blank=True, default="")
    address = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")

    # montos (en unidades enteras, p.ej. COP)
    subtotal = models.PositiveIntegerField(default=0)
    shipping_cost = models.PositiveIntegerField(default=0)
    total = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    stock_deducted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Fecha/hora en la que se descontó stock para este pedido (idempotencia).",
    )

    def _recalc_totals_in_memory(self) -> None:
        """Recalculate totals on the instance without persisting.

        - If the order already exists (has a PK), recompute subtotal from OrderItems.
        - Always recompute total as subtotal + shipping_cost.

        This keeps backend as the source of truth even if frontend/admin JS fails.
        """

        def _to_int_money(value) -> int:
            if value is None:
                return 0
            return int(value)

        # Only recompute subtotal from items when the order already exists in DB.
        if self.pk:
            subtotal = 0
            for item in self.items.all():
                if item.unit_price is None:
                    continue
                line = item.quantity * item.unit_price
                subtotal += _to_int_money(line)
            self.subtotal = subtotal

        self.total = int((self.subtotal or 0) + (self.shipping_cost or 0))

    def save(self, *args, **kwargs):
        """Ensure totals are always consistent on save.

        If `update_fields` is provided, we extend it to include `subtotal`/`total`
        so recalculated values are persisted.
        """
        self._recalc_totals_in_memory()

        update_fields = kwargs.get("update_fields")
        if update_fields is not None:
            uf = set(update_fields)
            uf.update({"subtotal", "total"})
            kwargs["update_fields"] = list(uf)

        return super().save(*args, **kwargs)

    def recalculate_total(self) -> None:
        self._recalc_totals_in_memory()
        self.save(update_fields=["subtotal", "total"])

    def confirm_payment(self) -> None:
        """Confirm payment for the order and (once) decrement stock.

        This method delegates to the service layer function `confirm_order_payment()`
        to maintain separation of concerns. All business logic is centralized in
        `apps.orders.services.confirm_order_payment()`.

        Idempotency:
        - Stock is decremented only once per order, controlled by `stock_deducted_at`.
        - Re-calling this method after success will not decrement stock again.

        Concurrency:
        - Locks the order row and all involved variants using `select_for_update()`.
        - Performs all operations atomically.
        """
        from apps.orders.services import confirm_order_payment
        confirm_order_payment(self)

    def mark_paid_and_decrement_stock(self) -> None:
        """Backward-compatible alias. Prefer `confirm_payment()`."""
        self.confirm_payment()

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
        Guarda el OrderItem aplicando reglas de negocio.

        Este método delega la validación y preparación a la capa de servicios
        para mantener la separación de responsabilidades. La lógica de negocio
        está centralizada en `apps.orders.services.validate_and_prepare_order_item()`.
        """
        from apps.orders.services import validate_and_prepare_order_item
        validate_and_prepare_order_item(self)
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"Order #{self.order_id} - {self.product_variant} x{self.quantity}"

    @property
    def line_total(self):
        return self.quantity * (self.unit_price or 0)