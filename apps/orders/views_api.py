"""
API del checkout de órdenes.

Prefijo: /api/orders/
"""
from __future__ import annotations

from urllib.parse import quote
from django.conf import settings

from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

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

        form_data, validated_cart = serializer.get_normalized_form_data()

        # Construir payload unificado para el service del checkout (customer + order + items)
        items_payload = []
        for it in (validated_cart.items or []):
            if not isinstance(it, dict):
                continue

            pv_id = it.get("product_variant_id") or it.get("variant_id")
            if pv_id is None and it.get("product_variant") is not None:
                try:
                    pv_id = int(it["product_variant"].id)
                except Exception:
                    pv_id = None

            qty = it.get("quantity") or it.get("qty") or 0
            unit_price = it.get("unit_price") or it.get("unitPrice") or it.get("price")

            # Fallback: si viene el objeto variant, intenta tomar su precio
            if unit_price is None and it.get("product_variant") is not None:
                pv = it["product_variant"]
                unit_price = getattr(pv, "price", None) or getattr(pv, "base_price", None)

            if pv_id is None or unit_price is None:
                continue

            try:
                items_payload.append(
                    {
                        "product_variant_id": int(pv_id),
                        "quantity": int(qty),
                        "unit_price": int(unit_price),
                    }
                )
            except (TypeError, ValueError):
                continue

        checkout_payload = {
            # items
            "items": items_payload,
            # customer snapshot
            "full_name": form_data.get("full_name") or "",
            "document_type": form_data.get("document_type") or "",
            "cedula": form_data.get("cedula") or "",
            "email": form_data.get("email"),
            "phone": form_data.get("phone"),
            # shipping snapshot
            "city_code": form_data.get("city_code") or form_data.get("city") or "",
            "address": form_data.get("address") or "",
            "notes": form_data.get("notes") or "",
            # payment
            "payment_method": form_data.get("payment_method") or "transferencia",
        }

        with transaction.atomic():
            order = create_order_from_checkout(checkout_payload)

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
