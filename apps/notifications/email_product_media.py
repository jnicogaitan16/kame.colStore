from __future__ import annotations

from typing import Any

from django.conf import settings
from django.db.models import QuerySet

from apps.orders.models import Order

try:
    from apps.catalog.serializers import public_media_url, _spec_url
except Exception:
    def _spec_url(spec: Any) -> str | None:
        if not spec:
            return None

        cachefile = getattr(spec, "cachefile_name", None)
        if cachefile:
            return str(cachefile)

        name = getattr(spec, "name", None)
        if name:
            return str(name)

        url = getattr(spec, "url", None)
        if callable(url):
            try:
                return str(url())
            except Exception:
                return None

        return str(url).strip() if url else None

    def public_media_url(value: Any, request=None) -> str | None:
        raw = str(value or "").strip()
        if not raw:
            return None

        if raw.startswith("http://") or raw.startswith("https://"):
            return raw

        if raw.startswith("//"):
            return f"https:{raw}"

        base = (
            getattr(settings, "PUBLIC_SITE_URL", None)
            or getattr(settings, "NEXT_PUBLIC_SITE_URL", None)
            or "https://kamecol.com"
        )
        base = str(base).rstrip("/")
        return f"{base}/{raw.lstrip('/')}"


def format_cop(amount) -> str:
    try:
        n = int(amount or 0)
    except Exception:
        n = 0
    return "$" + f"{n:,}".replace(",", ".")


def _first_public_candidate(*values: Any, request=None) -> str | None:
    for value in values:
        if not value:
            continue

        # spec-based candidates first
        try:
            spec_value = _spec_url(value)
        except Exception:
            spec_value = None
        resolved_spec = public_media_url(spec_value, request=request) if spec_value else None
        if resolved_spec:
            return resolved_spec

        # objects with .url
        try:
            file_url = getattr(value, "url", None)
            if callable(file_url):
                file_url = file_url()
        except Exception:
            file_url = None
        resolved_file = public_media_url(file_url, request=request) if file_url else None
        if resolved_file:
            return resolved_file

        # raw strings / paths
        try:
            resolved_raw = public_media_url(value, request=request)
        except Exception:
            resolved_raw = None
        if resolved_raw:
            return resolved_raw

    return None


def _ordered(queryset: QuerySet) -> QuerySet:
    return queryset.order_by("-is_primary", "sort_order", "created_at")


def _build_variant_label(variant) -> str | None:
    if variant is None:
        return None

    value = str(getattr(variant, "value", "") or "").strip()
    color = str(getattr(variant, "color", "") or "").strip()

    parts: list[str] = []
    if value:
        parts.append(value)
    if color:
        parts.append(color.upper())

    return " / ".join(parts).strip() or None


def _get_variant_schema(product) -> str:
    category = getattr(product, "category", None) if product is not None else None
    schema = str(getattr(category, "variant_schema", "") or "").strip().lower()
    if schema:
        return schema

    # Compatibilidad secundaria para productos legacy.
    return str(
        getattr(product, "variant_type", None)
        or getattr(product, "product_type", None)
        or getattr(product, "variants_type", None)
        or ""
    ).strip().lower()


def _get_color_image_queryset(product, color):
    model = None
    try:
        from apps.catalog.models import ProductColorImage as model  # type: ignore
    except Exception:
        model = None

    if model is None or product is None or not color:
        return None

    try:
        return model.objects.filter(product=product, color=color)
    except Exception:
        return None


def _get_variant_image_queryset(variant):
    if variant is None:
        return None

    manager = getattr(variant, "images", None)
    if manager is not None:
        try:
            return manager.all()
        except Exception:
            pass

    model = None
    try:
        from apps.catalog.models import ProductImage as model  # type: ignore
    except Exception:
        model = None

    if model is None:
        return None

    for field_name in ("variant", "product_variant"):
        try:
            return model.objects.filter(**{field_name: variant})
        except Exception:
            continue

    return None


def _resolve_from_color_images(product, color, request=None) -> str | None:
    queryset = _get_color_image_queryset(product, color)
    if queryset is None:
        return None

    try:
        images = _ordered(queryset)
    except Exception:
        images = queryset

    for image in images:
        resolved = _first_public_candidate(
            getattr(image, "image_thumb", None),
            getattr(image, "image_medium", None),
            getattr(image, "image", None),
            getattr(image, "image_url", None),
            request=request,
        )
        if resolved:
            return resolved

    return None


def _resolve_from_variant_images(variant, request=None) -> str | None:
    queryset = _get_variant_image_queryset(variant)
    if queryset is None:
        return None

    try:
        images = _ordered(queryset)
    except Exception:
        images = queryset

    for image in images:
        resolved = _first_public_candidate(
            getattr(image, "image_thumb", None),
            getattr(image, "image_medium", None),
            getattr(image, "image", None),
            getattr(image, "image_url", None),
            request=request,
        )
        if resolved:
            return resolved

    return None


def _resolve_from_public_original(variant, product, request=None) -> str | None:
    return _first_public_candidate(
        getattr(variant, "image", None) if variant is not None else None,
        getattr(variant, "image_url", None) if variant is not None else None,
        getattr(product, "primary_image", None) if product is not None else None,
        getattr(product, "image", None) if product is not None else None,
        getattr(product, "image_url", None) if product is not None else None,
        request=request,
    )


def get_email_variant_image_url(variant, request=None) -> str | None:
    if variant is None:
        return None

    product = getattr(variant, "product", None)
    if product is None:
        return None

    variant_schema = _get_variant_schema(product)
    color = getattr(variant, "color", None)

    if variant_schema == "size_color":
        resolved = _resolve_from_color_images(product, color, request=request)
        if resolved:
            return resolved

    resolved = _resolve_from_variant_images(variant, request=request)
    if resolved:
        return resolved

    return _resolve_from_public_original(variant, product, request=request)


def build_email_order_items(order: Order, request=None) -> list[dict]:
    items_payload: list[dict] = []

    try:
        items = order.items.select_related(
            "product_variant",
            "product_variant__product",
            "product_variant__product__category",
        ).all()
    except Exception:
        return items_payload

    for item in items:
        variant = getattr(item, "product_variant", None)
        product = getattr(variant, "product", None)
        product_name = str(getattr(product, "name", "") or "").strip() if product is not None else ""

        items_payload.append(
            {
                "name": product_name.upper() if product_name else "PRODUCTO",
                "variant_label": _build_variant_label(variant),
                "quantity": int(getattr(item, "quantity", 0) or 0),
                "unit_price_fmt": format_cop(getattr(item, "unit_price", 0)),
                "image_url": get_email_variant_image_url(variant, request=request),
            }
        )

    return items_payload