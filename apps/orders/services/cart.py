from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Tuple

from django.core.exceptions import ValidationError


CART_SESSION_KEY = "cart"


@dataclass(frozen=True)
class CartLine:
    """Backwards-compatible alias for code that imports CartLine from cart.py.

    The real DB-aware CartLine lives in apps.orders.services.cart_validation.
    This one is only a lightweight placeholder.
    """

    variant_id: int
    qty: int


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def get_cart(request) -> Dict[str, Dict[str, Any]]:
    """Return the cart dict stored in session.

    Structure:
      request.session["cart"] = {
        "<variant_id>": {"qty": 2},
        ...
      }

    IMPORTANT:
    - This module handles ONLY session structure/CRUD.
    - DB/stock/price validation lives in `apps.orders.services.cart_validation`.
    """
    cart = request.session.get(CART_SESSION_KEY)
    if not isinstance(cart, dict):
        cart = {}
        request.session[CART_SESSION_KEY] = cart
    return cart


def clear_cart(request) -> None:
    request.session[CART_SESSION_KEY] = {}
    request.session.modified = True


def _assert_stock_ok(variant_id: int, qty: int) -> None:
    """Delegates DB/stock validation to cart_validation."""
    from apps.orders.services.cart_validation import validate_cart as validate_db_cart

    validate_db_cart({str(variant_id): {"qty": qty}}, strict_stock=True)


def add_to_cart(request, variant_id: int, qty: int = 1, *, enforce_stock: bool = True) -> None:
    cart = get_cart(request)

    v_id_int = _safe_int(variant_id, default=0)
    if v_id_int <= 0:
        raise ValidationError({"variant_id": "Product variant inválida."})

    v_id = str(v_id_int)
    qty = max(0, _safe_int(qty, default=0))
    if qty <= 0:
        return

    current_qty = _safe_int(cart.get(v_id, {}).get("qty"), default=0)
    new_qty = current_qty + qty

    if enforce_stock:
        _assert_stock_ok(v_id_int, new_qty)

    cart[v_id] = {"qty": new_qty}
    request.session[CART_SESSION_KEY] = cart
    request.session.modified = True


def remove_from_cart(request, variant_id: int) -> None:
    cart = get_cart(request)
    v_id = str(_safe_int(variant_id, default=0))
    if v_id in cart:
        cart.pop(v_id, None)
        request.session[CART_SESSION_KEY] = cart
        request.session.modified = True


def update_qty(request, variant_id: int, qty: int, *, enforce_stock: bool = True) -> None:
    cart = get_cart(request)

    v_id_int = _safe_int(variant_id, default=0)
    if v_id_int <= 0:
        raise ValidationError({"variant_id": "Product variant inválida."})

    v_id = str(v_id_int)
    qty = max(0, _safe_int(qty, default=0))

    if qty <= 0:
        if v_id in cart:
            cart.pop(v_id, None)
            request.session[CART_SESSION_KEY] = cart
            request.session.modified = True
        return

    if enforce_stock:
        _assert_stock_ok(v_id_int, qty)

    cart[v_id] = {"qty": qty}
    request.session[CART_SESSION_KEY] = cart
    request.session.modified = True


def validate_session_cart(request, *, strict_stock: bool = False):
    """Validate the current session cart using the DB-aware validator."""
    from apps.orders.services.cart_validation import validate_cart as validate_db_cart

    return validate_db_cart(get_cart(request), strict_stock=strict_stock)
