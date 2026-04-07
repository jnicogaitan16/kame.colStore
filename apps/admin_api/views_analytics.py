"""
Admin API — Analytics + Pending payment recovery.

GET /api/admin/analytics/?period=7d|30d
GET /api/admin/orders/pending-recovery/
"""
from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.request import Request

from apps.orders.models import Order, AnalyticsEvent


@api_view(["GET"])
@permission_classes([IsAdminUser])
def analytics_view(request: Request):
    period = request.query_params.get("period", "7d")
    days = 30 if period == "30d" else 7
    start = timezone.now() - timedelta(days=days)

    # Top products by clicks
    top_clicks_raw = (
        AnalyticsEvent.objects.filter(
            event="product_click",
            timestamp__gte=start,
        )
        .values("product_id", "product_name")
        .annotate(clicks=Count("id"))
        .order_by("-clicks")[:10]
    )
    top_clicks = [
        {
            "product_id": r["product_id"],
            "product_name": r["product_name"],
            "clicks": r["clicks"],
        }
        for r in top_clicks_raw
    ]

    # Funnel
    funnel_events = [
        "product_view",
        "product_click",
        "add_to_cart",
        "checkout_start",
        "purchase_complete",
    ]
    funnel = []
    for ev in funnel_events:
        count = AnalyticsEvent.objects.filter(
            event=ev, timestamp__gte=start
        ).values("session_id").distinct().count()
        funnel.append({"event": ev, "sessions": count})

    # Checkout abandonment by step
    steps_raw = (
        AnalyticsEvent.objects.filter(
            event="checkout_step",
            timestamp__gte=start,
        )
        .values("step")
        .annotate(count=Count("session_id", distinct=True))
        .order_by("step")
    )
    checkout_steps = [{"step": r["step"], "count": r["count"]} for r in steps_raw]

    return Response({
        "period": period,
        "top_products_by_clicks": top_clicks,
        "funnel": funnel,
        "checkout_steps": checkout_steps,
    })


@api_view(["GET"])
@permission_classes([IsAdminUser])
def pending_recovery_list(request: Request):
    """Orders stuck in PENDING_PAYMENT for more than 2 hours."""
    cutoff = timezone.now() - timedelta(hours=2)

    orders = Order.objects.filter(
        status=Order.Status.PENDING_PAYMENT,
        created_at__lte=cutoff,
    ).order_by("created_at")

    now = timezone.now()
    results = []
    for o in orders:
        delta = now - o.created_at
        hours = int(delta.total_seconds() // 3600)
        mins = int((delta.total_seconds() % 3600) // 60)
        time_pending = f"{hours}h {mins}min"

        items_summary = ", ".join(
            f"{item.product_variant} x{item.quantity}"
            for item in o.items.select_related("product_variant__product").all()[:3]
        )

        results.append({
            "reference": o.payment_reference or f"ORD-{o.pk}",
            "id": o.pk,
            "customer_name": o.full_name,
            "email": o.email,
            "items_summary": items_summary,
            "total": o.total,
            "time_pending": time_pending,
            "created_at": o.created_at.isoformat(),
        })

    return Response({"count": len(results), "results": results})
