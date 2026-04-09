"""
Admin API — Dashboard endpoint.

GET /api/admin/dashboard/?period=7d|30d|today
GET /api/admin/dashboard/?start=YYYY-MM-DD&end=YYYY-MM-DD
"""
from datetime import timedelta, date, datetime

from django.db.models import Sum, Count, Avg, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.request import Request


def _get_date_range(period: str, start_str: str = None, end_str: str = None):
    now = timezone.now()
    today = now.date()

    # Custom date range takes priority over period shortcut
    if start_str:
        try:
            start_date = date.fromisoformat(start_str)
            start = timezone.make_aware(datetime(start_date.year, start_date.month, start_date.day))
        except ValueError:
            start = now - timedelta(days=7)
    elif period == "today":
        start = timezone.make_aware(datetime(today.year, today.month, today.day))
    elif period == "30d":
        start = now - timedelta(days=30)
    elif period == "this_month":
        start = timezone.make_aware(datetime(today.year, today.month, 1))
    elif period == "last_month":
        first_this = today.replace(day=1)
        last_month_end = first_this - timedelta(days=1)
        start = timezone.make_aware(datetime(last_month_end.year, last_month_end.month, 1))
        now = timezone.make_aware(datetime(last_month_end.year, last_month_end.month, last_month_end.day, 23, 59, 59))
    else:  # default 7d
        start = now - timedelta(days=7)

    if end_str:
        try:
            end_date = date.fromisoformat(end_str)
            end = timezone.make_aware(datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59))
        except ValueError:
            end = now
    else:
        end = now

    return start, end


def _get_daily_sales(start, end):
    """
    Ventas diarias (pedidos pagados/enviados) en [start, end], una entrada por día
    calendario entre start.date() y end.date() (inclusive), con 0 si no hubo ventas.
    """
    from apps.orders.models import Order

    tz = timezone.get_current_timezone()
    daily_agg = (
        Order.objects.filter(
            status__in=[Order.Status.PAID, Order.Status.SHIPPED],
            payment_confirmed_at__gte=start,
            payment_confirmed_at__lte=end,
        )
        .annotate(day=TruncDate("payment_confirmed_at", tzinfo=tz))
        .values("day")
        .annotate(amount=Sum("total"))
        .order_by("day")
    )

    amounts_by_day: dict[date, int] = {}
    for row in daily_agg:
        d = row["day"]
        if d is None:
            continue
        day_key = d.date() if isinstance(d, datetime) else d
        amounts_by_day[day_key] = int(row["amount"] or 0)

    start_d, end_d = start.date(), end.date()
    out = []
    cur = start_d
    while cur <= end_d:
        out.append(
            {"date": cur.isoformat(), "amount": amounts_by_day.get(cur, 0)}
        )
        cur += timedelta(days=1)
    return out


@api_view(["GET"])
@permission_classes([IsAdminUser])
def dashboard_view(request: Request):
    from apps.orders.models import Order, AnalyticsEvent

    period = request.query_params.get("period", "7d")
    start_str = request.query_params.get("start")
    end_str = request.query_params.get("end")
    start, end = _get_date_range(period, start_str, end_str)

    revenue_qs = Order.objects.filter(
        status__in=[Order.Status.PAID, Order.Status.SHIPPED],
        payment_confirmed_at__gte=start,
        payment_confirmed_at__lte=end,
    )

    total_revenue = revenue_qs.aggregate(s=Sum("total"))["s"] or 0
    order_count = revenue_qs.count()
    avg_ticket = revenue_qs.aggregate(a=Avg("total"))["a"] or 0

    all_qs = Order.objects.filter(created_at__gte=start, created_at__lte=end)
    total_created = all_qs.count()
    conversion_rate = round((order_count / total_created * 100), 1) if total_created else 0.0

    revenue_at_risk = (
        Order.objects.filter(status=Order.Status.PENDING_PAYMENT)
        .aggregate(s=Sum("total"))["s"] or 0
    )

    daily_sales = _get_daily_sales(start, end)

    # Top 5 products by units sold
    from apps.orders.models import OrderItem
    top_raw = (
        OrderItem.objects.filter(
            order__status__in=[Order.Status.PAID, Order.Status.SHIPPED],
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

    # Recent orders within the selected range (last 10)
    recent = (
        Order.objects.select_related("customer")
        .filter(created_at__gte=start, created_at__lte=end)
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
        "start_date": start.date().isoformat(),
        "end_date": end.date().isoformat(),
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
