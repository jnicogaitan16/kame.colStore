"""Vistas mínimas de infraestructura (healthcheck para túneles, load balancers, CI)."""

from django.http import JsonResponse


def api_health(_request):
    """GET /api/health/ — sin auth; útil tras ngrok/Cloudflare hacia el backend."""
    return JsonResponse({"status": "ok"})
