from django.urls import path

from apps.orders.views import (
    checkout_view,
    checkout_success,
    shipping_quote_view,
    customer_snapshot_view,
    variant_price_view,
)
from apps.orders.views_cart import (
    cart_add_view,
    cart_update_view,
    cart_remove_view,
    cart_summary_view,
)

app_name = "orders"

urlpatterns = [
    path("checkout/", checkout_view, name="checkout"),
    path("checkout/success/<int:order_id>/", checkout_success, name="checkout_success"),
    path("api/shipping-quote/", shipping_quote_view, name="shipping_quote"),
    path("api/customer-snapshot/", customer_snapshot_view, name="customer_snapshot"),
    path("api/variant-price/", variant_price_view, name="variant_price"),
    path("api/cart/add/", cart_add_view, name="cart_add"),
    path("api/cart/update/", cart_update_view, name="cart_update"),
    path("api/cart/remove/", cart_remove_view, name="cart_remove"),
    path("api/cart/summary/", cart_summary_view, name="cart_summary"),
]