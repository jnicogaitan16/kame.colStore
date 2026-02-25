"""Stock validation helpers for order items.

Goal: keep ONE source of truth for stock rules across:
- API checkout / validation
- Admin actions
- Order.confirm_payment() / order paid confirmation

Source of truth:
- InventoryPool (apps.catalog.models.InventoryPool)
- ProductVariant.stock is LEGACY (read-only) and must NOT be used for checkout/payment.

These helpers are intentionally flexible about the `items` shape.
They accept:
- OrderItem-like objects with `.product_variant` and `.quantity`
- dicts like {"product_variant": <variant>, "quantity": 2}

`product_variant` is expected to be a `ProductVariant` instance with:
- `id`
- `is_active`
- `product.category_id` (for InventoryPool keying)
- `value` / `color`

Any consumer can call:
- `validate_items_stock(items)` to get a structured report
- `assert_items_stock(items)` to raise ValidationError if anything is not sellable
- `decrement_items_stock(items)` to safely decrement InventoryPool during confirmation
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, List, Optional, Tuple

from django.core.exceptions import ValidationError

from django.db import transaction

from apps.catalog.models import InventoryPool

from apps.catalog.services.inventory import (
    OutOfStockError,
    consume_stock,
    get_pool_map,
    get_variant_available_stock,
)


@dataclass(frozen=True)
class StockCheckResult:
    """Result row for a single line item stock validation."""

    variant_id: Optional[int]
    ok: bool
    requested: int
    available: int
    is_active: bool
    reason: Optional[str] = None


@dataclass(frozen=True)
class PoolKey:
    category_id: int
    value: str
    color: str


def _norm_value(v: str) -> str:
    return (v or "").strip().upper()


def _norm_color(c: str) -> str:
    return (c or "").strip()


def get_pool_available(category_id: int, value: str, color: str) -> int:
    """Return available quantity from InventoryPool for a given key.

    Note: This is a low-level helper. Most validation paths should still prefer
    using `get_pool_map` + `get_variant_available_stock` to avoid N queries.
    """
    value_n = _norm_value(value)
    color_n = _norm_color(color)

    pool = (
        InventoryPool.objects.filter(
            category_id=category_id,
            value=value_n,
            color=color_n,
            is_active=True,
        )
        .only("quantity")
        .first()
    )

    return int(pool.quantity if pool else 0)


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


def _variant_category_id(variant: Any) -> int:
    """Return category id for InventoryPool keying (best effort)."""
    # variant.category_id (if exists)
    try:
        cid = int(getattr(variant, "category_id", 0) or 0)
    except Exception:
        cid = 0
    if cid > 0:
        return cid

    product = getattr(variant, "product", None)
    if product is None:
        return 0

    try:
        cid = int(getattr(product, "category_id", 0) or 0)
    except Exception:
        cid = 0
    if cid > 0:
        return cid

    category = getattr(product, "category", None)
    try:
        cid = int(getattr(category, "id", 0) or 0)
    except Exception:
        cid = 0
    return cid if cid > 0 else 0


def validate_items_stock(items: Iterable[Any]) -> List[StockCheckResult]:
    """Validate each item against stock rules.

    Rules (current):
    - qty must be >= 1
    - variant must exist
    - variant must be active
    - variant must be available in InventoryPool (considering the provided aggregated quantity)

    Returns a list of StockCheckResult (one per item) without raising.
    """

    results: List[StockCheckResult] = []

    # First pass: normalize items and aggregate requested quantities per POOL KEY
    normalized: List[Tuple[Any, int]] = []
    aggregated_by_key: dict[Tuple[int, str, str], int] = {}
    key_by_variant_id: dict[int, Tuple[int, str, str]] = {}

    for item in items:
        variant, qty = _extract_variant_and_qty(item)

        # Basic qty validation
        if qty < 1:
            results.append(
                StockCheckResult(
                    variant_id=getattr(variant, "id", None),
                    ok=False,
                    requested=qty,
                    available=0,
                    is_active=bool(getattr(variant, "is_active", False)) if variant else False,
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

        normalized.append((variant, qty))

        # Pool key = (category_id, value_norm, color_norm)
        cid = _variant_category_id(variant)
        value = _norm_value(str(getattr(variant, "value", "") or ""))
        color = _norm_color(str(getattr(variant, "color", "") or ""))
        key = (int(cid or 0), value, color)

        vid = int(getattr(variant, "id", 0) or 0)
        if vid:
            key_by_variant_id[vid] = key

        aggregated_by_key[key] = aggregated_by_key.get(key, 0) + int(qty)

    # Second pass: for each category, build a pool map once and validate
    pool_maps_by_category: dict[int, dict] = {}

    for variant, qty in normalized:
        vid = getattr(variant, "id", None)
        is_active = bool(getattr(variant, "is_active", False))

        # Determine category_id
        category_id = getattr(getattr(variant, "product", None), "category_id", None)
        try:
            category_id_int = int(category_id or 0)
        except Exception:
            category_id_int = 0

        if not is_active:
            # Even if inactive, show available from pool (if resolvable)
            if category_id_int and category_id_int not in pool_maps_by_category:
                pool_maps_by_category[category_id_int] = get_pool_map(category_id_int)
            pool_map = pool_maps_by_category.get(category_id_int) if category_id_int else None
            available = int(get_variant_available_stock(variant, pool_map=pool_map) or 0)

            results.append(
                StockCheckResult(
                    variant_id=vid,
                    ok=False,
                    requested=qty,
                    available=available,
                    is_active=is_active,
                    reason="Variante inactiva.",
                )
            )
            continue

        # Build pool map once per category
        if category_id_int and category_id_int not in pool_maps_by_category:
            pool_maps_by_category[category_id_int] = get_pool_map(category_id_int)
        pool_map = pool_maps_by_category.get(category_id_int) if category_id_int else None

        available = int(get_variant_available_stock(variant, pool_map=pool_map) or 0)

        # Compare against aggregated requested qty for this POOL KEY
        requested_total = qty
        try:
            if vid is not None:
                key = key_by_variant_id.get(int(vid))
                if key is not None:
                    requested_total = int(aggregated_by_key.get(key, qty))
        except Exception:
            requested_total = qty

        if available < requested_total:
            results.append(
                StockCheckResult(
                    variant_id=vid,
                    ok=False,
                    requested=requested_total,
                    available=available,
                    is_active=is_active,
                    reason="Stock insuficiente.",
                )
            )
            continue

        results.append(
            StockCheckResult(
                variant_id=vid,
                ok=True,
                requested=requested_total,
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


def decrement_items_stock(items: Iterable[Any]) -> None:
    """Decrement InventoryPool for the provided items.

    Contract (order confirmation / paid):
    - For each item:
      - assert_stock_available(variant, qty)
      - consume_stock(category_id, value, color, qty)

    Safety:
    - single transaction for the whole order
    - row locks handled inside decrement_pool_stock() via select_for_update
    """

    # Normalize + aggregate per POOL KEY to avoid double-decrement
    aggregated: dict[Tuple[int, str, str], Tuple[Any, int]] = {}

    for item in items:
        variant, qty = _extract_variant_and_qty(item)
        if variant is None:
            continue
        try:
            qty_int = int(qty or 0)
        except Exception:
            qty_int = 0
        if qty_int <= 0:
            continue

        category_id = _variant_category_id(variant)
        if not category_id:
            continue

        value = _norm_value(str(getattr(variant, "value", "") or ""))
        color = _norm_color(str(getattr(variant, "color", "") or ""))
        key = (int(category_id), value, color)

        if key in aggregated:
            v0, q0 = aggregated[key]
            aggregated[key] = (v0, q0 + qty_int)
        else:
            aggregated[key] = (variant, qty_int)

    # Validate first (consistent report)
    assert_items_stock([{ "product_variant": v, "quantity": q } for (v, q) in aggregated.values()])

    with transaction.atomic():
        for (category_id, value, color), (_variant, qty) in aggregated.items():
            try:
                consume_stock(int(category_id), value, color, int(qty))
            except OutOfStockError as e:
                raise ValidationError(e.message)


def sellable_variants_queryset():
    """Return queryset of variants eligible to be selected.

    Admin selector/autocomplete should not depend on legacy `variant.stock`.
    Availability must be validated against InventoryPool during checkout/payment.
    """

    from apps.catalog.models import ProductVariant  # local import

    return ProductVariant.objects.filter(is_active=True)