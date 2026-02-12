"""Stock validation helpers for order items.

Goal: keep ONE source of truth for stock rules across:
- API checkout / validation
- Admin actions
- Order.confirm_payment()

These helpers are intentionally flexible about the `items` shape.
They accept:
- OrderItem-like objects with `.product_variant` and `.quantity`
- dicts like {"product_variant": <variant>, "quantity": 2}

`product_variant` is expected to be a `ProductVariant` instance with:
- `id`
- `stock`
- `is_active`

Any consumer can call:
- `validate_items_stock(items)` to get a structured report
- `assert_items_stock(items)` to raise ValidationError if anything is not sellable
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, List, Optional, Tuple

from django.core.exceptions import ValidationError


@dataclass(frozen=True)
class StockCheckResult:
    """Result row for a single line item stock validation."""

    variant_id: Optional[int]
    ok: bool
    requested: int
    available: int
    is_active: bool
    reason: Optional[str] = None


def _extract_variant_and_qty(item: Any) -> Tuple[Any, int]:
    """Extract (variant, qty) from supported item shapes."""

    # dict shape
    if isinstance(item, dict):
        variant = item.get("product_variant") or item.get("variant")
        qty = item.get("quantity") or item.get("qty")
        return variant, int(qty or 0)

    # OrderItem-like shape
    variant = getattr(item, "product_variant", None) or getattr(item, "variant", None)
    qty = getattr(item, "quantity", None) or getattr(item, "qty", None)
    return variant, int(qty or 0)


def validate_items_stock(items: Iterable[Any]) -> List[StockCheckResult]:
    """Validate each item against stock rules.

    Rules (current):
    - qty must be >= 1
    - variant must exist
    - variant must be active
    - variant.stock must be >= qty (considering the provided aggregated quantity)

    Returns a list of StockCheckResult (one per item) without raising.
    """

    results: List[StockCheckResult] = []

    for item in items:
        variant, qty = _extract_variant_and_qty(item)

        # Basic qty validation
        if qty < 1:
            results.append(
                StockCheckResult(
                    variant_id=getattr(variant, "id", None),
                    ok=False,
                    requested=qty,
                    available=int(getattr(variant, "stock", 0) or 0),
                    is_active=bool(getattr(variant, "is_active", False)),
                    reason="Cantidad inválida.",
                )
            )
            continue

        if variant is None:
            results.append(
                StockCheckResult(
                    variant_id=None,
                    ok=False,
                    requested=qty,
                    available=0,
                    is_active=False,
                    reason="Variante no encontrada.",
                )
            )
            continue

        is_active = bool(getattr(variant, "is_active", False))
        available = int(getattr(variant, "stock", 0) or 0)

        if not is_active:
            results.append(
                StockCheckResult(
                    variant_id=getattr(variant, "id", None),
                    ok=False,
                    requested=qty,
                    available=available,
                    is_active=is_active,
                    reason="Variante inactiva.",
                )
            )
            continue

        if available < qty:
            results.append(
                StockCheckResult(
                    variant_id=getattr(variant, "id", None),
                    ok=False,
                    requested=qty,
                    available=available,
                    is_active=is_active,
                    reason="Stock insuficiente.",
                )
            )
            continue

        results.append(
            StockCheckResult(
                variant_id=getattr(variant, "id", None),
                ok=True,
                requested=qty,
                available=available,
                is_active=is_active,
                reason=None,
            )
        )

    return results


def assert_items_stock(items: Iterable[Any]) -> None:
    """Raise ValidationError if any item is not sellable.

    Uses `validate_items_stock` and aggregates errors into a single ValidationError.

    This is the function you should call from `Order.confirm_payment()` and
    also from any pre-checkout validation endpoint.
    """

    results = validate_items_stock(items)
    errors: List[str] = []

    for r in results:
        if r.ok:
            continue
        vid = r.variant_id if r.variant_id is not None else "?"
        errors.append(f"Variante #{vid}: {r.reason} (solicitado: {r.requested}, disponible: {r.available})")

    if errors:
        raise ValidationError("; ".join(errors))


def sellable_variants_queryset():
    """Return queryset of sellable ProductVariant.

    Centralizes the rule used by Admin selectors/autocomplete:
    - active variants only
    - stock > 0

    Import is local to avoid heavy imports at module load time.

    This is intended for Admin selectors/autocomplete only; checkout/payment must validate stock with row locks.
    """

    from apps.catalog.models import ProductVariant  # local import

    return ProductVariant.objects.filter(is_active=True, stock__gt=0)