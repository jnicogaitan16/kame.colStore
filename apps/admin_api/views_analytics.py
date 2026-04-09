"""
Admin API — Analytics + Pending payment recovery.

GET /api/admin/analytics/?period=7d|30d|…
GET /api/admin/analytics/?start=YYYY-MM-DD&end=YYYY-MM-DD  (mismo criterio que dashboard)

GET /api/admin/orders/pending-recovery/
"""
from collections import defaultdict
from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.request import Request

from apps.admin_api.views_dashboard import _get_date_range
from apps.orders.models import Order, AnalyticsEvent


def _session_ids_by_product(start, end, event: str) -> dict[str, set]:
    m: dict[str, set] = defaultdict(set)
    for pid, sid in (
        AnalyticsEvent.objects.filter(
            timestamp__gte=start,
            timestamp__lte=end,
            event=event,
        )
        .exclude(product_id="")
        .values_list("product_id", "session_id")
    ):
        m[pid].add(sid)
    return m


def _product_performance(start, end, limit: int = 30):
    """Métricas por product_id: vistas, clics, carritos, tasas (sesiones que vieron y agregaron)."""
    base = AnalyticsEvent.objects.filter(
        timestamp__gte=start,
        timestamp__lte=end,
    ).exclude(product_id="")

    metrics: dict[str, dict] = defaultdict(
        lambda: {
            "product_id": "",
            "product_name": "",
            "product_views": 0,
            "view_sessions": 0,
            "product_clicks": 0,
            "click_sessions": 0,
            "add_to_cart": 0,
            "cart_sessions": 0,
        }
    )

    for row in (
        base.filter(event="product_view")
        .values("product_id", "product_name")
        .annotate(c=Count("id"), s=Count("session_id", distinct=True))
    ):
        pid = row["product_id"]
        m = metrics[pid]
        m["product_id"] = pid
        m["product_name"] = row["product_name"] or m["product_name"]
        m["product_views"] = row["c"]
        m["view_sessions"] = row["s"]

    for row in (
        base.filter(event="product_click")
        .values("product_id", "product_name")
        .annotate(c=Count("id"), s=Count("session_id", distinct=True))
    ):
        pid = row["product_id"]
        m = metrics[pid]
        m["product_id"] = pid
        m["product_name"] = row["product_name"] or m["product_name"]
        m["product_clicks"] = row["c"]
        m["click_sessions"] = row["s"]

    for row in (
        base.filter(event="add_to_cart")
        .values("product_id", "product_name")
        .annotate(c=Count("id"), s=Count("session_id", distinct=True))
    ):
        pid = row["product_id"]
        m = metrics[pid]
        m["product_id"] = pid
        m["product_name"] = row["product_name"] or m["product_name"]
        m["add_to_cart"] = row["c"]
        m["cart_sessions"] = row["s"]

    view_map = _session_ids_by_product(start, end, "product_view")
    cart_map = _session_ids_by_product(start, end, "add_to_cart")

    rows = []
    for pid, m in metrics.items():
        if not m["product_id"]:
            continue
        vs = view_map.get(pid, set())
        cs = cart_map.get(pid, set())
        joint = len(vs & cs)
        m["sessions_view_and_cart"] = joint
        m["conv_view_to_cart_pct"] = (
            round(joint / len(vs) * 100, 1) if vs else None
        )
        vcount, ccount = m["product_views"], m["product_clicks"]
        m["click_through_pct"] = (
            round(ccount / vcount * 100, 1) if vcount else None
        )
        rows.append(m)

    rows.sort(
        key=lambda x: (
            -(x["add_to_cart"] or 0),
            -(x["product_views"] or 0),
            -(x["product_clicks"] or 0),
        )
    )
    return rows[:limit]


