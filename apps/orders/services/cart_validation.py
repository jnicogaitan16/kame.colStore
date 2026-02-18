from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional, Tuple

from django.core.exceptions import ValidationError
from django.db.models import QuerySet

from apps.orders.services.product_variants import get_product_variant_model


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


def _get_available_stock(variant: Any) -> int:
    """Return available stock for a variant.

    Contract: stock validation MUST use EXCLUSIVELY `variant.stock`.
    No fallbacks to product stock, stock_total, annotations, or other fields.
    """
    raw = getattr(variant, "stock", 0)
    return _safe_int(raw, default=0)
def validate_cart_stock(items: List[dict], *, strict_stock: bool = True) -> Dict[str, Dict[int, dict]]:
    """Validate stock for a cart payload.

    This function is intentionally minimal and ONLY depends on `variant.stock`.

    items: [{"product_variant_id": int, "quantity": int}, ...]

    Returns:
      {"warnings": {variant_id: {...}}, "hints": {variant_id: {...}}}

    If strict_stock=True and any insufficient stock is found, raises ValidationError.
    """

    warnings: Dict[int, dict] = {}
    hints: Dict[int, dict] = {}

    if not items:
        return {"warnings": warnings, "hints": hints}

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
        return {"warnings": warnings, "hints": hints}

    variants = list(_fetch_variants(variant_ids))
    by_id = {v.id: v for v in variants}

    missing_ids = [vid for vid in variant_ids if vid not in by_id]
    if missing_ids:
        raise ValidationError({"items": "Hay variantes inexistentes en el carrito."})

    for variant_id, requested in normalized:
        variant = by_id[variant_id]
        available = _get_available_stock(variant)

        if requested > available:
            warnings[variant_id] = {
                "status": "insufficient",
                "available": available,
                "requested": requested,
                "message": f"Solo hay {available} unidad(es) disponible(s)",
            }

        elif available == 1 and requested == 1:
            hints[variant_id] = {
                "kind": "last_unit",
                "message": "Última unidad disponible",
            }

    if strict_stock and warnings:
        raise ValidationError({"stock": "Cantidad solicitada supera el stock disponible."})

    return {"warnings": warnings, "hints": hints}


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

    for variant_id, qty in normalized.items():
        variant = by_id[variant_id]
        product = getattr(variant, "product", None)

        unit_price = _get_unit_price(variant)
        if unit_price <= 0:
            raise ValidationError(f"No se pudo determinar el precio para '{variant}'.")

        line_total = unit_price * Decimal(qty)
        available = _get_available_stock(variant)

        is_ok = True
        if available is not None and qty > available:
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
