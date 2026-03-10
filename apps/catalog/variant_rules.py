from __future__ import annotations

from typing import Any, Dict, List, Optional

# ----------------------
# Central variant rules
# ----------------------

# Shared sizes for apparel categories
APPAREL_SIZES: List[str] = ["S", "M", "L", "XL", "2XL"]

# Shared colors for apparel categories
APPAREL_COLORS: List[str] = ["Blanco", "Negro", "Beige", "Verde", "Rojo", "Café", "Azul"]

# Shared sizes for shoe categories
SHOE_SIZES: List[str] = ["36", "37", "38", "39", "40", "41", "42"]

# Base canonical rules by variant schema
SCHEMA_VARIANT_RULES: Dict[str, Dict[str, Any]] = {
    "size_color": {
        "label": "Talla",
        "allowed_values": APPAREL_SIZES,
        "allowed_colors": APPAREL_COLORS,
        "use_select": True,
        "normalize_upper": True,
    },
    "shoe_size": {
        "label": "Talla",
        "allowed_values": SHOE_SIZES,
        "allowed_colors": None,
        "use_select": True,
        "normalize_upper": True,
    },
}

# Canonical rules by category slug (override layer)
VARIANT_RULES: Dict[str, Dict[str, Any]] = {
    "camisetas": {
        "label": "Talla",
        "allowed_values": APPAREL_SIZES,
        "allowed_colors": APPAREL_COLORS,
        "use_select": True,
        "normalize_upper": True,
    },
    "zapatillas": {
        "label": "Talla",
        "allowed_values": SHOE_SIZES,
        "allowed_colors": None,
        "use_select": True,
        "normalize_upper": True,
    },
    "hoodies": {
        "label": "Talla",
        "allowed_values": APPAREL_SIZES,
        "allowed_colors": APPAREL_COLORS,
        "use_select": True,
        "normalize_upper": True,
    },
    "camisetas-sin-mangas": {
        "label": "Talla",
        "allowed_values": APPAREL_SIZES,
        "allowed_colors": APPAREL_COLORS,
        "use_select": True,
        "normalize_upper": True,
    },
}

# Default rule (free text)
DEFAULT_VARIANT_RULE: Dict[str, Any] = {
    "label": "Value",
    "allowed_values": None,
    "allowed_colors": None,
    "use_select": False,
    "normalize_upper": True,
}


def resolve_variant_rule(
    category_slug: Optional[str] = None,
    variant_schema: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Resolve the canonical variant rule using:
    1) explicit category slug override
    2) base rule by variant schema
    3) default free-text rule
    """

    slug = (category_slug or "").strip().lower()
    schema = (variant_schema or "").strip().lower()

    if slug and slug in VARIANT_RULES:
        return dict(VARIANT_RULES[slug])

    if schema and schema in SCHEMA_VARIANT_RULES:
        return dict(SCHEMA_VARIANT_RULES[schema])

    return dict(DEFAULT_VARIANT_RULE)


def get_variant_rule(
    category_slug: Optional[str],
    variant_schema: Optional[str] = None,
) -> Dict[str, Any]:
    """Backwards-compatible wrapper around the canonical rule resolver."""

    return resolve_variant_rule(category_slug=category_slug, variant_schema=variant_schema)


# Backwards-compatible alias for older imports/usages.
CATEGORY_VARIANT_RULES = VARIANT_RULES


# Helper functions for canonical allowed values and colors

def get_allowed_values_for_category(
    category_slug: Optional[str],
    variant_schema: Optional[str] = None,
) -> Optional[List[str]]:
    """
    Return the canonical allowed values (e.g. sizes) for a category.

    This ensures every consumer (ProductVariant, InventoryPool, admin forms,
    services, etc.) reads the same source of truth.
    """

    rule = resolve_variant_rule(category_slug=category_slug, variant_schema=variant_schema)
    values = rule.get("allowed_values")

    if not values:
        return None

    # Return a copy to avoid accidental mutation
    return list(values)



def get_allowed_colors_for_category(
    category_slug: Optional[str],
    variant_schema: Optional[str] = None,
) -> Optional[List[str]]:
    """
    Return the canonical allowed colors for a category.

    Colors are expected to already be in canonical display format
    (e.g. 'Negro', 'Blanco', 'Beige').
    """

    rule = resolve_variant_rule(category_slug=category_slug, variant_schema=variant_schema)
    colors = rule.get("allowed_colors")

    if not colors:
        return None

    # Return a copy to avoid accidental mutation
    return list(colors)


# Helper to sort variant values canonically
def sort_variant_values(
    values: List[str],
    category_slug: Optional[str],
    variant_schema: Optional[str] = None,
) -> List[str]:
    """
    Sort variant values using the canonical order defined for a category.

    Rules:
    - If the category has canonical `allowed_values`, known values must follow
      that exact order.
    - Unknown values go to the end, sorted alphabetically.
    - Empty values are ignored.
    - Duplicate values are removed while preserving first appearance.
    """

    rule = resolve_variant_rule(category_slug=category_slug, variant_schema=variant_schema)
    allowed = rule.get("allowed_values") or []

    if not values:
        return []

    normalized = [str(v).strip() for v in values if str(v).strip()]
    unique_values = list(dict.fromkeys(normalized))

    if not allowed:
        return sorted(unique_values)

    order_map = {value: index for index, value in enumerate(allowed)}

    known = [v for v in unique_values if v in order_map]
    unknown = [v for v in unique_values if v not in order_map]

    known.sort(key=lambda v: order_map[v])
    unknown.sort()

    return known + unknown



def normalize_variant_value(value: Optional[str]) -> Optional[str]:
    """Normalize a variant value (trim + uppercase) keeping None as None."""

    if value is None:
        return None
    return str(value).strip().upper()



def normalize_variant_color(color: Optional[str]) -> Optional[str]:
    """
    Normalize a variant color to canonical display format.

    Colors should follow the display format used in VARIANT_RULES
    (e.g. 'Negro', 'Blanco', 'Beige'). This helper ensures that values
    coming from bulk imports, admin forms, services, or APIs are aligned
    with the canonical representation.
    """

    if color is None:
        return None

    value = str(color).strip()
    if not value:
        return ""

    # Capitalize first letter while preserving accents
    return value.capitalize()
