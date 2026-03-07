from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from collections import defaultdict
from typing import Any, DefaultDict, Dict, Iterable, List, Optional, Tuple

from django.core.exceptions import ValidationError
from django.db.models import QuerySet

from apps.orders.services.product_variants import get_product_variant_model
from apps.catalog.services.inventory import get_pool_map, get_variant_available_stock


@dataclass(frozen=True)
class CartLine:
    """DB-aware cart line for UI/checkout previews."""

    variant: Any
    product: Any
    qty: int
    unit_price: Decimal
    line_total: Decimal
    available_stock: Optional[int]
    is_available: bool


def _to_decimal(value: Any) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal("0")


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _norm_value(v: Any) -> str:
    return (str(v or "")).strip().upper()


def _norm_color(c: Any) -> str:
    return (str(c or "")).strip()


def _variant_pool_key(variant: Any) -> Tuple[int, str, str]:
    """Pool key = (category_id, value_norm, color_norm)."""
    category_id = _get_variant_category_id(variant)
    value = _norm_value(getattr(variant, "value", None))
    color = _norm_color(getattr(variant, "color", None))
    return int(category_id or 0), value, color


def _get_variant_category_id(variant: Any) -> int:
    """Best-effort category id extraction for pooling.

    InventoryPool is keyed by category_id + (value,color).
    """
    # Direct field on variant
    cid = _safe_int(getattr(variant, "category_id", None), default=0)
    if cid > 0:
        return cid

    product = getattr(variant, "product", None)
    if product is None:
        return 0

    # Common patterns: product.category_id or product.category.id
    cid = _safe_int(getattr(product, "category_id", None), default=0)
    if cid > 0:
        return cid

    category = getattr(product, "category", None)
    cid = _safe_int(getattr(category, "id", None), default=0)
    if cid > 0:
        return cid

    return 0


def _get_available_stock(
    variant: Any,
    *,
    pool_maps_by_category: Optional[Dict[int, Dict[Tuple[str, str], int]]] = None,
) -> int:
    """Return available stock for a variant from InventoryPool.

    Contract:
    - Stock validation MUST use InventoryPool as source of truth.
    - If `pool_maps_by_category` is provided, it will be used as a cache to avoid N queries.
    """
    category_id = _get_variant_category_id(variant)
    if category_id <= 0:
        return 0

    pool_map: Optional[Dict[Tuple[str, str], int]] = None
    if pool_maps_by_category is not None:
        pool_map = pool_maps_by_category.get(category_id)
        if pool_map is None:
            pool_map = get_pool_map(category_id)
            pool_maps_by_category[category_id] = pool_map

    return int(get_variant_available_stock(variant, pool_map=pool_map) or 0)


