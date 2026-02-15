"""Centralización de contexto para emails.

Responsabilidad:
- Preparar datos limpios y listos para presentación (ej: first_name, total_fmt, reference).
- Evitar que los templates dependan de filtros/custom tags para formateo.

Los templates NO deben tener lógica compleja.
"""

from django.conf import settings


def format_cop(amount) -> str:
    """Formatea un monto como COP con separador de miles por puntos.

    Ejemplos:
        145000 -> $145.000
        None -> $0
    """
    if amount is None:
        return "$0"

    try:
        n = int(amount)
    except Exception:
        return "$0"

    return "$" + f"{n:,}".replace(",", ".")


# =========================
# Helpers internos
# =========================

def _get_first_name(order) -> str | None:
    """Deriva el primer nombre para personalizar el email.

    Prioridad:
    1) order.full_name
    2) order.customer_name

    Fallback final: None (el template mostrará un saludo genérico).
    """
    full_name = getattr(order, "full_name", None) or getattr(order, "customer_name", None)

    if full_name:
        first = str(full_name).strip().split(" ")[0]
        return first.title() if first else None

    return None


def _get_support_whatsapp() -> str:
    """
    Obtiene el WhatsApp desde settings o usa fallback seguro.
    """
    return getattr(settings, "SUPPORT_WHATSAPP", "573105564840")


def _get_brand_name() -> str:
    return "Kame.col"


def _get_order_public_url(order) -> str | None:
    """
    Si el modelo expone public_url, la retorna.
    """
    return getattr(order, "public_url", None)


# =========================
# Context builders públicos
# =========================

def build_payment_confirmed_context(order) -> dict:
    """Contexto para email: Pago confirmado."""
    first_name = _get_first_name(order)

    order_number = getattr(order, "id", None)
    to_email = (getattr(order, "email", "") or "").strip() or None
    reference = (getattr(order, "payment_reference", "") or "").strip() or None
    payment_method = "Transferencia Bre-B"

    raw_total = getattr(order, "total", None)
    if raw_total is None:
        raw_total = getattr(order, "total_amount", None)
    total_fmt = format_cop(raw_total)

    subject = f"Pago confirmado - Pedido #{order_number}"
    preheader = f"Pago confirmado para tu pedido #{order_number}"

    return {
        "first_name": first_name,
        "brand_name": _get_brand_name(),
        "preheader": preheader,
        "subject": subject,
        "order_number": order_number,
        "reference": reference,
        "order": order,
        "order_public_url": _get_order_public_url(order),
        "support_whatsapp": _get_support_whatsapp(),
        "payment_method": payment_method,
        "to_email": to_email,
        "total_fmt": total_fmt,
    }


# Futuro: otros contextos
# def build_order_created_context(order) -> dict:
#     ...