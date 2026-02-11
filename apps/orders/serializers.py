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
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=30)
    document_type = serializers.ChoiceField(choices=(("CC", "CC"), ("NIT", "NIT")))
    document_number = serializers.CharField(max_length=32)

    def validate_phone(self, value: str) -> str:
        return normalize_co_phone(value)

    def validate(self, attrs):
        """Validación conjunta de tipo y número de documento."""
        raw_number = attrs.get("document_number") or ""
        digits = "".join(ch for ch in raw_number if ch.isdigit())
        if not digits:
            raise serializers.ValidationError(
                {"document_number": "El número de documento es obligatorio."}
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
        return attrs


class ShippingAddressSerializer(serializers.Serializer):
    city_code = serializers.ChoiceField(choices=CITY_CHOICES)
    address = serializers.CharField(max_length=255)
    notes = serializers.CharField(allow_blank=True, required=False)


class CheckoutItemSerializer(serializers.Serializer):
    product_variant_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)


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
        if not value:
            raise serializers.ValidationError("Debes agregar al menos un ítem.")

        # Consolidar items repetidos por variant_id
        consolidated: Dict[int, int] = {}
        for item in value:
            variant_id = int(item["product_variant_id"])
            qty = int(item["quantity"])
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
            "cedula": customer["document_number"],
            "document_type": customer["document_type"],
            "phone": customer["phone"],
            "email": customer.get("email") or "",
            "city_code": shipping["city_code"],
            "address": shipping["address"],
            "notes": shipping.get("notes") or "",
            "payment_method": "transferencia",
        }

        return form_data, self.validated_cart

