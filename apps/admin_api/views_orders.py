"""
Admin API — Orders management.

GET  /api/admin/orders/
GET  /api/admin/orders/{reference}/
POST /api/admin/orders/{reference}/ship/
POST /api/admin/orders/{reference}/cancel/
POST /api/admin/orders/{reference}/send-reminder/
"""
import logging
from datetime import timedelta

from django.template.exceptions import TemplateDoesNotExist
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework import status as http_status

from apps.orders.models import Order, OrderStatusLog
from apps.notifications.email_context import build_pending_payment_reminder_context
from apps.notifications.emails import _safe_send_multipart

logger = logging.getLogger(__name__)


def _serialize_order_list(o: Order) -> dict:
    items_summary = ", ".join(
        f"{item.product_variant} x{item.quantity}"
        for item in o.items.select_related("product_variant__product").all()[:3]
    )
    return {
        "reference": o.payment_reference or f"ORD-{o.pk}",
        "id": o.pk,
        "customer_name": o.full_name or str(o.customer),
        "customer_email": o.email,
        "items_summary": items_summary,
        "total": o.total,
        "payment_method": o.payment_method,
        "status": o.status,
        "created_at": o.created_at.isoformat(),
        "tracking_number": o.tracking_number,
    }


def _serialize_order_detail(o: Order) -> dict:
    items = []
    for item in o.items.select_related("product_variant__product").all():
        variant = item.product_variant
        product = variant.product if hasattr(variant, "product") else None
        items.append({
            "product_name": product.name if product else str(variant),
            "variant": f"{variant.value} / {variant.color}".strip(" /"),
            "quantity": item.quantity,
            "unit_price": float(item.unit_price or 0),
            "subtotal": float(item.line_total),
        })

    logs = [
        {
            "status": log.status,
            "note": log.note,
            "created_at": log.created_at.isoformat(),
        }
        for log in o.status_logs.order_by("created_at")
    ]

    return {
        "reference": o.payment_reference or f"ORD-{o.pk}",
        "id": o.pk,
        "status": o.status,
        "payment_method": o.payment_method,
        "tracking_number": o.tracking_number,
        "customer": {
            "full_name": o.full_name,
            "email": o.email,
            "phone": o.phone,
            "document_type": o.document_type,
            "cedula": o.cedula,
        },
        "shipping": {
            "city_code": o.city_code,
            "address": o.address,
            "notes": o.notes,
        },
        "items": items,
        "summary": {
            "subtotal": o.subtotal,
            "shipping_cost": o.shipping_cost,
            "total": o.total,
        },
        "status_logs": logs,
        "created_at": o.created_at.isoformat(),
        "updated_at": o.updated_at.isoformat(),
        "payment_confirmed_at": (
            o.payment_confirmed_at.isoformat() if o.payment_confirmed_at else None
        ),
    }


@api_view(["GET"])
@permission_classes([IsAdminUser])
def orders_list(request: Request):
    qs = Order.objects.select_related("customer").order_by("-created_at")

    status_filter = request.query_params.get("status")
    if status_filter and status_filter != "all":
        qs = qs.filter(status=status_filter)

    start = request.query_params.get("start")
    end = request.query_params.get("end")
    if start:
        qs = qs.filter(created_at__date__gte=start)
    if end:
        qs = qs.filter(created_at__date__lte=end)

    search = request.query_params.get("search", "").strip()
    if search:
        qs = qs.filter(
            payment_reference__icontains=search
        ) | qs.filter(full_name__icontains=search)

    page = int(request.query_params.get("page", 1))
    page_size = 20
    offset = (page - 1) * page_size
    total = qs.count()

    results = [_serialize_order_list(o) for o in qs[offset: offset + page_size]]

    return Response({
        "count": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
        "results": results,
    })


@api_view(["GET"])
@permission_classes([IsAdminUser])
def order_detail(request: Request, reference: str):
    try:
        o = Order.objects.prefetch_related(
            "items__product_variant__product",
            "status_logs",
        ).get(payment_reference=reference)
    except Order.DoesNotExist:
        # Try by pk
        try:
            pk = int(reference.replace("ORD-", ""))
            o = Order.objects.prefetch_related(
                "items__product_variant__product",
                "status_logs",
            ).get(pk=pk)
        except (ValueError, Order.DoesNotExist):
            return Response({"error": "Orden no encontrada."}, status=404)

    return Response(_serialize_order_detail(o))


