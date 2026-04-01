"""
Shared email formatting utilities.

Single source of truth for helpers used across email_context.py
and email_product_media.py.
"""

from __future__ import annotations


def format_cop(amount) -> str:
    if amount is None:
        return "$0"
    try:
        n = int(amount)
    except Exception:
        return "$0"
    return "$" + f"{n:,}".replace(",", ".")


def _build_variant_label(variant) -> str | None:
    if variant is None:
        return None

    value = str(getattr(variant, "value", "") or "").strip()
    color = str(getattr(variant, "color", "") or "").strip().upper()

    if value and color:
        return f"{value} / {color}"
    if value:
        return value
    if color:
        return color
    return None
