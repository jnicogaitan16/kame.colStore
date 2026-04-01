from django.urls import path

from apps.orders.views import (
    customer_snapshot_view,
    variant_price_view,
)

app_name = "orders"

urlpatterns = [
    # Admin utilities — used by order_admin_shipping.js
    path("api/customer-snapshot/", customer_snapshot_view, name="customer_snapshot"),
    path("api/variant-price/", variant_price_view, name="variant_price"),
]
