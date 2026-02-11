"""
API del checkout de órdenes.

Prefijo: /api/orders/
"""
from __future__ import annotations

from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.constants import CITY_CHOICES
from apps.orders.forms import CheckoutForm
from apps.orders.serializers import CheckoutSerializer
from apps.orders.services import (
    create_order_from_cart,
    get_or_create_customer_from_form_data,
)
from apps.orders.services.shipping import calculate_shipping_cost


class CitiesAPIView(APIView):
    """
    GET /api/orders/cities/

    Devuelve el catálogo de ciudades basado en CITY_CHOICES.
    """

    @method_decorator(never_cache)
    def get(self, request, *args, **kwargs):
        cities = [{"code": code, "label": label} for code, label in CITY_CHOICES]
        return Response({"cities": cities})


CITY_CODES = {code for code, _label in CITY_CHOICES}


class ShippingQuoteAPIView(APIView):
    """
    GET /api/orders/shipping-quote/?city_code=...&subtotal=...
    """

    @method_decorator(never_cache)
    def get(self, request, *args, **kwargs):
        city_code = (request.query_params.get("city_code") or "").strip()
        subtotal_raw = request.query_params.get("subtotal")

        if not city_code or subtotal_raw is None:
            return Response(
                {"detail": "city_code y subtotal son requeridos."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if city_code not in CITY_CODES:
            return Response(
                {"detail": "city_code inválido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            subtotal = int(subtotal_raw)
        except (TypeError, ValueError):
            return Response(
                {"detail": "subtotal debe ser un entero válido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if subtotal < 0:
            return Response(
                {"detail": "subtotal no puede ser negativo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        amount = int(calculate_shipping_cost(subtotal=subtotal, city_code=city_code))

        return Response(
            {
                "amount": amount,
                "label": "Envío estándar",
            }
        )


class CheckoutAPIView(APIView):
    """
    POST /api/orders/checkout/
    """

    def post(self, request, *args, **kwargs):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        form_data, validated_cart = serializer.get_normalized_form_data()

        # Reutilizar la lógica existente de customers + creación de orden
        # para no duplicar reglas de negocio.
        with transaction.atomic():
            customer = get_or_create_customer_from_form_data(form_data)

            # CheckoutForm solo se usa para aprovechar validaciones adicionales
            # (por ahora ligeras) sin duplicar campos.
            form = CheckoutForm(form_data)
            form.is_valid(raise_exception=False)  # ya validamos en DRF; no interesa errors

            order = create_order_from_cart(
                customer=customer,
                cart_items=validated_cart.items,
                form_data=form_data,
                subtotal=validated_cart.subtotal,
            )

        shipping_amount = int(order.shipping_cost or 0)

        return Response(
            {
                "order_id": order.id,
                "subtotal": int(order.subtotal or 0),
                "shipping": {
                    "amount": shipping_amount,
                    "label": "Envío estándar",
                },
                "total": int(order.total or 0),
            },
            status=status.HTTP_201_CREATED,
        )

