from __future__ import annotations

import logging
from typing import Optional

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.exceptions import TemplateDoesNotExist
from django.template.loader import render_to_string
from urllib.parse import quote

from apps.notifications.email_context import build_payment_confirmed_context

logger = logging.getLogger(__name__)


def _should_send_real_email() -> bool:
    """Return True if a Django email backend is configured."""
    backend = getattr(settings, "EMAIL_BACKEND", "")
    # If EMAIL_BACKEND is set, we consider it configured.
    if backend:
        return True
    # Legacy heuristic: if host is set, likely configured.
    host = getattr(settings, "EMAIL_HOST", "")
    return bool(host)


def _get_from_email() -> str:
    return getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@kamecol.local")


def _safe_send_multipart(
    *,
    subject: str,
    text_body: str,
    html_body: Optional[str],
    to_email: Optional[str],
) -> None:
    """Best-effort multipart email send; falls back to logging if not configured."""
    if not to_email:
        logger.info("[emails] Skip send (missing to_email). subject=%s", subject)
        return

    if not _should_send_real_email():
        logger.info(
            "[emails] (dummy) To=%s | Subject=%s | TEXT=%s | HTML_ATTACHED=%s",
            to_email,
            subject,
            text_body,
            bool(html_body),
        )
        return

    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=_get_from_email(),
        to=[to_email],
    )
    if html_body:
        msg.attach_alternative(html_body, "text/html")
    # Fail loudly in dev; in prod, configure backend behavior.
    msg.send(fail_silently=False)


def send_order_created_email(order) -> None:
    """Email: pedido creado (dummy/log o send_mail si está configurado)."""
    to_email = getattr(order, "email", None)
    payment_reference = getattr(order, "payment_reference", "") or ""

    subject = f"Pedido #{order.id} creado"
    message = (
        "Tu pedido fue creado con éxito.\n\n"
        f"Referencia de pago: {payment_reference}\n"
        "Te avisaremos cuando el pago sea confirmado."
    )

    logger.info("[emails] order_created order_id=%s to=%s", getattr(order, "id", None), to_email)
    # Minimal HTML so Gmail renders as HTML-capable message
    html_body = "<html><body><pre style=\"font-family:Arial, sans-serif;\">" + message + "</pre></body></html>"
    _safe_send_multipart(subject=subject, text_body=message, html_body=html_body, to_email=to_email)


def send_order_paid_email(order) -> None:
    """Email: pago confirmado (HTML + TXT)."""
    to_email = (getattr(order, "email", None) or "").strip() or None

    # Contexto limpio
    ctx = build_payment_confirmed_context(order)

    # CTA URLs (opcional)
    support_digits = str(ctx.get("support_whatsapp") or "").strip()
    support_digits = "".join([c for c in support_digits if c.isdigit()])

    order_url = ctx.get("order_public_url")
    whatsapp_url = None
    if support_digits:
        wa_message = f"Hola 👋 Mi pedido es #{order.id}. ¿Me ayudas por favor?"
        whatsapp_url = f"https://wa.me/{support_digits}?text={quote(wa_message)}"

    template_ctx = {
        **ctx,
        "order_url": order_url,
        "whatsapp_url": whatsapp_url,
    }

    subject = str(ctx.get("subject") or f"Pago confirmado - Pedido #{order.id}")

    # TXT es crítico: si falla, levantamos error (no hay body alternativo)
    text_body = render_to_string("emails/orders/paid.txt", template_ctx)

    # HTML es opcional: si falla, enviamos solo TXT y dejamos trazabilidad
    html_body: Optional[str] = None
    try:
        html_body = render_to_string("emails/orders/paid.html", template_ctx)
    except TemplateDoesNotExist:
        logger.exception("[emails] paid.html not found; sending TXT-only. order_id=%s", getattr(order, "id", None))
    except Exception:
        logger.exception("[emails] Failed to render paid.html; sending TXT-only. order_id=%s", getattr(order, "id", None))

    logger.info(
        "[emails] order_paid order_id=%s to=%s ref=%s",
        getattr(order, "id", None),
        to_email,
        getattr(order, "payment_reference", None),
    )

    _safe_send_multipart(subject=subject, text_body=text_body, html_body=html_body, to_email=to_email)


def send_payment_confirmed_email(order) -> None:
    # Backward compatible alias
    send_order_paid_email(order)