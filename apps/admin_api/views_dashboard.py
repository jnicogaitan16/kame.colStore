"""
Admin API — Dashboard endpoint.

GET /api/admin/dashboard/?period=7d|30d|today
"""
from datetime import timedelta, date

from django.db.models import Sum, Count, Avg, Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.request import Request


def _get_date_range(period: str):
    now = timezone.now()
    today = now.date()
    if period == "today":
        start = timezone.make_aware(
            timezone.datetime(today.year, today.month, today.day)
        )
    elif period == "30d":
        start = now - timedelta(days=30)
    else:  # default 7d
        start = now - timedelta(days=7)
    return start, now


@api_view(["GET"])
@permission_classes([IsAdminUser])
def dashboard_view(request: Request):
    from apps.orders.models import Order, AnalyticsEvent

    period = request.query_params.get("period", "7d")
    start, end = _get_date_range(period)

    paid_qs = Order.objects.filter(
        status=Order.Status.PAID,
        payment_confirmed_at__gte=start,
        payment_confirmed_at__lte=end,
    )

    total_revenue = paid_qs.aggregate(s=Sum("total"))["s"] or 0
    order_count = paid_qs.count()
    avg_ticket = paid_qs.aggregate(a=Avg("total"))["a"] or 0

    all_qs = Order.objects.filter(created_at__gte=start, created_at__lte=end)
    total_created = all_qs.count()
    conversion_rate = round((order_count / total_created * 100), 1) if total_created else 0.0

    revenue_at_risk = (
        Order.objects.filter(status=Order.Status.PENDING_PAYMENT)
        .aggregate(s=Sum("total"))["s"] or 0
    )

    # Daily sales (last 30 days always for the chart)
    chart_start = timezone.now() - timedelta(days=30)
    daily_raw = (
        Order.objects.filter(
            status=Order.Status.PAID,
            payment_confirmed_at__gte=chart_start,
        )
        .extra(select={"day": "DATE(payment_confirmed_at)"})
        .values("day")
        .annotate(amount=Sum("total"))
        .order_by("day")
    )
    daily_sales = [
        {"date": str(r["day"]), "amount": int(r["amount"] or 0)}
        for r in daily_raw
    ]

    # Top 5 products by units sold
    from apps.orders.models import OrderItem
    top_raw = (
        OrderItem.objects.filter(
            order__status=Order.Status.PAID,
            order__payment_confirmed_at__gte=start,
            order__payment_confirmed_at__lte=end,
        )
        .values(
            "product_variant__product__name",
            "product_variant__product__id",
        )
        .annotate(units=Sum("quantity"))
        .order_by("-units")[:5]
    )
    top_products = [
        {
            "product_id": r["product_variant__product__id"],
            "name": r["product_variant__product__name"],
            "units": r["units"],
        }
        for r in top_raw
    ]

    # Funnel from AnalyticsEvent
    events_sent = AnalyticsEvent.objects.filter(
        event="add_to_cart",
        timestamp__gte=start,
        timestamp__lte=end,
    ).values("session_id").distinct().count()

    orders_created = all_qs.count()
    paid_count = order_count

    funnel = {
        "events_sent": events_sent,
        "orders_created": orders_created,
        "paid": paid_count,
    }

    # Recent orders (last 10)
    recent = (
        Order.objects.select_related("customer")
        .order_by("-created_at")[:10]
    )
    recent_orders = [
        {
            "reference": o.payment_reference or f"ORD-{o.pk}",
            "customer_name": o.full_name or str(o.customer),
            "total": o.total,
            "status": o.status,
            "created_at": o.created_at.isoformat(),
        }
        for o in recent
    ]

    return Response({
        "period": period,
        "total_revenue": int(total_revenue),
        "order_count": order_count,
        "avg_ticket": int(avg_ticket),
        "conversion_rate": conversion_rate,
        "revenue_at_risk": int(revenue_at_risk),
        "daily_sales": daily_sales,
        "top_products": top_products,
        "funnel": funnel,
        "recent_orders": recent_orders,
    })