@api_view(["GET"])
@permission_classes([IsAdminUser])
def analytics_view(request: Request):
    period = request.query_params.get("period", "7d")
    start_str = request.query_params.get("start")
    end_str = request.query_params.get("end")
    start, end = _get_date_range(period, start_str, end_str)

    base_q = AnalyticsEvent.objects.filter(
        timestamp__gte=start, timestamp__lte=end
    )

    # Top products by clicks (compat + listas cortas)
    top_clicks_raw = (
        base_q.filter(event="product_click")
        .exclude(product_id="")
        .values("product_id", "product_name")
        .annotate(clicks=Count("id"))
        .order_by("-clicks")[:15]
    )
    top_clicks = [
        {
            "product_id": r["product_id"],
            "product_name": r["product_name"],
            "clicks": r["clicks"],
        }
        for r in top_clicks_raw
    ]

    top_cart_raw = (
        base_q.filter(event="add_to_cart")
        .exclude(product_id="")
        .values("product_id", "product_name")
        .annotate(adds=Count("id"))
        .order_by("-adds")[:15]
    )
    top_add_to_cart = [
        {
            "product_id": r["product_id"],
            "product_name": r["product_name"],
            "add_to_cart": r["adds"],
        }
        for r in top_cart_raw
    ]

    top_views_raw = (
        base_q.filter(event="product_view")
        .exclude(product_id="")
        .values("product_id", "product_name")
        .annotate(views=Count("id"))
        .order_by("-views")[:15]
    )
    top_product_views = [
        {
            "product_id": r["product_id"],
            "product_name": r["product_name"],
            "views": r["views"],
        }
        for r in top_views_raw
    ]

    product_performance = _product_performance(start, end, limit=35)

    # Funnel: sesiones únicas por paso (independientes entre sí)
    funnel_events = [
        "product_view",
        "product_click",
        "add_to_cart",
        "checkout_start",
        "purchase_complete",
    ]
    funnel = []
    for ev in funnel_events:
        count = (
            base_q.filter(event=ev)
            .values("session_id")
            .distinct()
            .count()
        )
        funnel.append({"event": ev, "sessions": count})

    # Volumen bruto de eventos (evita interpretar como embudo estricto)
    funnel_volume = []
    for ev in funnel_events:
        funnel_volume.append(
            {"event": ev, "count": base_q.filter(event=ev).count()}
        )

    steps_raw = (
        base_q.filter(event="checkout_step")
        .values("step")
        .annotate(count=Count("session_id", distinct=True))
        .order_by("step")
    )
    checkout_steps = [{"step": r["step"], "count": r["count"]} for r in steps_raw]

    home_q = base_q.filter(event="home_visit")
    home_visit_hits = home_q.count()
    home_visit_sessions = home_q.values("session_id").distinct().count()

    total_events = base_q.count()
    unique_sessions = base_q.values("session_id").distinct().count()

    events_by_type = {
        r["event"]: r["c"]
        for r in base_q.values("event").annotate(c=Count("id")).order_by("event")
    }

    tz = timezone.get_current_timezone()
    daily_raw = (
        base_q.annotate(day=TruncDate("timestamp", tzinfo=tz))
        .values("day")
        .annotate(events=Count("id"))
        .order_by("day")
    )
    daily_activity = []
    for r in daily_raw:
        d = r["day"]
        daily_activity.append(
            {
                "date": d.isoformat() if hasattr(d, "isoformat") else str(d),
                "events": r["events"],
            }
        )

    return Response(
        {
            "period": period,
            "start_date": start.date().isoformat(),
            "end_date": end.date().isoformat(),
            "summary": {
                "total_events": total_events,
                "unique_sessions": unique_sessions,
                "events_by_type": events_by_type,
            },
            "daily_activity": daily_activity,
            "top_products_by_clicks": top_clicks,
            "top_products_by_views": top_product_views,
            "top_products_by_add_to_cart": top_add_to_cart,
            "product_performance": product_performance,
            "funnel": funnel,
            "funnel_volume": funnel_volume,
            "checkout_steps": checkout_steps,
            "home_traffic": {
                "hits": home_visit_hits,
                "sessions": home_visit_sessions,
            },
        }
    )


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

        results.append(
            {
                "reference": o.payment_reference or f"ORD-{o.pk}",
                "id": o.pk,
                "customer_name": o.full_name,
                "email": o.email,
                "items_summary": items_summary,
                "total": o.total,
                "time_pending": time_pending,
                "created_at": o.created_at.isoformat(),
            }
        )

    return Response({"count": len(results), "results": results})
