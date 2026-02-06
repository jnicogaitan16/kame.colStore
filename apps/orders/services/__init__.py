from __future__ import annotations

# Facade / re-exports (NO business logic here)
from apps.orders.services.cart_validation import validate_cart
from apps.orders.services.create_order_from_cart import create_order_from_cart
from apps.orders.services.customers import get_or_create_customer_from_form_data
from apps.orders.services.order_items import validate_and_prepare_order_item
from apps.orders.services.payments import confirm_order_payment

# ---- Cart (session-based) helpers ----
from .cart import (  # noqa: E402
    CART_SESSION_KEY,
    CartLine,
    add_to_cart,
    clear_cart,
    get_cart,
    remove_from_cart,
    update_qty,
    validate_session_cart,
)