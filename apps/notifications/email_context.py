import os
from urllib.parse import quote

from django.conf import settings

from apps.notifications.email_product_media import get_email_variant_image_url
from apps.notifications.email_utils import format_cop, _build_variant_label


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


def _get_storefront_base_url() -> str:
    """URL base del storefront para enlaces en emails (Django).

    En DEBUG: si no hay ``FRONTEND_SITE_URL`` en el entorno, se usa el storefront local
    (así ``NEXT_PUBLIC_SITE_URL`` del frontend, a menudo apuntando a prod, no rompe los correos).
    En producción: ``FRONTEND_SITE_URL`` o ``NEXT_PUBLIC_SITE_URL`` vía settings, o www canónico.
    """
    backend_explicit = (os.getenv("FRONTEND_SITE_URL") or "").strip()
    if backend_explicit:
        return backend_explicit.rstrip("/") or backend_explicit

    if getattr(settings, "DEBUG", False):
        dev = str(getattr(settings, "DEV_STOREFRONT_URL", "") or "").strip()
        dev = dev or (os.getenv("DEV_STOREFRONT_URL") or "").strip()
        final = dev.rstrip("/") if dev else ""
        return final or "http://localhost:3000"

    combined = str(getattr(settings, "FRONTEND_SITE_URL", "") or "").strip()
    if combined:
        return combined.rstrip("/") or combined
    # Producción sin env: canónico con www (el apex a veces no sirve el mismo Next.js).
    return "https://www.kamecol.com"


def _build_checkout_resume_url(order) -> str | None:
    ref = (getattr(order, "payment_reference", None) or "").strip()
    if not ref:
        return None
    base = _get_storefront_base_url()
    return f"{base}/checkout/resultado?ref={quote(ref, safe='')}"


def _order_item_line_total_numeric(item) -> float:
    qty = _normalize_email_item_quantity(item)
    up = getattr(item, "unit_price", None)
    if up is None:
        return 0.0
    try:
        price = float(up)
    except (TypeError, ValueError):
        return 0.0
    return float(qty) * price


def _build_highest_value_product_page_url(order) -> str | None:
    """URL del PDP del ítem con mayor importe de línea (cantidad × precio); empate → mayor precio unitario."""
    try:
        items = list(order.items.select_related("product_variant__product").all())
    except Exception:
        return None
    if not items:
        return None

    def unit_price_num(it) -> float:
        up = getattr(it, "unit_price", None)
        if up is None:
            return 0.0
        try:
            return float(up)
        except (TypeError, ValueError):
            return 0.0

    items_sorted = sorted(
        items,
        key=lambda it: (
            -_order_item_line_total_numeric(it),
            -unit_price_num(it),
        ),
    )
    base = _get_storefront_base_url()
    for candidate in items_sorted:
        variant = getattr(candidate, "product_variant", None)
        product = getattr(variant, "product", None) if variant else None
        slug = (getattr(product, "slug", None) or "").strip() if product else ""
        if not slug:
            continue
        # SlugField es seguro en path (sin codificar el guion, a diferencia de quote(..., safe="")).
        return f"{base}/producto/{slug}"
    return None


def _normalize_email_item_name(product) -> str:
    raw_name = ""
    if product is not None:
        raw_name = str(getattr(product, "name", "") or "").strip()
    return raw_name.upper() if raw_name else "PRODUCTO"



def _normalize_email_item_variant_label(variant) -> str | None:
    label = _build_variant_label(variant)
    if not label:
        return None
    normalized = str(label).strip()
    return normalized or None



def _normalize_email_item_quantity(item) -> int:
    try:
        quantity = int(getattr(item, "quantity", 0) or 0)
    except Exception:
        return 0
    return max(quantity, 0)



def _normalize_email_item_unit_price_fmt(item) -> str:
    return format_cop(getattr(item, "unit_price", 0))



def _normalize_email_item_image_url(variant) -> str | None:
    url = get_email_variant_image_url(variant)
    if not url:
        return None
    normalized = str(url).strip()
    return normalized or None


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

        items_payload.append(
            {
                "name": _normalize_email_item_name(product),
                "variant_label": _normalize_email_item_variant_label(variant),
                "quantity": _normalize_email_item_quantity(item),
                "unit_price_fmt": _normalize_email_item_unit_price_fmt(item),
                "image_url": _normalize_email_item_image_url(variant),
            }
        )

    return items_payload


def build_payment_confirmed_context(order) -> dict:
    first_name = _get_first_name(order)

    order_number = getattr(order, "id", None)
    to_email = (getattr(order, "email", "") or "").strip() or None
    reference = (getattr(order, "payment_reference", "") or "").strip() or None
    payment_method = getattr(order, "payment_method", "").strip()

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


def build_pending_payment_reminder_context(order) -> dict:
    """Contexto para el recordatorio de pago pendiente (sin número de referencia en copy)."""
    first_name = _get_first_name(order)

    to_email = (getattr(order, "email", "") or "").strip() or None
    payment_method = (getattr(order, "payment_method", "") or "").strip()

    raw_subtotal = getattr(order, "subtotal", None)
    raw_shipping_cost = getattr(order, "shipping_cost", None)

    raw_total = getattr(order, "total", None)
    if raw_total is None:
        raw_total = getattr(order, "total_amount", None)

    subtotal_fmt = format_cop(raw_subtotal)
    shipping_cost_fmt = format_cop(raw_shipping_cost)
    shipping_is_free = int(raw_shipping_cost or 0) <= 0
    total_fmt = format_cop(raw_total)

    subject = "Tu prenda sigue esperándote"
    preheader = (
        "Dejaste productos reservados. Completa tu pago y asegura tu pedido en Kame.col."
    )

    support_whatsapp = _get_support_whatsapp()
    whatsapp_url = None
    if support_whatsapp:
        msg = (
            "Hola, necesito ayuda para finalizar mi compra en Kame.col."
        )
        whatsapp_url = f"https://wa.me/{support_whatsapp}?text={quote(msg)}"

    email_items = _build_email_items(order)
    items_count = sum(int(item.get("quantity") or 0) for item in email_items)
    has_multiple_items = len(email_items) > 1

    # CTA: PDP del producto de mayor cuantía (evita /checkout/resultado con sesión agotada).
    order_public_url = (
        _get_order_public_url(order)
        or _build_highest_value_product_page_url(order)
        or _build_checkout_resume_url(order)
    )

    return {
        "first_name": first_name,
        "brand_name": _get_brand_name(),
        "preheader": preheader,
        "subject": subject,
        "order": order,
        "order_public_url": order_public_url,
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