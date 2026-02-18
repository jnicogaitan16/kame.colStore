"""
API del checkout de órdenes.

Prefijo: /api/orders/
"""

from __future__ import annotations

import logging

from urllib.parse import quote
from django.conf import settings

from django.db import IntegrityError, transaction
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.permissions import AllowAny

from apps.catalog.models import ProductVariant

from apps.orders.constants import CITY_CHOICES
from apps.orders.serializers import CheckoutSerializer
from apps.orders.services.create_order_from_cart import create_order_from_cart, resolve_customer_from_checkout
from apps.orders.services.shipping import calculate_shipping_cost

from apps.orders.services.cart_validation import validate_cart_stock


logger = logging.getLogger(__name__)


class CitiesAPIView(APIView):
    """
    GET /api/orders/cities/

    Devuelve el catálogo de ciudades basado en CITY_CHOICES.
    """

    @method_decorator(never_cache)
    def get(self, request, *args, **kwargs):
        cities = [{"code": code, "label": label} for code, label in CITY_CHOICES]
        return Response({"cities": cities})


# CSRF cookie setter endpoint
class CsrfCookieAPIView(APIView):
    """GET /api/orders/csrf/

    Fuerza el seteo de la cookie `csrftoken` para el dominio actual.
    Útil si en el futuro quieres enviar X-CSRFToken desde el frontend.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    @method_decorator(never_cache)
    @method_decorator(ensure_csrf_cookie)
    def get(self, request, *args, **kwargs):
        return Response({"ok": True})


@method_decorator(csrf_exempt, name="dispatch")
class StockValidateAPIView(APIView):
    """POST /api/orders/stock-validate/

    Validates that the requested items are sellable given current stock.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    @method_decorator(never_cache)
    def post(self, request, *args, **kwargs):
        raw_items = request.data.get("items")

        # Contract: items is required and must be a list.
        # If it's an empty list, we return 200 with empty maps (no guessing needed in frontend).
        if raw_items is None or not isinstance(raw_items, list):
            return Response(
                {
                    "ok": False,
                    "warningsByVariantId": {},
                    "hintsByVariantId": {},
                    "error": "items es requerido y debe ser una lista.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if raw_items == []:
            return Response(
                {
                    "ok": True,
                    "warningsByVariantId": {},
                    "hintsByVariantId": {},
                },
                status=status.HTTP_200_OK,
            )

        # Normalize input (only what the service needs)
        normalized = []
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

            if vid_int is None or vid_int <= 0 or qty_int <= 0:
                continue

            normalized.append({"product_variant_id": vid_int, "quantity": qty_int})

        if not normalized:
            return Response(
                {
                    "ok": False,
                    "warningsByVariantId": {},
                    "hintsByVariantId": {},
                    "error": "items debe incluir al menos un product_variant_id válido.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            # Contract: MUST use the same service as checkout, no parallel logic here.
            result = validate_cart_stock(normalized, strict_stock=True)

            warnings_raw = result.get("warnings") or {}
            hints_raw = result.get("hints") or {}

            # JSON keys must be strings
            warnings_by_variant_id = {str(k): v for k, v in warnings_raw.items()}
            hints_by_variant_id = {str(k): v for k, v in hints_raw.items()}

            # Safety rule (final layer): never return a hint for a variant that already has a warning
            if warnings_by_variant_id and hints_by_variant_id:
                for k in list(warnings_by_variant_id.keys()):
                    hints_by_variant_id.pop(k, None)

            ok_all = not bool(warnings_by_variant_id)

            return Response(
                {
                    "ok": ok_all,
                    "warningsByVariantId": warnings_by_variant_id,
                    "hintsByVariantId": hints_by_variant_id,
                },
                status=status.HTTP_200_OK,
            )

        except ValidationError:
            # Let DRF return a 400 with JSON details
            raise

        except DjangoValidationError as e:
            # Some stock validations may raise Django ValidationError (e.g. {'stock': [...]})
            # For the stock-validate endpoint we must return warnings/hints instead of 500.
            try:
                variant_ids = [it["product_variant_id"] for it in normalized]
                variants = ProductVariant.objects.filter(id__in=variant_ids)
                variants_by_id = {v.id: v for v in variants}

                warnings_by_variant_id = {}
                hints_by_variant_id = {}

                for it in normalized:
                    vid = int(it["product_variant_id"])
                    requested = int(it["quantity"])
                    v = variants_by_id.get(vid)
                    available = int(getattr(v, "stock", 0) or 0) if v is not None else 0

                    if requested > available:
                        warnings_by_variant_id[str(vid)] = {
                            "status": "insufficient",
                            "available": available,
                            "requested": requested,
                            "message": f"Stock insuficiente. Disponible: {available}",
                        }
                    elif available == 1 and requested == 1:
                        hints_by_variant_id[str(vid)] = {
                            "kind": "last_unit",
                            "message": "⚡ Última unidad disponible",
                        }

                # Safety rule (final layer): never return a hint for a variant that already has a warning
                if warnings_by_variant_id and hints_by_variant_id:
                    for k in list(warnings_by_variant_id.keys()):
                        hints_by_variant_id.pop(k, None)

                ok_all = not bool(warnings_by_variant_id)

                return Response(
                    {
                        "ok": ok_all,
                        "warningsByVariantId": warnings_by_variant_id,
                        "hintsByVariantId": hints_by_variant_id,
                    },
                    status=status.HTTP_200_OK,
                )
            except Exception:
                # If fallback fails, return a controlled 400 instead of 500
                payload = {
                    "ok": False,
                    "warningsByVariantId": {},
                    "hintsByVariantId": {},
                    "error": "Error de validación al validar stock.",
                }
                if settings.DEBUG:
                    payload["debug_error"] = str(e)
                return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            logger.exception("stock-validate: unexpected error")

            payload = {
                "ok": False,
                "warningsByVariantId": {},
                "hintsByVariantId": {},
                "error": "Error inesperado al validar stock.",
            }

            if settings.DEBUG:
                payload["debug_error"] = str(e)

            return Response(payload, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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


@method_decorator(csrf_exempt, name="dispatch")
class CheckoutAPIView(APIView):
    """
    POST /api/orders/checkout/
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    @method_decorator(never_cache)
    def post(self, request, *args, **kwargs):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # 1) Tomar payload del request (fuente de verdad para snapshot/form_data)
        raw = request.data if isinstance(request.data, dict) else {}
        payload_customer = raw.get("customer") or {}
        shipping_address = raw.get("shipping_address") or {}

        # Items deben venir del request tal cual (preservando unit_price si lo envían)
        raw_items = raw.get("items")
        if not isinstance(raw_items, list) or not raw_items:
            raise ValidationError(
                {"items": ["El checkout debe incluir items válidos (no vacíos)."]}
            )

        # 2) Normalizar form_data SOLO desde el request (no desde Customer)
        #    Nota: el serializer ya valida/normaliza documento y teléfono; usamos request como fuente,
        #    pero con los alias soportados (cedula / document_number).
        form_data = {
            "full_name": (payload_customer.get("full_name") or "").strip(),
            "document_type": (payload_customer.get("document_type") or "CC").strip() or "CC",
            "cedula": (
                (payload_customer.get("cedula") or payload_customer.get("document_number") or payload_customer.get("document") or "")
            ).strip(),
            "email": (payload_customer.get("email") or "").strip().lower(),
            "phone": (payload_customer.get("phone") or "").strip(),
            "city_code": (shipping_address.get("city_code") or "").strip(),
            "address": (shipping_address.get("address") or "").strip(),
            "notes": (shipping_address.get("notes") or "") or "",
        }

        # 2.1) Validar city_code (errores de input deben ser 400)
        if form_data["city_code"] and form_data["city_code"] not in CITY_CODES:
            raise ValidationError({"city_code": ["Ciudad inválida."]})

        # 3) Resolver customer (Documento manda) SOLO con payload_customer
        customer = resolve_customer_from_checkout(payload_customer)

        # 4) Construir cart_items para el servicio (variant + qty + unit_price)
        normalized = []
        variant_ids = []
        for it in raw_items:
            if not isinstance(it, dict):
                continue
            vid = it.get("product_variant_id")
            qty = it.get("quantity")
            unit_price = it.get("unit_price")
            try:
                vid_int = int(vid)
            except (TypeError, ValueError):
                vid_int = None
            try:
                qty_int = int(qty)
            except (TypeError, ValueError):
                qty_int = 0
            try:
                unit_price_int = int(unit_price) if unit_price is not None else None
            except (TypeError, ValueError):
                unit_price_int = None

            normalized.append(
                {
                    "product_variant_id": vid_int,
                    "quantity": qty_int,
                    "unit_price": unit_price_int,
                }
            )
            if vid_int is not None:
                variant_ids.append(vid_int)

        if not variant_ids:
            raise ValidationError(
                {"items": ["items debe incluir al menos un product_variant_id válido."]}
            )

        variants = ProductVariant.objects.filter(id__in=variant_ids)
        variants_by_id = {v.id: v for v in variants}

        missing_variant_ids = [vid for vid in variant_ids if vid not in variants_by_id]
        if missing_variant_ids:
            raise ValidationError(
                {"items": [f"Algunos product_variant_id no existen: {missing_variant_ids}"]}
            )

        cart_items = []
        subtotal = 0
        for row in normalized:
            vid = row.get("product_variant_id")
            variant = variants_by_id.get(vid)
            qty = int(row.get("quantity") or 0)
            if variant is None:
                # Ya validamos missing_variant_ids arriba, pero mantenemos guardrail
                raise ValidationError({"items": [f"product_variant_id inválido: {vid}"]})
            if qty <= 0:
                raise ValidationError(
                    {"items": ["quantity debe ser mayor a 0 para todos los items."]}
                )

            # Precio: preferir unit_price enviado; fallback a precio del variant si existe
            price = row.get("unit_price")
            if price is None:
                price = int(getattr(variant, "price", 0) or 0)

            cart_items.append(
                {
                    "product_variant": variant,
                    "qty": qty,
                    "unit_price": int(price),
                    "product_variant_id": vid,
                }
            )
            subtotal += int(price) * qty

        if not cart_items:
            raise ValidationError(
                {"items": ["El checkout debe incluir items válidos (quantity > 0)."]}
            )

        payment_method = raw.get("payment_method")
        if not isinstance(payment_method, str) or not payment_method.strip():
            payment_method = "transferencia"
        else:
            payment_method = payment_method.strip()

        try:
            with transaction.atomic():
                order = create_order_from_cart(
                    customer=customer,
                    cart_items=cart_items,
                    form_data=form_data,
                    subtotal=int(subtotal),
                    payment_method=payment_method,
                )
        except ValidationError:
            # Dejar que DRF lo convierta a 400 con detalle (no atraparlo como 500)
            raise
        except IntegrityError as e:
            logger.exception("checkout: IntegrityError")

            payload = {
                "detail": "No se pudo crear la orden por una restricción de datos.",
                "code": "integrity_error",
            }

            if settings.DEBUG:
                payload["error"] = str(e)

            return Response(payload, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("checkout: unexpected error")

            payload = {"detail": "Error inesperado al crear la orden."}

            if settings.DEBUG:
                payload["error"] = str(e)

            return Response(payload, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Instrucciones de pago (sin pasarela)
        payment_reference = order.payment_reference or ""
        payment_method = getattr(order, "payment_method", "") or payment_method

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
