"""Señales reales del catálogo.

Este módulo es cargado por `CatalogConfig.ready()` para registrar señales de Django.

Responsabilidades actuales:
- Generar cachefiles de ImageKit después del commit al guardar imágenes del catálogo.
- Sincronizar variantes después del commit al guardar un InventoryPool.

Importante:
- Este archivo no debe contener lógica de serializers.
- Este archivo no debe duplicar contratos de salida API.
- La generación de derivados es best-effort y no bloquea el flujo de guardado.
"""

from __future__ import annotations

import logging

from django.conf import settings
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from imagekit.cachefiles import ImageCacheFile
from apps.catalog.services.variant_sync import sync_variants_for_pool

from .models import InventoryPool, ProductImage, ProductColorImage

logger = logging.getLogger(__name__)


def _safe_generate(spec) -> None:
    """Generate an ImageKit cachefile for a given spec, swallowing errors."""
    if not spec:
        return
    try:
        cachefile = ImageCacheFile(spec)
        cachefile.generate()
    except Exception:
        # Non-blocking by design
        return


def _generate_product_image_cachefiles(instance: ProductImage) -> None:
    """Generate cachefiles for ProductImage specs (thumb/detail/large)."""
    if not getattr(instance, "image", None):
        return

    # Minimum required for UX: thumb + detail
    for attr in ("image_thumb", "image_medium", "image_large"):
        spec = getattr(instance, attr, None)
        _safe_generate(spec)


def _generate_product_color_image_cachefiles(instance: ProductColorImage) -> None:
    """Generate cachefiles for ProductColorImage specs (thumb/detail/large)."""
    if not getattr(instance, "image", None):
        return

    for attr in ("image_thumb", "image_medium", "image_large"):
        spec = getattr(instance, attr, None)
        _safe_generate(spec)


@receiver(post_save, sender=ProductImage)
def productimage_post_save_generate_cache(sender, instance: ProductImage, **kwargs) -> None:
    """Eagerly generate cachefiles after saving a ProductImage when enabled."""
    if not getattr(settings, "ENABLE_PRODUCTIMAGE_EAGER_CACHE", False):
        return

    def _run():
        _generate_product_image_cachefiles(instance)

    transaction.on_commit(_run)


@receiver(post_save, sender=ProductColorImage)
def productcolorimage_post_save_generate_cache(sender, instance: ProductColorImage, **kwargs) -> None:
    """Eagerly generate cachefiles after saving a ProductColorImage when enabled."""
    if not getattr(settings, "ENABLE_PRODUCTIMAGE_EAGER_CACHE", False):
        return

    def _run():
        _generate_product_color_image_cachefiles(instance)

    transaction.on_commit(_run)


# -----------------------------------------------------------------------------
# Optional: ProductVariantImage support (only if model exists)
# -----------------------------------------------------------------------------

if "ProductVariantImage" in globals():
    pass


# -----------------------------------------------------------------------------
# InventoryPool -> sync ProductVariant
# -----------------------------------------------------------------------------

@receiver(post_save, sender=InventoryPool)
def inventorypool_post_save_sync_variants(sender, instance: InventoryPool, **kwargs) -> None:
    """Synchronize ProductVariant rows after saving an InventoryPool."""

    def _run():
        sync_variants_for_pool(instance.id)

    transaction.on_commit(_run)