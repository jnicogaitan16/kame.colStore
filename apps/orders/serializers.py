from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.orders.constants import CITY_CHOICES
from apps.orders.services.cart_validation import validate_cart


CITY_CODES = {code for code, _label in CITY_CHOICES}


def normalize_co_phone(raw: str) -> str:
    """
    Normaliza teléfonos celulares colombianos.

    Reglas:
    - Acepta formatos con espacios, guiones y prefijos +57 / 57.
    - El resultado debe ser exactamente 10 dígitos y empezar por 3.
    """
    digits = "".join(ch for ch in (raw or "") if ch.isdigit())

    if digits.startswith("57") and len(digits) in (11, 12):
        # 57 + 9/10 dígitos -> quitar prefijo país
        digits = digits[2:]

    if len(digits) != 10 or not digits.startswith("3"):
        raise serializers.ValidationError(
            "Ingresa un celular colombiano válido (10 dígitos, inicia en 3)."
        )

    return digits


class CustomerDataSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=30)
    document_type = serializers.ChoiceField(choices=(("CC", "CC"), ("NIT", "NIT")), required=False, default="CC")
    # El frontend puede enviar `document_number` o `cedula` (alias).
    document_number = serializers.CharField(max_length=32, required=False, allow_blank=True)
    cedula = serializers.CharField(max_length=32, required=False, allow_blank=True)

    def validate_phone(self, value: str) -> str:
        return normalize_co_phone(value)

    def validate(self, attrs):
        """Validación conjunta de tipo y número de documento."""
        raw_number = (attrs.get("document_number") or "").strip()
        raw_cedula = (attrs.get("cedula") or "").strip()

        raw_value = raw_number or raw_cedula
        digits = "".join(ch for ch in raw_value if ch.isdigit())

        if not digits:
            raise serializers.ValidationError(
                {
                    "cedula": "El documento es obligatorio.",
                    "document_number": "El documento es obligatorio.",
                }
            )

        doc_type = attrs.get("document_type")
        if doc_type == "CC":
            if not (6 <= len(digits) <= 10):
                raise serializers.ValidationError(
                    {"document_number": "La cédula debe tener entre 6 y 10 dígitos."}
                )
        elif doc_type == "NIT":
            if not (6 <= len(digits) <= 12):
                raise serializers.ValidationError(
                    {"document_number": "El NIT debe tener entre 6 y 12 dígitos."}
                )

        attrs["document_number"] = digits
        attrs["cedula"] = digits
        return attrs


class ShippingAddressSerializer(serializers.Serializer):
    city_code = serializers.ChoiceField(choices=CITY_CHOICES)
    address = serializers.CharField(max_length=255)
    notes = serializers.CharField(allow_blank=True, required=False)


class CheckoutItemSerializer(serializers.Serializer):
    product_variant_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)


# --- Stock Validate endpoint serializers ---

class StockValidateItemSerializer(serializers.Serializer):
    """Item contract for /api/stock-validate/."""

    product_variant_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)


class StockValidateRequestSerializer(serializers.Serializer):
    """Request contract for /api/stock-validate/.

    IMPORTANT:
    - `items` is required but may be an empty list.
    - When empty, the view should return 200 with empty maps.
    """

    items = serializers.ListField(
        child=StockValidateItemSerializer(),
        required=True,
        allow_empty=True,
    )


@dataclass
class ValidatedCart:
    items: Dict[int, Dict[str, int]]
    subtotal: int


class CheckoutSerializer(serializers.Serializer):
    customer = CustomerDataSerializer()
    shipping_address = ShippingAddressSerializer()
    items = CheckoutItemSerializer(many=True)

    # Atributos auxiliares expuestos a la vista/servicios
    validated_cart: ValidatedCart | None = None

    def validate_items(self, value: List[dict]) -> List[dict]:
        # Con `CheckoutItemSerializer(many=True)` normalmente ya llega validado,
        # pero mantenemos defensivo para evitar 500 por payloads mal formados.
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError("Debes agregar al menos un ítem.")

        # Consolidar items repetidos por variant_id
        consolidated: Dict[int, int] = {}

        for idx, item in enumerate(value):
            try:
                if not isinstance(item, dict):
                    raise TypeError("El ítem no es un objeto.")

                variant_raw = item.get("product_variant_id")
                qty_raw = item.get("quantity")

                if variant_raw is None:
                    raise KeyError("product_variant_id")
                if qty_raw is None:
                    raise KeyError("quantity")

                variant_id = int(variant_raw)
                qty = int(qty_raw)

                if variant_id < 1:
                    raise ValueError("product_variant_id debe ser >= 1")
                if qty < 1:
                    raise ValueError("quantity debe ser >= 1")

            except KeyError as exc:
                field = str(exc).strip("'")
                raise serializers.ValidationError(
                    {
                        "items": [
                            f"Ítem #{idx + 1} inválido: falta el campo '{field}'."
                        ]
                    }
                ) from exc
            except (TypeError, ValueError) as exc:
                raise serializers.ValidationError(
                    {
                        "items": [
                            f"Ítem #{idx + 1} inválido: 'product_variant_id' y 'quantity' deben ser números enteros válidos (>= 1)."
                        ]
                    }
                ) from exc

            consolidated[variant_id] = consolidated.get(variant_id, 0) + qty

        cart = {vid: {"qty": qty} for vid, qty in consolidated.items()}

        try:
            validated_items, subtotal = validate_cart(cart, strict_stock=True)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict or exc.messages) from exc

        self.validated_cart = ValidatedCart(items=validated_items, subtotal=subtotal)
        return value

    # Helpers para la vista -------------------------------------------------
    def get_normalized_form_data(self) -> Tuple[dict, ValidatedCart]:
        """
        Devuelve:
        - form_data compatible con services existentes (get_or_create_customer_from_form_data,
          create_order_from_cart)
        - instancia ValidatedCart con ítems y subtotal
        """
        if self.validated_cart is None:
            raise RuntimeError("validated_cart no fue inicializado.")

        customer = self.validated_data["customer"]
        shipping = self.validated_data["shipping_address"]

        form_data = {
            "full_name": customer["full_name"],
            # Mapear document_number a cedula interna
            "cedula": customer["cedula"],
            "document_type": customer["document_type"],
            "phone": customer["phone"],
            "email": customer.get("email") or "",
            "city_code": shipping["city_code"],
            "address": shipping["address"],
            "notes": shipping.get("notes") or "",
            "payment_method": "transferencia",
        }

        return form_data, self.validated_cart
