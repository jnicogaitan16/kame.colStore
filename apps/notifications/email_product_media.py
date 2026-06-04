from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlparse

from django.db.models import QuerySet

from apps.catalog.serializers import public_media_url

logger = logging.getLogger(__name__)


def is_email_unsafe_url(url: str | None) -> bool:
    """WebP y formatos poco soportados en clientes de correo (p. ej. Gmail móvil)."""
    if not url:
        return True
    path = (urlparse(str(url)).path or str(url)).lower()
    return path.endswith(".webp")


def _resolve_imagefield_url(field, *, request=None) -> str | None:
    """URL del archivo original subido (debe existir en storage)."""
    if not field:
        return None
    try:
        name = getattr(field, "name", None) or ""
        storage = getattr(field, "storage", None)
        if name and storage is not None and not storage.exists(name):
            return None
        raw_url = field.url
    except Exception:
        return None
    return public_media_url(raw_url, request=request) if raw_url else None


def _resolve_imagespec_url(spec, *, request=None, generate: bool = False) -> str | None:
    """URL de un ImageSpecField; opcionalmente genera el cachefile si falta."""
    if not spec:
        return None

    if generate:
        try:
            from imagekit.cachefiles import ImageCacheFile

            cachefile = ImageCacheFile(spec)
            cache_name = getattr(cachefile, "name", None) or ""
            storage = cachefile.storage
            if cache_name and storage is not None and not storage.exists(cache_name):
                try:
                    cachefile.generate()
                except Exception as exc:
                    logger.warning(
                        "email image spec generate failed",
                        extra={"cache_name": cache_name, "error": str(exc)},
                    )
                    return None
            if cache_name and storage is not None and not storage.exists(cache_name):
                return None
        except Exception:
            return None

    try:
        raw_url = spec.url
    except Exception:
        return None

    return public_media_url(raw_url, request=request) if raw_url else None


def _resolve_email_image_url(image_record, *, request=None) -> str | None:
    """Prioriza URLs que existen: original → image_email (JPEG) → derivados no-WebP → webp."""
    if image_record is None:
        return None

    # 1) Original en storage (siempre existe tras upload; puede ser PNG/JPEG)
    original_url = _resolve_imagefield_url(
        getattr(image_record, "image", None), request=request
    )
    if original_url and not is_email_unsafe_url(original_url):
        return original_url

    # 2) Derivado JPEG para correo (generar si hace falta)
    email_url = _resolve_imagespec_url(
        getattr(image_record, "image_email", None),
        request=request,
        generate=True,
    )
    if email_url:
        return email_url

    # 3) Otros derivados ya cacheados (evitar webp si hay alternativa)
    for attr in ("image_medium", "image_thumb"):
        url = _resolve_imagespec_url(
            getattr(image_record, attr, None),
            request=request,
            generate=False,
        )
        if url and not is_email_unsafe_url(url):
            return url

    # 4) Último recurso: original aunque sea webp, o derivados webp (mejor que 404)
    if original_url:
        return original_url

    for attr in ("image_medium", "image_thumb"):
        url = _resolve_imagespec_url(
            getattr(image_record, attr, None),
            request=request,
            generate=True,
        )
        if url:
            return url

    return None


def _ordered(queryset: QuerySet) -> QuerySet:
    return queryset.order_by("-is_primary", "sort_order", "created_at")


def _get_variant_schema(product) -> str:
    category = getattr(product, "category", None) if product is not None else None
    schema = str(getattr(category, "variant_schema", "") or "").strip().lower()
    if schema:
        return schema

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
        resolved = _resolve_email_image_url(image, request=request)
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
        resolved = _resolve_email_image_url(image, request=request)
        if resolved:
            return resolved

    return None


def _resolve_from_public_original(variant, product, request=None) -> str | None:
    for value in (
        getattr(variant, "image", None) if variant is not None else None,
        getattr(variant, "image_url", None) if variant is not None else None,
        getattr(product, "primary_image", None) if product is not None else None,
        getattr(product, "image", None) if product is not None else None,
        getattr(product, "image_url", None) if product is not None else None,
    ):
        resolved = _resolve_imagefield_url(value, request=request)
        if not resolved:
            resolved = _resolve_imagespec_url(value, request=request)
        if resolved and not is_email_unsafe_url(resolved):
            return resolved
    return None


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
