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

# Canonical rules by category slug (single source of truth)
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


def get_variant_rule(category_slug: Optional[str]) -> Dict[str, Any]:
    """Return the canonical variant rule for the given category slug."""

    slug = (category_slug or "").strip().lower()
    rule = VARIANT_RULES.get(slug, DEFAULT_VARIANT_RULE)
    return dict(rule)


# Backwards-compatible alias for older imports/usages.
CATEGORY_VARIANT_RULES = VARIANT_RULES


# Helper functions for canonical allowed values and colors
def get_allowed_values_for_category(category_slug: Optional[str]) -> Optional[List[str]]:
    """
    Return the canonical allowed values (e.g. sizes) for a category.

    This ensures every consumer (ProductVariant, InventoryPool, admin forms,
    services, etc.) reads the same source of truth.
    """

    rule = get_variant_rule(category_slug)
    values = rule.get("allowed_values")

    if not values:
        return None

    # Return a copy to avoid accidental mutation
    return list(values)


def get_allowed_colors_for_category(category_slug: Optional[str]) -> Optional[List[str]]:
    """
    Return the canonical allowed colors for a category.

    Colors are expected to already be in canonical display format
    (e.g. 'Negro', 'Blanco', 'Beige').
    """

    rule = get_variant_rule(category_slug)
    colors = rule.get("allowed_colors")

    if not colors:
        return None

    # Return a copy to avoid accidental mutation
    return list(colors)


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
