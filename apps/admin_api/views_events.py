"""
Admin API — Analytics event ingestion (public endpoint).

POST /api/events/
"""
import logging

from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.request import Request
from rest_framework.throttling import AnonRateThrottle

from apps.orders.models import AnalyticsEvent

logger = logging.getLogger(__name__)

# Simple per-IP throttle: max 1000 events/minute
class EventsThrottle(AnonRateThrottle):
    rate = "1000/min"
    scope = "events"


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([EventsThrottle])
def ingest_events(request: Request):
    payload = request.data

    # Accept both array and {events: [...]} formats
    if isinstance(payload, list):
        events_data = payload
    elif isinstance(payload, dict):
        events_data = payload.get("events", [payload])
    else:
        return Response({"error": "Formato inválido."}, status=400)

    if len(events_data) > 100:
        return Response({"error": "Máximo 100 eventos por request."}, status=400)

    to_create = []
    skipped = 0
    for ev in events_data:
        event_name = str(ev.get("event") or "").strip()
        session_id = str(ev.get("session_id") or "").strip()

        if not event_name or not session_id:
            skipped += 1
            continue

        to_create.append(
            AnalyticsEvent(
                event=event_name,
                session_id=session_id,
                page=str(ev.get("page") or "")[:200],
                product_id=str(ev.get("product_id") or "")[:50],
                product_name=str(ev.get("product_name") or "")[:200],
                variant=str(ev.get("variant") or "")[:100],
                quantity=ev.get("quantity"),
                price=ev.get("price"),
                step=str(ev.get("step") or "")[:50],
                raw=ev if isinstance(ev, dict) else {},
            )
        )

    created = 0
    if to_create:
        try:
            objs = AnalyticsEvent.objects.bulk_create(to_create, ignore_conflicts=True)
            created = len(objs)
        except Exception as exc:
            logger.exception("[events] bulk_create failed: %s", exc)
            return Response({"error": "Error al guardar eventos."}, status=500)

    return Response({"ok": True, "created": created, "skipped": skipped})
