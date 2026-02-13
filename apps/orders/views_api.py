"""
API del checkout de órdenes.

Prefijo: /api/orders/
"""
from __future__ import annotations

from urllib.parse import quote
from django.conf import settings

from django.db import IntegrityError, transaction
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError

from apps.catalog.models import ProductVariant

from apps.orders.constants import CITY_CHOICES
from apps.orders.serializers import CheckoutSerializer
from apps.orders.services.create_order_from_cart import create_order_from_checkout
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

        # Convert request anidado (customer / shipping_address) a payload plano
        raw = request.data if isinstance(request.data, dict) else {}
        customer = raw.get("customer") or {}
        shipping_address = raw.get("shipping_address") or {}

        payload = dict(serializer.validated_data)

        # Items deben venir del request tal cual, preservando unit_price si lo envían
        payload["items"] = raw.get("items")

        # Si items falta o no es lista, falla con 400 claro
        if not isinstance(payload.get("items"), list) or not payload["items"]:
            raise ValidationError(
                {"items": ["El checkout debe incluir items válidos (no vacíos)."]}
            )

        # Mapear datos del cliente (payload plano esperado por el service)
        payload["full_name"] = customer.get("full_name")
        payload["document_type"] = customer.get("document_type")
        payload["cedula"] = customer.get("document_number")
        payload["email"] = customer.get("email")
        payload["phone"] = customer.get("phone")

        # Mapear dirección de envío
        payload["city_code"] = shipping_address.get("city_code")
        payload["address"] = shipping_address.get("address")
        payload["notes"] = shipping_address.get("notes") or ""

        # Método de pago (si viene en request, úsalo; si no, default)
        payload["payment_method"] = (
            raw.get("payment_method")
            or payload.get("payment_method")
            or "transferencia"
        )

        try:
            with transaction.atomic():
                order = create_order_from_checkout(payload)
        except ValidationError:
            # Dejar que DRF lo convierta a 400 con detalle (no atraparlo como 500)
            raise
        except IntegrityError:
            # Por ejemplo: violación de UNIQUE (no debe ser 500)
            return Response(
                {"detail": "No se pudo crear la orden por una restricción de unicidad (UNIQUE)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            # Error inesperado
            return Response(
                {"detail": "Error inesperado al crear la orden."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Instrucciones de pago (sin pasarela)
        payment_reference = order.payment_reference or ""
        payment_method = getattr(order, "payment_method", "") or "transferencia"

        payment_instructions = (
            "Tu pedido fue creado. "
            f"Paga por {payment_method} usando esta referencia: {payment_reference}. "
            "Una vez realizado el pago, envíanos el comprobante para confirmar."
        )

        # WhatsApp opcional (si configuras un número de soporte en settings)
        whatsapp_link = None
        support_number = getattr(settings, "WHATSAPP_SUPPORT_NUMBER", None)
        if support_number:
            msg = (
                f"Hola, quiero confirmar el pago de mi pedido #{order.id}. "
                f"Referencia: {payment_reference}."
            )
            whatsapp_link = f"https://wa.me/{support_number}?text={quote(msg)}"

        return Response(
            {
                "order_id": order.id,
                "payment_reference": payment_reference,
                "status": getattr(order, "status", ""),
                "payment_instructions": payment_instructions,
                "whatsapp_link": whatsapp_link,
                # Totales (útiles para UI)
                "subtotal": int(order.subtotal or 0),
                "shipping_cost": int(order.shipping_cost or 0),
                "total": int(order.total or 0),
            },
            status=status.HTTP_201_CREATED,
        )
