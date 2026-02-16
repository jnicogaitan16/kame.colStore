from __future__ import annotations

import base64
import logging
import secrets
from datetime import date
from typing import Dict

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.orders.models import Order
from apps.orders.services.product_variants import get_product_variant_model
from apps.orders.services.stock import assert_items_stock

logger = logging.getLogger(__name__)


def generate_payment_reference(prefix: str = "KME", max_attempts: int = 5) -> str:
    """
    Genera una referencia de pago corta y única.

    Formato: KME-YYYYMMDD-XXXXXX
    Donde XXXXXX es un código random en Base32 (A-Z2-7), sin padding.

    Valida unicidad contra Order.payment_reference con hasta `max_attempts` intentos.
    """
    today = date.today().strftime("%Y%m%d")

    def _random_base32_code(length: int = 6) -> str:
        raw = secrets.token_bytes(5)
        code = base64.b32encode(raw).decode("ascii").rstrip("=")
        return code[:length].upper()

    for _ in range(max_attempts):
        code = _random_base32_code(6)
        ref = f"{prefix}-{today}-{code}"
        if not Order.objects.filter(payment_reference=ref).exists():
            return ref

    raise ValidationError(
        "No fue posible generar una referencia de pago única. Intenta nuevamente."
    )


def confirm_order_payment(order: Order) -> None:
    """
    Confirma el pago de un pedido, descuenta stock e implementa idempotencia.

    ✅ Anti doble-email:
    - No usamos locked_order.save() (puede disparar signals y mandar otro correo).
    - Actualizamos con QuerySet.update() (NO dispara signals).
    - Enviamos el correo SOLO una vez y SOLO tras commit (transaction.on_commit).
    """
    if order.pk is None:
        raise ValidationError("El pedido debe estar guardado antes de confirmar pago.")

    logger.info("Confirmando pago para orden #%s", order.id)

    with transaction.atomic():
        ProductVariant = get_product_variant_model()
        locked_order = Order.objects.select_for_update().get(pk=order.pk)

        # Estados terminales
        if locked_order.status in (Order.Status.CANCELLED, Order.Status.REFUNDED):
            raise ValidationError(
                "No se puede confirmar pago para un pedido cancelado o reembolsado."
            )

        # Idempotencia: ya pagada y con stock descontado => NO reenviar correo
        if locked_order.status == Order.Status.PAID and locked_order.stock_deducted_at:
            order.status = locked_order.status
            order.total = locked_order.total
            order.subtotal = locked_order.subtotal
            order.shipping_cost = locked_order.shipping_cost
            order.payment_confirmed_at = locked_order.payment_confirmed_at
            order.stock_deducted_at = locked_order.stock_deducted_at
            order.payment_reference = getattr(locked_order, "payment_reference", None)
            return

        # Estado inconsistente
        if locked_order.status == Order.Status.PAID and not locked_order.stock_deducted_at:
            raise ValidationError(
                "El pedido ya está marcado como pagado; no se puede reconfirmar."
            )

        if locked_order.status not in (Order.Status.CREATED, Order.Status.PENDING_PAYMENT):
            raise ValidationError("Estado inválido para confirmar pago.")

        # Agrupar cantidades requeridas por variante
        required_by_variant: Dict[int, int] = {}
        items = locked_order.items.select_related("product_variant").all()
        if not items:
            raise ValidationError("La orden no tiene ítems asociados.")

        for item in items:
            vid = item.product_variant_id
            required_by_variant[vid] = required_by_variant.get(vid, 0) + item.quantity

        # Lock de variantes
        variants = (
            ProductVariant.objects.select_for_update()
            .filter(id__in=required_by_variant.keys())
            .select_related("product")
        )
        variants_by_id = {v.id: v for v in variants}

        missing = [vid for vid in required_by_variant if vid not in variants_by_id]
        if missing:
            raise ValidationError("Hay variantes inválidas en el pedido.")

        # Validación centralizada de stock
        stock_items = [
            {"product_variant": variants_by_id[vid], "quantity": required_qty}
            for vid, required_qty in required_by_variant.items()
        ]
        assert_items_stock(stock_items)

        # Descontar stock
        for vid, required_qty in required_by_variant.items():
            variant = variants_by_id[vid]
            variant.stock -= required_qty
            variant.save(update_fields=["stock"])

        # Asegurar referencia (si el modelo tiene el campo)
        payment_reference = getattr(locked_order, "payment_reference", None)
        if payment_reference is None:
            # Si el modelo NO tiene payment_reference, no forzamos nada
            payment_reference = None
        else:
            if not payment_reference:
                payment_reference = generate_payment_reference()
                locked_order.payment_reference = payment_reference

        # Recalcular montos (asumimos que NO guarda; solo setea campos)
        locked_order.recalculate_total()

        now = timezone.now()

        # 🔒 Actualizar SIN signals (evita el “otro correo”)
        update_payload = {
            "status": Order.Status.PAID,
            "payment_confirmed_at": now,
            "stock_deducted_at": now,
            "subtotal": locked_order.subtotal,
            "shipping_cost": locked_order.shipping_cost,
            "total": locked_order.total,
        }

        # Solo si existe el campo payment_reference en el modelo
        if hasattr(locked_order, "payment_reference"):
            update_payload["payment_reference"] = payment_reference

        Order.objects.filter(pk=locked_order.pk).update(**update_payload)

        # Reflejar cambios en la instancia externa
        order.status = Order.Status.PAID
        order.payment_confirmed_at = now
        order.stock_deducted_at = now
        order.subtotal = locked_order.subtotal
        order.shipping_cost = locked_order.shipping_cost
        order.total = locked_order.total
        if hasattr(order, "payment_reference"):
            order.payment_reference = payment_reference

        # ✅ Enviar SOLO el correo de pago confirmado, una vez, tras commit
        order_id = locked_order.pk

        def _send_paid_email() -> None:
            try:
                from apps.notifications.emails import send_payment_confirmed_email

                fresh_order = Order.objects.get(pk=order_id)
                send_payment_confirmed_email(fresh_order)
            except Exception:
                logger.exception("Fallo enviando email de pago confirmado")

        transaction.on_commit(_send_paid_email)