from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional, Tuple

from django.core.exceptions import ValidationError
from django.db.models import QuerySet

from apps.catalog.models import Product, ProductVariant


CART_SESSION_KEY = "cart"


@dataclass(frozen=True)
class CartLine:
    variant: ProductVariant
    product: Product
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
        v = int(value)
        return v
    except Exception:
        return default


def _get_available_stock(variant: ProductVariant) -> Optional[int]:
    """Return available stock for a variant if the project has stock fields.

    We keep this defensive because field names can vary between iterations.
    """
    for attr in ("stock", "stock_qty", "quantity", "qty"):
        if hasattr(variant, attr):
            raw = getattr(variant, attr)
            if raw is None:
                return None
            return _safe_int(raw, default=0)

    # If variant has no stock field, fallback to product (if any)
    product = getattr(variant, "product", None)
    if product is not None:
        for attr in ("stock", "stock_qty", "quantity", "qty"):
            if hasattr(product, attr):
                raw = getattr(product, attr)
                if raw is None:
                    return None
                return _safe_int(raw, default=0)

    return None


def _get_unit_price(variant: ProductVariant) -> Decimal:
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
        raw = getattr(product, "price")
        return _to_decimal(raw)

    return Decimal("0")


def get_cart(request) -> Dict[str, Dict[str, Any]]:
    """Return the cart dict stored in session.

    Structure:
      request.session["cart"] = {
        "<variant_id>": {"qty": 2},
        ...
      }
    """
    cart = request.session.get(CART_SESSION_KEY)
    if not isinstance(cart, dict):
        cart = {}
        request.session[CART_SESSION_KEY] = cart
    return cart


def clear_cart(request) -> None:
    request.session[CART_SESSION_KEY] = {}
    request.session.modified = True


def add_to_cart(request, variant_id: int, qty: int = 1, *, enforce_stock: bool = True) -> None:
    cart = get_cart(request)

    v_id = str(variant_id)
    qty = max(0, _safe_int(qty, default=0))
    if qty <= 0:
        return

    current_qty = _safe_int(cart.get(v_id, {}).get("qty"), default=0)
    new_qty = current_qty + qty

    if enforce_stock:
        variant = ProductVariant.objects.select_related("product").filter(id=variant_id).first()
        if not variant:
            raise ValidationError({"variant_id": "Product variant no existe."})

        available = _get_available_stock(variant)
        if available is not None and new_qty > available:
            raise ValidationError({"qty": "Cantidad solicitada supera el stock disponible."})

    cart[v_id] = {"qty": new_qty}
    request.session[CART_SESSION_KEY] = cart
    request.session.modified = True


def remove_from_cart(request, variant_id: int) -> None:
    cart = get_cart(request)
    v_id = str(variant_id)
    if v_id in cart:
        cart.pop(v_id, None)
        request.session[CART_SESSION_KEY] = cart
        request.session.modified = True


def update_qty(request, variant_id: int, qty: int, *, enforce_stock: bool = True) -> None:
    cart = get_cart(request)
    v_id = str(variant_id)

    qty = max(0, _safe_int(qty, default=0))

    if qty <= 0:
        if v_id in cart:
            cart.pop(v_id, None)
            request.session[CART_SESSION_KEY] = cart
            request.session.modified = True
        return

    if enforce_stock:
        variant = ProductVariant.objects.select_related("product").filter(id=variant_id).first()
        if not variant:
            raise ValidationError({"variant_id": "Product variant no existe."})

        available = _get_available_stock(variant)
        if available is not None and qty > available:
            raise ValidationError({"qty": "Cantidad solicitada supera el stock disponible."})

    cart[v_id] = {"qty": qty}
    request.session[CART_SESSION_KEY] = cart
    request.session.modified = True


def _fetch_variants(variant_ids: Iterable[int]) -> QuerySet[ProductVariant]:
    return (
        ProductVariant.objects.select_related("product")
        .filter(id__in=list(variant_ids))
    )


def validate_cart(
    cart: Dict[str, Dict[str, Any]],
    *,
    strict_stock: bool = False,
) -> Tuple[List[CartLine], Decimal]:
    """Validate a cart dict and return detailed lines + subtotal.

    Note: You already validate stock again when creating the order.
    This function is still useful to show UI feedback early (optional).

    If strict_stock=True:
      - raises ValidationError when any line qty > available stock.
    Otherwise:
      - marks `is_available=False` on lines that exceed stock.
    """

    # Normalize ids and quantities
    normalized: Dict[int, int] = {}
    for k, v in (cart or {}).items():
        variant_id = _safe_int(k, default=0)
        if variant_id <= 0:
            continue
        qty = _safe_int((v or {}).get("qty"), default=0)
        if qty <= 0:
            continue
        normalized[variant_id] = qty

    if not normalized:
        return [], Decimal("0")

    variants = list(_fetch_variants(normalized.keys()))
    by_id = {pv.id: pv for pv in variants}

    lines: List[CartLine] = []
    subtotal = Decimal("0")

    missing_ids = [vid for vid in normalized.keys() if vid not in by_id]
    if missing_ids:
        # Clean cart should drop missing ids at controller level, but here we surface it.
        raise ValidationError({"cart": "Hay variantes inexistentes en el carrito."})

    for variant_id, qty in normalized.items():
        variant = by_id[variant_id]
        product: Product = variant.product

        unit_price = _get_unit_price(variant)
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

        # Subtotal should reflect requested qty (UI decision). If you prefer only available qty,
        # clamp here.
        subtotal += line_total

    return lines, subtotal
