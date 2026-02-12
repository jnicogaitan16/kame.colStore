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

from apps.catalog.models import ProductVariant

from apps.orders.constants import CITY_CHOICES
from apps.orders.forms import CheckoutForm
from apps.orders.serializers import CheckoutSerializer
from apps.orders.services import (
    create_order_from_cart,
    get_or_create_customer_from_form_data,
)
from apps.orders.services.shipping import calculate_shipping_cost
from apps.orders.services.stock import validate_items_stock


class CitiesAPIView(APIView):
    """
    GET /api/orders/cities/

    Devuelve el catálogo de ciudades basado en CITY_CHOICES.
    """

    @method_decorator(never_cache)
    def get(self, request, *args, **kwargs):
        cities = [{"code": code, "label": label} for code, label in CITY_CHOICES]
        return Response({"cities": cities})


class StockValidateAPIView(APIView):
    """POST /api/orders/stock-validate/

    Validates that the requested items are sellable given current stock.
    """

    @method_decorator(never_cache)
    def post(self, request, *args, **kwargs):
        raw_items = request.data.get("items")

        if not isinstance(raw_items, list) or not raw_items:
            return Response(
                {"detail": "items es requerido y debe ser una lista no vacía."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        normalized = []
        variant_ids = []

        for it in raw_items:
            if not isinstance(it, dict):
                continue
            vid = it.get("product_variant_id")
            qty = it.get("quantity")
            try:
                vid_int = int(vid)
            except (TypeError, ValueError):
                vid_int = None
            try:
                qty_int = int(qty)
            except (TypeError, ValueError):
                qty_int = 0

            normalized.append({"product_variant_id": vid_int, "quantity": qty_int})
            if vid_int is not None:
                variant_ids.append(vid_int)

        if not variant_ids:
            return Response(
                {"detail": "items debe incluir al menos un product_variant_id válido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        variants = ProductVariant.objects.filter(id__in=variant_ids)
        variants_by_id = {v.id: v for v in variants}

        service_items = []
        for it in normalized:
            vid = it.get("product_variant_id")
            service_items.append(
                {
                    "product_variant": variants_by_id.get(vid),
                    "quantity": it.get("quantity", 0),
                    "product_variant_id": vid,
                }
            )

        results = validate_items_stock(service_items)

        payload_items = []
        ok_all = True

        for idx, r in enumerate(results):
            sent_id = (
                normalized[idx].get("product_variant_id")
                if idx < len(normalized)
                else r.variant_id
            )
            row = {
                "product_variant_id": sent_id,
                "requested": r.requested,
                "available": r.available,
                "is_active": r.is_active,
                "ok": r.ok,
                "reason": r.reason,
            }
            payload_items.append(row)
            if not r.ok:
                ok_all = False

        return Response(
            {"ok": ok_all, "items": payload_items},
            status=status.HTTP_200_OK,
        )


class ShippingQuoteAPIView(APIView):
    """GET /api/orders/shipping-quote/?city_code=...&subtotal=..."""

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

        amount = int(
            calculate_shipping_cost(subtotal=subtotal, city_code=city_code)
        )

        return Response(
            {
                "amount": amount,
                "label": "Envío estándar",
            }
        )


CITY_CODES = {code for code, _label in CITY_CHOICES}


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
