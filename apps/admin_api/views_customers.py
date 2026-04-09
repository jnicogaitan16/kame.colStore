"""
Admin API — CRM Customers.

GET/PATCH /api/admin/customers/{customer_id}/
DELETE /api/admin/customers/{customer_id}/delete/
"""
from __future__ import annotations

import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import Sum, Count, Max, Min, Avg, Q
from django.db.models.deletion import ProtectedError
from django.http import HttpResponse

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.request import Request

from apps.customers.models import Customer
from apps.orders.models import Order

# Tras marcar envío, la orden pasa a SHIPPED y ya no es PAID; el CRM debe seguir contándolas.
_CRM_REVENUE_STATUSES = (Order.Status.PAID, Order.Status.SHIPPED)


def _customer_metrics(customer: Customer) -> dict:
    paid_orders = Order.objects.filter(
        customer=customer,
        status__in=_CRM_REVENUE_STATUSES,
    )
    agg = paid_orders.aggregate(
        ltv=Sum("total"),
        count=Count("id"),
        avg=Avg("total"),
        first=Min("payment_confirmed_at"),
        last=Max("payment_confirmed_at"),
    )
    return {
        "lifetime_value": int(agg["ltv"] or 0),
        "order_count": agg["count"] or 0,
        "avg_ticket": int(agg["avg"] or 0),
        "first_purchase": agg["first"].isoformat() if agg["first"] else None,
        "last_purchase": agg["last"].isoformat() if agg["last"] else None,
    }


def _parse_bool(val) -> bool:
    if isinstance(val, bool):
        return val
    s = str(val).strip().lower()
    return s in ("1", "true", "yes", "on")


def _serialize_customer_detail(customer: Customer) -> dict:
    metrics = _customer_metrics(customer)

    orders = Order.objects.filter(customer=customer).order_by("-created_at")
    order_list = []
    for o in orders:
        items_summary = ", ".join(
            f"{item.product_variant} x{item.quantity}"
            for item in o.items.select_related("product_variant__product").all()[:3]
        )
        order_list.append({
            "reference": o.payment_reference or f"ORD-{o.pk}",
            "items_summary": items_summary,
            "total": o.total,
            "status": o.status,
            "created_at": o.created_at.isoformat(),
        })

    from apps.orders.models import OrderItem
    top_raw = (
        OrderItem.objects.filter(
            order__customer=customer,
            order__status__in=_CRM_REVENUE_STATUSES,
        )
        .values(
            "product_variant__product__name",
            "product_variant__value",
            "product_variant__color",
        )
        .annotate(units=Sum("quantity"))
        .order_by("-units")[:3]
    )
    top_products = [
        {
            "name": r["product_variant__product__name"],
            "variant": f"{r['product_variant__value']} / {r['product_variant__color']}".strip(" /"),
            "units": r["units"],
        }
        for r in top_raw
    ]

    return {
        "id": customer.pk,
        "first_name": customer.first_name,
        "last_name": customer.last_name or "",
        "full_name": f"{customer.first_name} {customer.last_name}".strip(),
        "email": customer.email or "",
        "phone": customer.phone or "",
        "document_type": customer.document_type or "CC",
        "cedula": customer.cedula,
        "is_active": customer.is_active,
        "created_at": customer.created_at.isoformat(),
        "metrics": metrics,
        "orders": order_list,
        "top_products": top_products,
    }


@api_view(["GET"])
@permission_classes([IsAdminUser])
def customers_list(request: Request):
    search = request.query_params.get("search", "").strip()
    page = int(request.query_params.get("page", 1))
    page_size = 20

    # Clientes con al menos una compra concretada (pagada o enviada)
    qs = Customer.objects.filter(orders__status__in=_CRM_REVENUE_STATUSES).distinct()

    if search:
        s = search.strip()
        doc_filter = Q(cedula__icontains=s) | Q(document_type__icontains=s)
        digits = "".join(ch for ch in s if ch.isdigit())
        if digits:
            doc_filter |= Q(cedula__icontains=digits)
        # "CC 243234234" / "nit 900123456" → tipo + cédula exacta en campos separados
        compact = re.sub(r"[\s.\-_]+", " ", s).strip()
        m_doc = re.match(r"^([A-Za-z]{1,10})\s+(\d{5,20})$", compact)
        if m_doc:
            doc_filter |= Q(document_type__iexact=m_doc.group(1)) & Q(cedula=m_doc.group(2))
        qs = qs.filter(
            Q(first_name__icontains=s)
            | Q(last_name__icontains=s)
            | Q(email__icontains=s)
            | doc_filter
        )

    crm_filter = Q(orders__status__in=_CRM_REVENUE_STATUSES)
    qs = qs.annotate(
        ltv=Sum("orders__total", filter=crm_filter),
        order_count=Count("orders", filter=crm_filter),
        last_purchase=Max("orders__payment_confirmed_at", filter=crm_filter),
    ).order_by("-ltv")

    total = qs.count()
    offset = (page - 1) * page_size
    page_qs = qs[offset: offset + page_size]

    results = []
    for c in page_qs:
        results.append({
            "id": c.pk,
            "full_name": f"{c.first_name} {c.last_name}".strip(),
            "email": c.email or "",
            "phone": c.phone or "",
            "lifetime_value": int(c.ltv or 0),
            "created_at": c.created_at.isoformat(),
            "order_count": c.order_count or 0,
            "last_purchase": c.last_purchase.isoformat() if c.last_purchase else None,
        })

    return Response({
        "count": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
        "results": results,
    })


@api_view(["GET", "PATCH"])
@permission_classes([IsAdminUser])
def customer_detail(request: Request, customer_id: int):
    try:
        customer = Customer.objects.get(pk=customer_id)
    except Customer.DoesNotExist:
        return Response({"error": "Cliente no encontrado."}, status=404)

    if request.method == "GET":
        return Response(_serialize_customer_detail(customer))

    data = request.data
    if "first_name" in data:
        customer.first_name = (data["first_name"] or "").strip()
    if "last_name" in data:
        customer.last_name = (data["last_name"] or "").strip()
    if "email" in data:
        e = (data.get("email") or "").strip()
        customer.email = e.lower() if e else None
    if "phone" in data:
        customer.phone = (data.get("phone") or "").strip()
    if "document_type" in data:
        customer.document_type = (data.get("document_type") or "CC").strip() or "CC"
    if "cedula" in data:
        customer.cedula = (data.get("cedula") or "").strip()
    if "is_active" in data:
        customer.is_active = _parse_bool(data["is_active"])

    if not customer.first_name:
        return Response({"error": {"first_name": ["El nombre es obligatorio."]}}, status=400)

    try:
        customer.full_clean()
        customer.save()
    except DjangoValidationError as e:
        err = e.message_dict if getattr(e, "message_dict", None) else {"__all__": list(e.messages)}
        return Response({"error": err}, status=400)
    except IntegrityError:
        return Response(
            {"error": {"__all__": ["Ya existe otro cliente con el mismo tipo y número de documento."]}},
            status=400,
        )

    return Response(_serialize_customer_detail(customer))


@api_view(["DELETE"])
@permission_classes([IsAdminUser])
def customer_delete(request: Request, customer_id: int):
    try:
        customer = Customer.objects.get(pk=customer_id)
    except Customer.DoesNotExist:
        return Response({"error": "Cliente no encontrado."}, status=404)
    try:
        customer.delete()
    except ProtectedError:
        return Response(
            {"error": "No se puede eliminar: este cliente tiene órdenes asociadas."},
            status=409,
        )
    return HttpResponse(status=204)
