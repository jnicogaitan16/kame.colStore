# apps/orders/services/product_variants.py
from __future__ import annotations

from django.apps import apps as django_apps


def get_product_variant_model():
    """Resolve and return the ProductVariant model dynamically.

    Used across cart, payment/stock, and validations.
    """

    for app_label in ("catalog", "products"):
        try:
            return django_apps.get_model(app_label, "ProductVariant")
        except LookupError:
            continue

    raise LookupError(
        "No se encontró el modelo ProductVariant. Verifica que exista en la app 'catalog' (o 'products')."
    )
