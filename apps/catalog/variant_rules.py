from __future__ import annotations

from typing import Any, Dict, List, Optional

# ----------------------
# Central variant rules
# ----------------------

# Shared sizes for apparel categories
APPAREL_SIZES: List[str] = ["S", "M", "L", "XL", "2XL"]

# Shared colors for apparel categories
APPAREL_COLORS: List[str] = ["Blanco", "Negro", "Beige", "Verde", "Rojo", "Café", "Azul"]

# Rules by category slug
CATEGORY_VARIANT_RULES: Dict[str, Dict[str, Any]] = {
    "camisetas": {
        "label": "Talla",
        "allowed_values": APPAREL_SIZES,
        "allowed_colors": APPAREL_COLORS,
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
    """Return a copy of the variant rule for the given category slug."""

    slug = (category_slug or "").strip().lower()
    rule = CATEGORY_VARIANT_RULES.get(slug, DEFAULT_VARIANT_RULE)
    return dict(rule)


def normalize_variant_value(value: Optional[str]) -> Optional[str]:
    """Normalize a variant value (trim + uppercase) keeping None as None."""

    if value is None:
        return None
    return str(value).strip().upper()
