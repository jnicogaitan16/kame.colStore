from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST

from apps.orders.services import (
    add_to_cart,
    get_cart,
    remove_from_cart,
    update_qty,
    validate_session_cart,
)
from apps.orders.services.shipping import calculate_shipping_cost


def _cart_summary_payload(request) -> dict:
    """
    Summary para UI responsive:
    - Lee el carrito desde session
    - Expande items (variant/product)
    - Calcula subtotal
    - Calcula shipping preliminar si llega city_code (opcional)
    """
    cart = get_cart(request)
    lines, subtotal = validate_session_cart(cart, strict_stock=False)

    city_code = (request.GET.get("city_code") or request.POST.get("city_code") or "").strip()

    shipping_cost = 0
    if city_code:
        try:
            shipping_cost = int(calculate_shipping_cost(subtotal=int(subtotal), city_code=city_code))
        except Exception:
            shipping_cost = 0

    total_prelim = int(subtotal) + int(shipping_cost)

    items = []
    for line in lines:
        pv = line.variant
        p = line.product
        items.append(
            {
                "variant_id": pv.id,
                "product_id": p.id,
                "product_name": getattr(p, "name", str(p)),
                "variant_label": str(pv),
                "qty": int(line.qty),
                "unit_price": int(line.unit_price),
                "line_total": int(line.line_total),
                "available_stock": line.available_stock,
                "is_available": bool(line.is_available),
            }
        )

    return {
        "items": items,
        "items_count": sum(i["qty"] for i in items),
        "subtotal": int(subtotal),
        "shipping_cost": int(shipping_cost),
        "total_prelim": int(total_prelim),
    }


@require_POST
def cart_add_view(request):
    """
    POST /orders/api/cart/add/
    form-data:
      - variant_id (required)
      - qty (optional, default 1)
      - city_code (optional)
    """
    try:
        variant_id = int(request.POST.get("variant_id") or 0)
        qty = int(request.POST.get("qty") or 1)

        if variant_id <= 0:
            return JsonResponse({"ok": False, "error": "variant_id requerido."}, status=400)

        add_to_cart(request, variant_id=variant_id, qty=qty, enforce_stock=True)
        payload = _cart_summary_payload(request)
        payload["ok"] = True
        return JsonResponse(payload)
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)


@require_POST
def cart_update_view(request):
    """
    POST /orders/api/cart/update/
    form-data:
      - variant_id (required)
      - qty (required)
      - city_code (optional)
    """
    try:
        variant_id = int(request.POST.get("variant_id") or 0)
        qty = int(request.POST.get("qty") or 0)

        if variant_id <= 0:
            return JsonResponse({"ok": False, "error": "variant_id requerido."}, status=400)

        update_qty(request, variant_id=variant_id, qty=qty, enforce_stock=True)
        payload = _cart_summary_payload(request)
        payload["ok"] = True
        return JsonResponse(payload)
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)


@require_POST
def cart_remove_view(request):
    """
    POST /orders/api/cart/remove/
    form-data:
      - variant_id (required)
      - city_code (optional)
    """
    try:
        variant_id = int(request.POST.get("variant_id") or 0)

        if variant_id <= 0:
            return JsonResponse({"ok": False, "error": "variant_id requerido."}, status=400)

        remove_from_cart(request, variant_id=variant_id)
        payload = _cart_summary_payload(request)
        payload["ok"] = True
        return JsonResponse(payload)
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)


@require_GET
def cart_summary_view(request):
    """
    GET /orders/api/cart/summary/?city_code=...
    """
    try:
        payload = _cart_summary_payload(request)
        payload["ok"] = True
        return JsonResponse(payload)
    except Exception as e:
        return JsonResponse({"ok": False, "error": str(e)}, status=400)