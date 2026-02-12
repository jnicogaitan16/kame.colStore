

from __future__ import annotations

import logging
from typing import Optional

from django.conf import settings

try:
    # Optional dependency: only used if email backend is configured.
    from django.core.mail import send_mail  # type: ignore
except Exception:  # pragma: no cover
    send_mail = None  # type: ignore


logger = logging.getLogger(__name__)


def _should_send_real_email() -> bool:
    """Return True if Django email is reasonably configured."""
    host = getattr(settings, "EMAIL_HOST", "")
    backend = getattr(settings, "EMAIL_BACKEND", "")
    # If backend is console/locmem/filebased, it's still fine, but we keep it simple.
    return bool(host or backend)


def _get_from_email() -> str:
    return getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@kamecol.local")


def _safe_send_mail(
    *,
    subject: str,
    message: str,
    to_email: Optional[str],
) -> None:
    """Best-effort email send; falls back to logging if not configured."""
    if not to_email:
        logger.info("[emails] Skip send (missing to_email). subject=%s", subject)
        return

    if send_mail is None or not _should_send_real_email():
        logger.info(
            "[emails] (dummy) To=%s | Subject=%s | Message=%s",
            to_email,
            subject,
            message,
        )
        return

    send_mail(
        subject=subject,
        message=message,
        from_email=_get_from_email(),
        recipient_list=[to_email],
        fail_silently=True,
    )


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
    _safe_send_mail(subject=subject, message=message, to_email=to_email)


def send_payment_confirmed_email(order) -> None:
    """Email: pago confirmado (dummy/log o send_mail si está configurado)."""
    to_email = getattr(order, "email", None)
    payment_reference = getattr(order, "payment_reference", "") or ""

    subject = f"Pago confirmado - Pedido #{order.id}"
    message = (
        "Hemos confirmado tu pago.\n\n"
        f"Pedido: #{order.id}\n"
        f"Referencia: {payment_reference}\n"
        "Gracias por tu compra."
    )

    logger.info(
        "[emails] payment_confirmed order_id=%s to=%s ref=%s",
        getattr(order, "id", None),
        to_email,
        payment_reference,
    )
    _safe_send_mail(subject=subject, message=message, to_email=to_email)