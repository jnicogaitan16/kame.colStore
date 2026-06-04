from __future__ import annotations

import base64
import logging
import mimetypes
import os
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)

_ASSETS_DIR = Path(__file__).resolve().parent / "email_assets"

WOMPI_LOGO_CID = "kame-email-wompi-logo"
WHATSAPP_ICON_CID = "kame-email-whatsapp-icon"

_ASSET_SPECS: tuple[tuple[str, str, str], ...] = (
    ("wompi_logo_url", "wompi-logo.png", WOMPI_LOGO_CID),
    ("whatsapp_icon_url", "whatsapp-white.png", WHATSAPP_ICON_CID),
)


def _is_public_https_base(url: str) -> bool:
    lowered = (url or "").strip().lower()
    if not lowered.startswith("https://"):
        return False
    return "localhost" not in lowered and "127.0.0.1" not in lowered


def get_public_email_assets_base_url() -> str:
    """Base HTTPS pública para assets de correo (Gmail no puede usar localhost)."""
    explicit = (os.getenv("EMAIL_ASSETS_BASE_URL") or "").strip().rstrip("/")
    if explicit and _is_public_https_base(explicit):
        return explicit

    for candidate in (
        os.getenv("FRONTEND_SITE_URL", "").strip(),
        str(getattr(settings, "FRONTEND_SITE_URL", "") or "").strip(),
    ):
        if candidate and _is_public_https_base(candidate):
            return candidate.rstrip("/")

    return "https://www.kamecol.com"


def get_public_email_asset_url(filename: str) -> str:
    return f"{get_public_email_assets_base_url()}/emails/{filename.lstrip('/')}"


def _asset_path(filename: str) -> Path | None:
    path = _ASSETS_DIR / filename
    if path.is_file():
        return path
    logger.warning("email asset missing on disk: %s", path)
    return None


def get_brand_asset_cid_urls() -> dict[str, str]:
    """URLs cid: para usar en plantillas HTML (Resend inline attachments)."""
    urls: dict[str, str] = {}
    for ctx_key, filename, content_id in _ASSET_SPECS:
        if _asset_path(filename):
            urls[ctx_key] = f"cid:{content_id}"
        else:
            urls[ctx_key] = get_public_email_asset_url(filename)
    return urls


def get_brand_asset_resend_attachments() -> list[dict[str, str]]:
    """Adjuntos inline (base64) para la API de Resend."""
    attachments: list[dict[str, str]] = []
    for _ctx_key, filename, content_id in _ASSET_SPECS:
        path = _asset_path(filename)
        if not path:
            continue
        content_type = mimetypes.guess_type(filename)[0] or "image/png"
        attachments.append(
            {
                "filename": filename,
                "content": base64.b64encode(path.read_bytes()).decode("ascii"),
                "content_id": content_id,
                "content_type": content_type,
            }
        )
    return attachments


def enrich_context_with_brand_assets(ctx: dict) -> dict:
    ctx.update(get_brand_asset_cid_urls())
    return ctx
