from django.contrib import admin

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 1
    autocomplete_fields = ("product_variant",)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "customer", "status", "total", "created_at")
    list_filter = ("status", "created_at")
    search_fields = (
        "customer__first_name",
        "customer__last_name",
        "customer__email",
    )
    readonly_fields = ("total", "created_at")
    inlines = (OrderItemInline,)


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ("order", "product_variant", "quantity", "unit_price", "created_at")
    autocomplete_fields = ("order", "product_variant")
    search_fields = (
        "order__id",
        "product_variant__product__name",
    )