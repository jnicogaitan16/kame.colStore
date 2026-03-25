from django.conf import settings
from urllib.parse import quote

from apps.notifications.email_product_media import get_email_variant_image_url


def format_cop(amount) -> str:
    if amount is None:
        return "$0"

    try:
        n = int(amount)
    except Exception:
        return "$0"

    return "$" + f"{n:,}".replace(",", ".")


def _get_first_name(order) -> str | None:
    full_name = getattr(order, "full_name", None) or getattr(order, "customer_name", None)

    if full_name:
        first = str(full_name).strip().split(" ")[0]
        return first.title() if first else None

    return None


def _get_support_whatsapp() -> str:
    raw = getattr(
        settings,
        "SUPPORT_WHATSAPP",
        getattr(settings, "NEXT_PUBLIC_WHATSAPP_PHONE", "573137008959"),
    )
    raw = (str(raw or "").strip())
    digits = "".join(ch for ch in raw if ch.isdigit())
    return digits or "573137008959"


def _get_brand_name() -> str:
    return "Kame.col"


def _get_order_public_url(order) -> str | None:
    return getattr(order, "public_url", None)


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


def _build_email_items(order) -> list[dict]:
    items_payload: list[dict] = []

    try:
        items = order.items.select_related(
            "product_variant",
            "product_variant__product",
            "product_variant__product__category",
        ).all()
    except Exception:
        return items_payload

    for item in items:
        variant = getattr(item, "product_variant", None)
        product = getattr(variant, "product", None)

        product_name = ""
        if product is not None:
            product_name = str(getattr(product, "name", "") or "").strip()

        items_payload.append(
            {
                "name": product_name.upper() if product_name else "PRODUCTO",
                "variant_label": _build_variant_label(variant),
                "quantity": int(getattr(item, "quantity", 0) or 0),
                "unit_price_fmt": format_cop(getattr(item, "unit_price", 0)),
                "image_url": get_email_variant_image_url(variant),
            }
        )

    return items_payload


def build_payment_confirmed_context(order) -> dict:
    first_name = _get_first_name(order)

    order_number = getattr(order, "id", None)
    to_email = (getattr(order, "email", "") or "").strip() or None
    reference = (getattr(order, "payment_reference", "") or "").strip() or None
    payment_method = "Transferencia Bre-B"

    raw_subtotal = getattr(order, "subtotal", None)
    raw_shipping_cost = getattr(order, "shipping_cost", None)

    raw_total = getattr(order, "total", None)
    if raw_total is None:
        raw_total = getattr(order, "total_amount", None)

    subtotal_fmt = format_cop(raw_subtotal)
    shipping_cost_fmt = format_cop(raw_shipping_cost)
    shipping_is_free = int(raw_shipping_cost or 0) <= 0
    total_fmt = format_cop(raw_total)

    subject = "Pago confirmado"
    preheader = "Tu pago fue confirmado y ya estamos preparando tu pedido."

    support_whatsapp = _get_support_whatsapp()
    whatsapp_url = None
    if support_whatsapp:
        msg = f"Hola 👋 Necesito ayuda con mi compra en Kame.col."
        whatsapp_url = f"https://wa.me/{support_whatsapp}?text={quote(msg)}"

    email_items = _build_email_items(order)
    items_count = sum(int(item.get("quantity") or 0) for item in email_items)
    has_multiple_items = len(email_items) > 1

    return {
        "first_name": first_name,
        "brand_name": _get_brand_name(),
        "preheader": preheader,
        "subject": subject,
        "order_number": order_number,
        "reference": reference,
        "order": order,
        "order_public_url": _get_order_public_url(order),
        "support_whatsapp": support_whatsapp,
        "whatsapp_url": whatsapp_url,
        "payment_method": payment_method,
        "to_email": to_email,
        "items_count": items_count,
        "has_multiple_items": has_multiple_items,
        "subtotal_fmt": subtotal_fmt,
        "shipping_cost_fmt": shipping_cost_fmt,
        "shipping_is_free": shipping_is_free,
        "total_fmt": total_fmt,
        "email_items": email_items,
    }