"""
URLs de la API de órdenes.

Prefijo montado en config/urls.py como /api/orders/
"""
from django.urls import path

from . import views_api

app_name = "orders_api"

urlpatterns = [
    # Aceptar rutas con y sin slash final para evitar redirecciones 301
    path("cities/", views_api.CitiesAPIView.as_view(), name="cities"),
    path("cities", views_api.CitiesAPIView.as_view(), name="cities-no-slash"),
    path("shipping-quote/", views_api.ShippingQuoteAPIView.as_view(), name="shipping-quote"),
    path("shipping-quote", views_api.ShippingQuoteAPIView.as_view(), name="shipping-quote-no-slash"),
    path("checkout/", views_api.CheckoutAPIView.as_view(), name="checkout"),
    path("checkout", views_api.CheckoutAPIView.as_view(), name="checkout-no-slash"),
]

