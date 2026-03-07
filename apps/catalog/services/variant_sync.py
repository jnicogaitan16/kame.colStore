from dataclasses import dataclass
from typing import Optional

from apps.catalog.models import (
    Category,
    Product,
    ProductVariant,
    InventoryPool,
    ProductColorImage,
)
from apps.catalog.variant_rules import normalize_variant_color, normalize_variant_value


@dataclass
class SyncStats:
    created: int = 0
    updated: int = 0
    deactivated: int = 0
    errors: int = 0


def normalize_value(value: Optional[str]) -> str:
    """Normaliza talla (value) a formato canónico: 'l' -> 'L'."""
    return normalize_variant_value(value) or ""


def normalize_color(color: Optional[str]) -> str:
    """Normaliza color (color) a formato canónico: 'beige' -> 'Beige'."""
    return normalize_variant_color(color) or ""


def _product_has_visual_color_enabled(product: Product, color: str) -> bool:
    """Retorna True si el producto tiene al menos una imagen visual para ese color."""
    normalized_color = normalize_color(color)
    if not normalized_color:
        return False

    return ProductColorImage.objects.filter(
        product=product,
        color__iexact=normalized_color,
    ).exists()


def sync_variants_for_pool(pool_id: int) -> SyncStats:
    """
    Sincroniza variants para un pool específico.

    Flujo:
    1. Leer InventoryPool
    2. Obtener productos afectados por categoría
    3. Crear o actualizar ProductVariant
    """

    stats = SyncStats()

    try:
        pool = InventoryPool.objects.get(id=pool_id)

        schema = pool.category.variant_schema

        if schema == Category.VariantSchema.SIZE_COLOR:
            value = normalize_value(pool.value)
            color = normalize_color(pool.color)
        elif schema == Category.VariantSchema.JEAN_SIZE:
            value = normalize_value(pool.value)
            color = ""
        elif schema == Category.VariantSchema.SHOE_SIZE:
            value = normalize_value(pool.value)
            color = ""
        elif schema == Category.VariantSchema.NO_VARIANT:
            value = ""
            color = ""
        else:
            raise ValueError(f"Unsupported variant schema: {schema}")

        products = Product.objects.filter(category_id=pool.category_id)

        for product in products:

            if schema == Category.VariantSchema.SIZE_COLOR:
                desired_is_active = pool.is_active and _product_has_visual_color_enabled(product, color)
            else:
                desired_is_active = pool.is_active

            # 1) Buscar variante existente de forma case-insensitive para evitar duplicados
            existing_qs = (
                ProductVariant.objects
                .filter(product=product, value__iexact=value, color__iexact=color)
                .order_by("id")
            )
            variant = existing_qs.first()

            if variant is not None:
                # 2) Reparar/normalizar la variante existente al formato canónico
                update_fields = []

                if variant.value != value:
                    variant.value = value
                    update_fields.append("value")

                if variant.color != color:
                    variant.color = color
                    update_fields.append("color")

                # 3) Sincronizar stock / estado
                if variant.stock != pool.quantity:
                    variant.stock = pool.quantity
                    update_fields.append("stock")

                if variant.is_active != desired_is_active:
                    variant.is_active = desired_is_active
                    update_fields.append("is_active")

                if update_fields:
                    variant.save(update_fields=update_fields)
                    stats.updated += 1

                # 4) Si ya existían duplicados por diferencias de mayúsculas/minúsculas, desactivarlos
                duplicates_qs = existing_qs.exclude(id=variant.id)
                if duplicates_qs.exists():
                    deactivated_count = duplicates_qs.update(is_active=False)
                    stats.deactivated += int(deactivated_count or 0)

                continue

            # 5) Si no existe, crear la variante en formato canónico
            ProductVariant.objects.create(
                product=product,
                value=value,
                color=color,
                stock=pool.quantity,
                is_active=desired_is_active,
            )
            stats.created += 1

    except Exception:
        stats.errors += 1

    return stats


def sync_variants_for_category(category_id: int) -> SyncStats:
    """
    Sincroniza todos los pools de una categoría.
    """

    stats = SyncStats()

    pools = InventoryPool.objects.filter(category_id=category_id)

    for pool in pools:
        result = sync_variants_for_pool(pool.id)

        stats.created += result.created
        stats.updated += result.updated
        stats.deactivated += result.deactivated
        stats.errors += result.errors

    return stats