from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.db import transaction

from django import forms
from apps.orders.constants import CITY_CHOICES

from apps.catalog.models import ProductVariant
from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    """Inline para ítems del pedido.

    Mejora: filtra las variantes disponibles para evitar seleccionar variantes sin stock
    (stock <= 0) y así prevenir errores al confirmar el pago.
    """

    model = OrderItem
    extra = 1
    autocomplete_fields = ("product_variant",)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        # Filtra el selector/autocomplete de product_variant para mostrar solo variantes vendibles.
        if db_field.name == "product_variant":
            kwargs["queryset"] = ProductVariant.objects.filter(is_active=True, stock__gt=0)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


# Custom ModelForm for OrderAdmin to control city_code choices
class OrderAdminForm(forms.ModelForm):
    city_code = forms.ChoiceField(
        choices=[("", "---------")] + CITY_CHOICES,
        required=False,
        label="City code",
    )

    class Meta:
        model = Order
        fields = "__all__"


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    form = OrderAdminForm
    list_display = ("id", "customer", "status", "total", "created_at")
    list_filter = ("status", "created_at")
    search_fields = (
        "customer__first_name",
        "customer__last_name",
        "customer__email",
    )
    readonly_fields = ("total", "stock_deducted_at", "created_at")
    inlines = (OrderItemInline,)
    actions = ("confirm_payment_action",)

    @admin.action(description="Confirmar pago y descontar stock")
    def confirm_payment_action(self, request, queryset):
        ok = 0
        failed = 0

        for order in queryset:
            try:
                order.confirm_payment()
                ok += 1
            except ValidationError as e:
                failed += 1
                messages.error(request, f"Pedido #{order.pk}: {e}")
            except Exception as e:
                failed += 1
                messages.error(request, f"Pedido #{order.pk}: error inesperado: {e}")

        if ok:
            messages.success(request, f"Pagos confirmados: {ok}")
        if failed and not ok:
            messages.warning(request, f"No se pudo confirmar pago en {failed} pedido(s).")

    def save_model(self, request, obj, form, change):
        """Guarda la orden y aplica reglas de negocio desde el Admin.

        - Autorellena snapshot (full_name, phone, email) desde Customer solo si vienen vacíos.
        - Detecta transición real a estado "paid" para confirmar pago y descontar stock (idempotente).
        """
        # Estado previo (solo si es edición)
        previous_status = None
        if change and obj.pk:
            previous_status = (
                Order.objects.filter(pk=obj.pk)
                .values_list("status", flat=True)
                .first()
            )

        # Autorellenar snapshot desde el customer (también aplica en Add)
        if getattr(obj, "customer_id", None):
            customer = obj.customer

            if not (getattr(obj, "full_name", "") or "").strip():
                first = getattr(customer, "first_name", "") or ""
                last = getattr(customer, "last_name", "") or ""
                full = f"{first} {last}".strip()
                # Fallback: si tu Customer usa un solo campo 'name'
                if not full:
                    full = (getattr(customer, "name", "") or "").strip()
                obj.full_name = full

            if not (getattr(obj, "phone", "") or "").strip():
                obj.phone = (getattr(customer, "phone", "") or "").strip()

            if not (getattr(obj, "email", "") or "").strip():
                obj.email = (getattr(customer, "email", "") or "").strip()

            if not (getattr(obj, "cedula", "") or "").strip():
                obj.cedula = (getattr(customer, "cedula", "") or "").strip()

        # Guardar la orden
        super().save_model(request, obj, form, change)

        # Ejecutar lógica de negocio solo en transición real a "paid" (en edición)
        if (
            change
            and previous_status != "paid"
            and obj.status == "paid"
            and obj.stock_deducted_at is None
        ):
            with transaction.atomic():
                obj.confirm_payment()

    class Media:
        js = ("orders/js/order_admin_shipping.js",)


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ("order", "product_variant", "quantity", "unit_price", "created_at")
    autocomplete_fields = ("order", "product_variant")
    search_fields = (
        "order__id",
        "product_variant__product__name",
    )

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "product_variant":
            kwargs["queryset"] = ProductVariant.objects.filter(is_active=True, stock__gt=0)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)