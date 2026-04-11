from __future__ import annotations

import json
import logging
from typing import Optional
from urllib import error as urllib_error
from urllib import request as urllib_request

from django.conf import settings
from django.template.exceptions import TemplateDoesNotExist
from django.template.loader import render_to_string

from apps.notifications.email_context import build_payment_confirmed_context

logger = logging.getLogger(__name__)


def _get_from_email() -> str:
    return getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@kamecol.local")


def _get_resend_api_key() -> str:
    return str(getattr(settings, "RESEND_API_KEY", "") or "").strip()


def _get_resend_api_url() -> str:
    return str(getattr(settings, "RESEND_API_URL", "https://api.resend.com/emails") or "https://api.resend.com/emails").strip()



def _build_resend_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_get_resend_api_key()}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "KameColBackend/1.0 (+https://kamecol.com)",
    }


def _should_send_real_email() -> bool:
    """Return True only when Resend is explicitly configured."""
    return bool(_get_resend_api_key())


def _safe_send_multipart(
    *,
    subject: str,
    text_body: str,
    html_body: Optional[str],
    to_email: Optional[str],
) -> None:
    """Best-effort transactional send through Resend; falls back to logging if not configured."""
    if not to_email:
        logger.error("[emails] Abort send (missing to_email). subject=%s", subject)
        return

    if not _should_send_real_email():
        logger.info(
            "[emails] (dummy) provider=resend-missing-config to=%s subject=%s text=%s html=%s",
            to_email,
            subject,
            text_body,
            bool(html_body),
        )
        return

    payload = {
        "from": _get_from_email(),
        "to": [to_email],
        "subject": subject,
        "text": text_body,
    }
    if html_body:
        payload["html"] = html_body

    raw_payload = json.dumps(payload).encode("utf-8")
    request = urllib_request.Request(
        url=_get_resend_api_url(),
        data=raw_payload,
        method="POST",
        headers=_build_resend_headers(),
    )

    logger.info(
        "[emails] Sending email provider=resend to=%s from=%s subject=%s html=%s api_url=%s",
        to_email,
        payload["from"],
        subject,
        bool(html_body),
        _get_resend_api_url(),
    )

    try:
        # URL solo a API HTTPS de Resend (_get_resend_api_url); no es input de usuario.
        with urllib_request.urlopen(request, timeout=20) as response:  # nosec B310
            response_body = response.read().decode("utf-8", errors="replace")
            logger.info(
                "[emails] Email sent successfully provider=resend to=%s subject=%s status=%s body=%s",
                to_email,
                subject,
                getattr(response, "status", None),
                response_body,
            )
    except urllib_error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        logger.exception(
            "[emails] Resend HTTP error to=%s from=%s subject=%s status=%s reason=%s api_url=%s headers=%s body=%s",
            to_email,
            payload["from"],
            subject,
            getattr(exc, "code", None),
            getattr(exc, "reason", None),
            _get_resend_api_url(),
            dict(getattr(exc, "headers", {}) or {}),
            error_body,
        )
        raise
    except Exception:
        logger.exception(
            "[emails] Resend send failed to=%s from=%s subject=%s api_url=%s",
            to_email,
            payload["from"],
            subject,
            _get_resend_api_url(),
        )
        raise


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
    # Minimal HTML fallback for a valid transactional HTML body
    html_body = "<html><body><pre style=\"font-family:Arial, sans-serif;\">" + message + "</pre></body></html>"
    _safe_send_multipart(subject=subject, text_body=message, html_body=html_body, to_email=to_email)


def send_order_paid_email(order) -> None:
    """Email: pago confirmado (HTML + TXT)."""
    to_email = (getattr(order, "email", None) or "").strip() or None
    logger.info(
        "[emails] Enter send_order_paid_email order_id=%s to=%s",
        getattr(order, "id", None),
        to_email,
    )
    if not to_email:
        logger.error(
            "[emails] order_paid received empty to_email. order_id=%s",
            getattr(order, "id", None),
        )

    # Contexto limpio
    ctx = build_payment_confirmed_context(order)

    # CTA URLs (opcional)
    order_url = ctx.get("order_public_url") or ctx.get("order_url")
    whatsapp_url = ctx.get("whatsapp_url")

    template_ctx = {
        **ctx,
        "order_url": order_url,
        "whatsapp_url": whatsapp_url,
    }

    subject = str(ctx.get("subject") or "Pago confirmado")

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
    logger.info(
        "[emails] Enter send_payment_confirmed_email alias order_id=%s",
        getattr(order, "id", None),
    )
    # Backward compatible alias
    send_order_paid_email(order)