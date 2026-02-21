

"""Catalog signals.

Genera cachefiles de ImageKit al guardar imágenes desde admin (o cualquier save)
para evitar la generación en primera visita (que produce timeouts/latencia/502).

- ProductImage: genera image_thumb + image_medium (+ image_large si existe)
- ProductVariantImage (si existe en el proyecto): mismo patrón

Notas:
- Usamos transaction.on_commit para ejecutar después del commit.
- La generación es no-bloqueante: si falla un spec, seguimos con los demás.
"""

from __future__ import annotations

import logging

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from imagekit.cachefiles import ImageCacheFile

from .models import ProductImage

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


@receiver(post_save, sender=ProductImage)
def productimage_post_save_generate_cache(sender, instance: ProductImage, **kwargs) -> None:
    """Eagerly generate cachefiles after saving a ProductImage."""

    def _run():
        _generate_product_image_cachefiles(instance)

    transaction.on_commit(_run)


# -----------------------------------------------------------------------------
# Optional: Variant image model support (only if your project defines it)
# -----------------------------------------------------------------------------

try:
    from .models import ProductVariantImage  # type: ignore

    def _generate_variant_image_cachefiles(instance: "ProductVariantImage") -> None:
        if not getattr(instance, "image", None):
            return
        for attr in ("image_thumb", "image_medium", "image_large"):
            spec = getattr(instance, attr, None)
            _safe_generate(spec)


    @receiver(post_save, sender=ProductVariantImage)  # type: ignore
    def variantimage_post_save_generate_cache(sender, instance: "ProductVariantImage", **kwargs) -> None:
        def _run():
            _generate_variant_image_cachefiles(instance)

        transaction.on_commit(_run)

except Exception:
    # If there's no variant image model, do nothing.
    pass