@api_view(["POST"])
@permission_classes([IsAdminUser])
def order_ship(request: Request, reference: str):
    try:
        o = Order.objects.get(payment_reference=reference)
    except Order.DoesNotExist:
        return Response({"error": "Orden no encontrada."}, status=404)

    if o.status not in (Order.Status.PAID, Order.Status.PENDING_PAYMENT):
        return Response(
            {"error": f"No se puede enviar una orden con estado {o.status}."},
            status=400,
        )

    tracking_number = request.data.get("tracking_number", "").strip()
    if not tracking_number:
        return Response({"error": "Se requiere número de guía."}, status=400)

    o.tracking_number = tracking_number
    o.status = Order.Status.SHIPPED
    o.save(update_fields=["tracking_number", "status", "updated_at"])

    OrderStatusLog.objects.create(
        order=o,
        status=Order.Status.SHIPPED,
        note=f"Enviado con guía {tracking_number}",
    )

    return Response({"ok": True, "tracking_number": tracking_number})


@api_view(["POST"])
@permission_classes([IsAdminUser])
def order_cancel(request: Request, reference: str):
    try:
        o = Order.objects.get(payment_reference=reference)
    except Order.DoesNotExist:
        return Response({"error": "Orden no encontrada."}, status=404)

    if o.status == Order.Status.PAID:
        return Response(
            {"error": "No se puede cancelar una orden ya pagada."},
            status=400,
        )

    if o.status == Order.Status.CANCELLED:
        return Response({"error": "La orden ya está cancelada."}, status=400)

    note = request.data.get("note", "Cancelado por administrador.")
    o.status = Order.Status.CANCELLED
    o.save(update_fields=["status", "updated_at"])

    OrderStatusLog.objects.create(order=o, status=Order.Status.CANCELLED, note=note)

    return Response({"ok": True})


@api_view(["POST"])
@permission_classes([IsAdminUser])
def order_send_reminder(request: Request, reference: str):
    try:
        o = Order.objects.prefetch_related(
            "items__product_variant__product__category",
        ).get(payment_reference=reference)
    except Order.DoesNotExist:
        return Response({"error": "Orden no encontrada."}, status=404)

    if o.status != Order.Status.PENDING_PAYMENT:
        return Response(
            {"error": "Solo se puede enviar recordatorio a órdenes pendientes."},
            status=400,
        )

    # Check if reminder was sent in the last 24h
    cutoff = timezone.now() - timedelta(hours=24)
    already_sent = OrderStatusLog.objects.filter(
        order=o,
        note="reminder_sent",
        created_at__gte=cutoff,
    ).exists()

    if already_sent:
        return Response(
            {"error": "Ya se envió un recordatorio en las últimas 24 horas."},
            status=400,
        )

    if not o.email:
        return Response({"error": "La orden no tiene email de contacto."}, status=400)

    ctx = build_pending_payment_reminder_context(o)
    order_url = ctx.get("order_public_url") or ctx.get("order_url")
    whatsapp_url = ctx.get("whatsapp_url")
    template_ctx = {
        **ctx,
        "order_url": order_url,
        "whatsapp_url": whatsapp_url,
    }
    subject = str(ctx.get("subject") or "Tu prenda sigue esperándote")

    text_body = render_to_string("emails/orders/pending_reminder.txt", template_ctx)

    html_body = None
    try:
        html_body = render_to_string("emails/orders/pending_reminder.html", template_ctx)
    except TemplateDoesNotExist:
        logger.exception(
            "[admin_api] pending_reminder.html no encontrado; envío solo texto. order_id=%s",
            o.pk,
        )
    except Exception:
        logger.exception(
            "[admin_api] Error al renderizar pending_reminder.html; envío solo texto. order_id=%s",
            o.pk,
        )

    try:
        _safe_send_multipart(
            subject=subject,
            text_body=text_body,
            html_body=html_body,
            to_email=o.email,
        )
    except Exception as exc:
        return Response(
            {"error": f"No se pudo enviar el correo: {exc}"},
            status=500,
        )

    OrderStatusLog.objects.create(
        order=o,
        status=Order.Status.PENDING_PAYMENT,
        note="reminder_sent",
    )

    return Response({"ok": True, "message": "Recordatorio enviado."})