def validate_cart_stock(items: List[dict], *, strict_stock: bool | None = None, **_kwargs: Any) -> Dict[str, Any]:
    """Validate stock for a cart payload against InventoryPool.

    New contract (Pool):
      - For each item, calculate availability from InventoryPool.
      - Compare requested vs available.
      - If requested > available: add a warning keyed by variant.id.
      - Do NOT raise ValidationError for stock.
      - Always return a uniform structure:
        {"ok": bool, "warningsByVariantId": {...}, "hintsByVariantId": {...}}

    items: [{"product_variant_id": int, "quantity": int}, ...]
    strict_stock is accepted for backward-compatibility and is ignored.
    """

    warnings: Dict[int, dict] = {}
    hints: Dict[int, dict] = {}

    if not items:
        return {
            "ok": True,
            "warnings": {str(k): v for k, v in warnings.items()},
            "hints": {str(k): v for k, v in hints.items()},
            "warningsByVariantId": {str(k): v for k, v in warnings.items()},
            "hintsByVariantId": {str(k): v for k, v in hints.items()},
        }

    # Normalize and collect variant ids
    normalized: List[Tuple[int, int]] = []
    variant_ids: List[int] = []
    for item in items:
        variant_id = _safe_int((item or {}).get("product_variant_id"), default=0)
        requested = _safe_int((item or {}).get("quantity"), default=0)
        if variant_id <= 0 or requested <= 0:
            continue
        normalized.append((variant_id, requested))
        variant_ids.append(variant_id)

    if not normalized:
        return {
            "ok": True,
            "warnings": {str(k): v for k, v in warnings.items()},
            "hints": {str(k): v for k, v in hints.items()},
            "warningsByVariantId": {str(k): v for k, v in warnings.items()},
            "hintsByVariantId": {str(k): v for k, v in hints.items()},
        }

    variants = list(_fetch_variants(variant_ids))
    by_id = {v.id: v for v in variants}

    missing_ids = [vid for vid in variant_ids if vid not in by_id]
    if missing_ids:
        raise ValidationError({"items": "Hay variantes inexistentes en el carrito."})

    # Cache pool maps by category to avoid N queries
    pool_maps_by_category: Dict[int, Dict[Tuple[str, str], int]] = {}

    # Pool-first aggregation: group requested qty per canonical pool key (category_id, value, color).
    # This supports all current schemas:
    # - size_color => (value, color)
    # - jean_size / shoe_size => (value, "")
    # - no_variant => ("", "")
    grouped_qty_by_key: DefaultDict[Tuple[int, str, str], int] = defaultdict(int)
    variant_key_by_id: Dict[int, Tuple[int, str, str]] = {}

    for variant_id, requested in normalized:
        variant = by_id[variant_id]
        key = _variant_pool_key(variant)
        grouped_qty_by_key[key] += int(requested)
        variant_key_by_id[variant_id] = key

    # Compute availability per pool key once.
    # Important: not every valid schema requires both value and color.
    # Examples:
    # - no_variant => ("", "")
    # - jean_size / shoe_size => (value, "")
    # - size_color => (value, color)
    # Therefore we must never force availability=0 just because value or color is blank.
    key_available: Dict[Tuple[int, str, str], int] = {}
    for (category_id, value, color), _requested_total in grouped_qty_by_key.items():
        if category_id <= 0:
            key_available[(category_id, value, color)] = 0
            continue

        pool_map = pool_maps_by_category.get(category_id)
        if pool_map is None:
            try:
                pool_map = get_pool_map(category_id)
            except Exception:
                pool_map = {}
            pool_maps_by_category[category_id] = pool_map

        try:
            available = int((pool_map or {}).get((value, color), 0) or 0)
        except Exception:
            available = 0

        key_available[(category_id, value, color)] = max(0, available)

    # Emit warnings/hints per variant id, but using pooled totals
    for variant_id, _requested in normalized:
        key = variant_key_by_id[variant_id]
        available = int(key_available.get(key, 0) or 0)
        requested_total = int(grouped_qty_by_key.get(key, 0) or 0)

        # Hint: last unit
        if available == 1 and requested_total == 1:
            hints[variant_id] = {"kind": "last_unit", "message": "Última unidad disponible"}

        if requested_total > available:
            warnings[variant_id] = {
                "status": "insufficient",
                "requested": requested_total,
                "available": available,
                "message": "Stock insuficiente",
            }

    ok = len(warnings) == 0
    warnings_s = {str(k): v for k, v in warnings.items()}
    hints_s = {str(k): v for k, v in hints.items()}

    return {
        "ok": ok,
        "warnings": warnings_s,
        "hints": hints_s,
        "warningsByVariantId": warnings_s,
        "hintsByVariantId": hints_s,
    }


def _get_unit_price(variant: Any) -> Decimal:
    """Resolve unit price for a variant.

    Priority:
    1) ProductVariant.price / unit_price (if exists)
    2) Product.price
    """
    for attr in ("price", "unit_price"):
        if hasattr(variant, attr):
            raw = getattr(variant, attr)
            if raw is not None:
                return _to_decimal(raw)

    product = getattr(variant, "product", None)
    if product is not None and hasattr(product, "price"):
        return _to_decimal(getattr(product, "price"))

    return Decimal("0")


def _fetch_variants(variant_ids: Iterable[int]) -> QuerySet:
    ProductVariant = get_product_variant_model()
    return ProductVariant.objects.select_related("product").filter(id__in=list(variant_ids))


def _normalize_cart(cart: dict) -> Dict[int, int]:
    normalized: Dict[int, int] = {}
    for k, v in (cart or {}).items():
        variant_id = _safe_int(k, default=0)
        if variant_id <= 0:
            continue
        qty = _safe_int((v or {}).get("qty"), default=0)
        if qty <= 0:
            continue
        normalized[variant_id] = qty
    return normalized


