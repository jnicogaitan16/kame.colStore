"""
Wompi payment gateway — firma de integridad y validación de webhooks.

Fuente de verdad: https://docs.wompi.co
"""

from __future__ import annotations

import hashlib
import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def generate_integrity_signature(reference: str, amount_in_cents: int, currency: str = "COP") -> str:
    """Genera la firma de integridad requerida por el Widget de Wompi.

    Fórmula (docs Wompi):
        SHA256( f"{reference}{amount_in_cents}{currency}{integrity_secret}" )
    """
    integrity_secret = settings.WOMPI_INTEGRITY_SECRET
    concatenated = f"{reference}{amount_in_cents}{currency}{integrity_secret}"
    return hashlib.sha256(concatenated.encode()).hexdigest()


def validate_webhook_signature(
    event_data: dict,
    signature_properties: list,
    checksum: str,
    timestamp: int,
) -> bool:
    """Valida la firma del webhook entrante de Wompi.

    Wompi firma los eventos usando los valores de los campos listados
    en `signature.properties`, en orden, seguidos del timestamp y el
    events_secret.

    Fórmula: SHA256(val1 + val2 + ... + timestamp + events_secret)
    """
    events_secret = settings.WOMPI_EVENTS_SECRET
    if not events_secret:
        logger.error("WOMPI_EVENTS_SECRET no está configurado")
        return False

    transaction = event_data.get("data", {}).get("transaction", {})

    parts: list[str] = []
    for prop in signature_properties:
        # "transaction.id" -> "id"
        key = prop.split(".", 1)[-1] if "." in prop else prop
        parts.append(str(transaction.get(key, "")))

    parts.append(str(timestamp))
    parts.append(events_secret)

    concatenated = "".join(parts)
    expected = hashlib.sha256(concatenated.encode()).hexdigest()

    logger.warning("WOMPI SIG parts=%s", parts)
    logger.warning("WOMPI SIG concatenated=%r", concatenated)
    logger.warning("WOMPI SIG expected=%s received=%s match=%s",
                   expected, checksum, expected == checksum)

    if expected != checksum:
        logger.warning(
            "Wompi webhook: firma inválida. transaction_id=%s",
            transaction.get("id", "?"),
        )
        return False

    return True


def cop_to_wompi_cents(cop_amount: int) -> int:
    """Convierte COP (entero) a centavos de Wompi (× 100)."""
    return int(cop_amount) * 100
