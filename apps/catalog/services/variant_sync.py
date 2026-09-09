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

        # Pre-fetch which products have images for this color (1 query vs N)
        if schema == Category.VariantSchema.SIZE_COLOR:
            products_with_color = set(
                ProductColorImage.objects.filter(
                    product__category_id=pool.category_id,
                    color__iexact=color,
                ).values_list("product_id", flat=True).distinct()
            )

        for product in products:

            if schema == Category.VariantSchema.SIZE_COLOR:
                # Only create/activate variants for colors the product actually has images for.
                # This prevents colors from other products in the same category from leaking.
                if product.id not in products_with_color:
                    existing_qs = (
                        ProductVariant.objects
                        .filter(product=product, value__iexact=value, color__iexact=color, is_active=True)
                    )
                    deactivated = existing_qs.update(is_active=False)
                    stats.deactivated += deactivated
                    continue
                desired_is_active = pool.is_active and pool.quantity > 0
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


def sync_variants_for_product(product_id: int) -> SyncStats:
    """Sync variants for a single product based on its color images and category pool.

    More efficient than sync_variants_for_category when only one product's images changed.
    Pre-fetches the product's image colors once to avoid N+1 queries.
    """
    stats = SyncStats()

    try:
        product = Product.objects.select_related("category").get(pk=product_id)
    except Product.DoesNotExist:
        stats.errors += 1
        return stats

    category = product.category
    if not category:
        return stats

    schema = category.variant_schema

    # Pre-fetch all colors this product has images for (single query)
    product_colors_normalized: set[str] = set()
    if schema == Category.VariantSchema.SIZE_COLOR:
        raw_colors = (
            ProductColorImage.objects.filter(product=product)
            .values_list("color", flat=True)
            .distinct()
        )
        product_colors_normalized = {normalize_color(c) for c in raw_colors if c}

    pools = InventoryPool.objects.filter(category_id=category.id)

    for pool in pools:
        if schema == Category.VariantSchema.SIZE_COLOR:
            value = normalize_value(pool.value)
            color = normalize_color(pool.color)
        elif schema in (Category.VariantSchema.JEAN_SIZE, Category.VariantSchema.SHOE_SIZE):
            value = normalize_value(pool.value)
            color = ""
        elif schema == Category.VariantSchema.NO_VARIANT:
            value = ""
            color = ""
        else:
            continue

        if schema == Category.VariantSchema.SIZE_COLOR:
            if color not in product_colors_normalized:
                deactivated = (
                    ProductVariant.objects
                    .filter(product=product, value__iexact=value, color__iexact=color, is_active=True)
                    .update(is_active=False)
                )
                stats.deactivated += deactivated
                continue
            desired_is_active = pool.is_active and pool.quantity > 0
        else:
            desired_is_active = pool.is_active

        existing_qs = (
            ProductVariant.objects
            .filter(product=product, value__iexact=value, color__iexact=color)
            .order_by("id")
        )
        variant = existing_qs.first()

        if variant is not None:
            update_fields = []
            if variant.value != value:
                variant.value = value
                update_fields.append("value")
            if variant.color != color:
                variant.color = color
                update_fields.append("color")
            if variant.stock != pool.quantity:
                variant.stock = pool.quantity
                update_fields.append("stock")
            if variant.is_active != desired_is_active:
                variant.is_active = desired_is_active
                update_fields.append("is_active")
            if update_fields:
                variant.save(update_fields=update_fields)
                stats.updated += 1

            duplicates_qs = existing_qs.exclude(id=variant.id)
            if duplicates_qs.exists():
                deactivated_count = duplicates_qs.update(is_active=False)
                stats.deactivated += int(deactivated_count or 0)
            continue

        ProductVariant.objects.create(
            product=product,
            value=value,
            color=color,
            stock=pool.quantity,
            is_active=desired_is_active,
        )
        stats.created += 1

    return stats