def validate_cart_lines(cart: dict, *, strict_stock: bool = False) -> Tuple[List[CartLine], Decimal]:
    """DB-aware validation for UI/checkout previews.

    Returns (lines, subtotal) with detailed information.

    If strict_stock=True:
      - raises ValidationError when any line qty > available stock.
    Otherwise:
      - marks `is_available=False` on lines that exceed stock.
    """

    normalized = _normalize_cart(cart)
    if not normalized:
        return [], Decimal("0")

    variants = list(_fetch_variants(normalized.keys()))
    by_id = {v.id: v for v in variants}

    missing_ids = [vid for vid in normalized.keys() if vid not in by_id]
    if missing_ids:
        raise ValidationError({"cart": "Hay variantes inexistentes en el carrito."})

    lines: List[CartLine] = []
    subtotal = Decimal("0")

    # Precompute grouped requested qty per pool-key and availability per key
    grouped_qty_by_key: DefaultDict[Tuple[int, str, str], int] = defaultdict(int)
    variant_key_by_id: Dict[int, Tuple[int, str, str]] = {}

    for variant_id, qty in normalized.items():
        variant = by_id[variant_id]
        key = _variant_pool_key(variant)
        grouped_qty_by_key[key] += int(qty)
        variant_key_by_id[variant_id] = key

    pool_maps_by_category: Dict[int, Dict[Tuple[str, str], int]] = {}
    key_available: Dict[Tuple[int, str, str], int] = {}

    for (category_id, value, color), _requested_total in grouped_qty_by_key.items():
        if category_id <= 0:
            key_available[(category_id, value, color)] = 0
            continue
        pool_map = pool_maps_by_category.get(category_id)
        if pool_map is None:
            pool_map = get_pool_map(category_id)
            pool_maps_by_category[category_id] = pool_map
        key_available[(category_id, value, color)] = int(pool_map.get((value, color), 0) or 0)

    for variant_id, qty in normalized.items():
        variant = by_id[variant_id]
        product = getattr(variant, "product", None)

        unit_price = _get_unit_price(variant)
        if unit_price <= 0:
            raise ValidationError(f"No se pudo determinar el precio para '{variant}'.")

        line_total = unit_price * Decimal(qty)

        # Pool-first + aggregated validation: group by (category_id, value, color)
        # We compute grouped totals once per call (outside the loop) and then reuse here.
        # (Implementation below relies on two dicts: grouped_qty_by_key and key_available.)
        key = _variant_pool_key(variant)
        available = key_available.get(key, 0)
        requested_total = grouped_qty_by_key.get(key, 0)

        is_ok = True
        if requested_total > available:
            is_ok = False
            if strict_stock:
                raise ValidationError({"qty": "Cantidad solicitada supera el stock disponible."})

        lines.append(
            CartLine(
                variant=variant,
                product=product,
                qty=qty,
                unit_price=unit_price,
                line_total=line_total,
                available_stock=available,
                is_available=is_ok,
            )
        )

        subtotal += line_total

    return lines, subtotal


def validate_cart(cart: dict, *, strict_stock: bool = True) -> Tuple[Dict[int, dict], int]:
    """Valida el carrito y calcula el subtotal (para creación de orden).

    cart: {variant_id: {"qty": int}, ...}

    Retorna:
      (validated_items, subtotal_int)

    - validated_items: {variant_id: {"qty": int, "unit_price": int}, ...}
    - subtotal_int: subtotal en entero (p.ej. COP)

    Nota:
    - Este módulo NO maneja lógica de sesión. Eso vive en `apps.orders.services.cart` (u otro servicio de sesión).
    - `strict_stock` por defecto es True para evitar sobreventa.
    """

    lines, subtotal = validate_cart_lines(cart, strict_stock=strict_stock)
    if not lines:
        raise ValidationError("El carrito está vacío.")

    validated_items: Dict[int, dict] = {}
    for line in lines:
        variant_id = getattr(line.variant, "id", None)
        if not variant_id:
            continue

        # Convert price to int money (COP) safely
        unit_price_int = int(line.unit_price)
        if unit_price_int <= 0:
            raise ValidationError(f"No se pudo determinar el precio para '{line.variant}'.")

        validated_items[int(variant_id)] = {"qty": int(line.qty), "unit_price": unit_price_int}

    return validated_items, int(subtotal)
