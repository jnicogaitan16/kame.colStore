from django.urls import path
from apps.orders.views import checkout_view, checkout_success, shipping_quote_view

app_name = "orders"

urlpatterns = [
    path("checkout/", checkout_view, name="checkout"),
    path("checkout/success/<int:order_id>/", checkout_success, name="checkout_success"),
    path("api/shipping-quote/", shipping_quote_view, name="shipping_quote"),
]