"""
Admin API — CRM Customers.

GET /api/admin/customers/
GET /api/admin/customers/{customer_id}/
"""
from django.db.models import Sum, Count, Max, Min, Avg, Q

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.request import Request

from apps.customers.models import Customer
from apps.orders.models import Order


def _customer_metrics(customer: Customer) -> dict:
    paid_orders = Order.objects.filter(
        customer=customer,
        status=Order.Status.PAID,
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


@api_view(["GET"])
@permission_classes([IsAdminUser])
def customers_list(request: Request):
    search = request.query_params.get("search", "").strip()
    page = int(request.query_params.get("page", 1))
    page_size = 20

    # Only customers that have at least one PAID order
    qs = Customer.objects.filter(
        orders__status=Order.Status.PAID
    ).distinct()

    if search:
        qs = qs.filter(
            first_name__icontains=search
        ) | Customer.objects.filter(
            orders__status=Order.Status.PAID,
            email__icontains=search,
        ).distinct()

    # Annotate with LTV for sorting
    paid_filter = Q(orders__status=Order.Status.PAID)
    qs = qs.annotate(
        ltv=Sum("orders__total", filter=paid_filter),
        order_count=Count("orders", filter=paid_filter),
        last_purchase=Max("orders__payment_confirmed_at", filter=paid_filter),
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


@api_view(["GET"])
@permission_classes([IsAdminUser])
def customer_detail(request: Request, customer_id: int):
    try:
        customer = Customer.objects.get(pk=customer_id)
    except Customer.DoesNotExist:
        return Response({"error": "Cliente no encontrado."}, status=404)

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

    # Top purchased products
    from apps.orders.models import OrderItem
    top_raw = (
        OrderItem.objects.filter(
            order__customer=customer,
            order__status=Order.Status.PAID,
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

    return Response({
        "id": customer.pk,
        "full_name": f"{customer.first_name} {customer.last_name}".strip(),
        "email": customer.email or "",
        "phone": customer.phone or "",
        "document_type": customer.document_type,
        "cedula": customer.cedula,
        "metrics": metrics,
        "orders": order_list,
        "top_products": top_products,
    })
