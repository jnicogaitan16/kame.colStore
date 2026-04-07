"""
Admin API — Inventory management.

GET   /api/admin/inventory/
PATCH /api/admin/inventory/{pool_id}/
GET   /api/admin/inventory/{variant_id}/history/
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.request import Request

from apps.catalog.models import InventoryPool, InventoryAdjustmentLog


def _serialize_pool(pool: InventoryPool) -> dict:
    reserved = 0  # future: calculate from pending orders
    return {
        "pool_id": pool.pk,
        "category_id": pool.category_id,
        "category_name": pool.category.name,
        "value": pool.value,
        "color": pool.color,
        "quantity": pool.quantity,
        "reserved": reserved,
        "is_active": pool.is_active,
        "low_stock": pool.quantity <= 3,
    }


@api_view(["GET"])
@permission_classes([IsAdminUser])
def inventory_list(request: Request):
    qs = InventoryPool.objects.select_related("category").order_by(
        "category__name", "value", "color"
    )

    category = request.query_params.get("category")
    if category:
        qs = qs.filter(category__slug=category)

    search = request.query_params.get("search", "").strip()
    if search:
        qs = qs.filter(category__name__icontains=search)

    return Response([_serialize_pool(p) for p in qs])


@api_view(["PATCH"])
@permission_classes([IsAdminUser])
def inventory_update(request: Request, pool_id: int):
    try:
        pool = InventoryPool.objects.get(pk=pool_id)
    except InventoryPool.DoesNotExist:
        return Response({"error": "Pool de inventario no encontrado."}, status=404)

    new_stock = request.data.get("new_stock")
    reason = request.data.get("reason", "Ajuste manual desde admin").strip()

    if new_stock is None:
        return Response({"error": "Se requiere new_stock."}, status=400)

    try:
        new_stock = int(new_stock)
        if new_stock < 0:
            raise ValueError
    except (ValueError, TypeError):
        return Response({"error": "new_stock debe ser un entero no negativo."}, status=400)

    previous = pool.quantity
    pool.quantity = new_stock
    pool.save(update_fields=["quantity", "updated_at"])

    InventoryAdjustmentLog.objects.create(
        inventory_pool=pool,
        previous_stock=previous,
        new_stock=new_stock,
        reason=reason,
        adjusted_by=request.user,
    )

    return Response({
        "ok": True,
        "pool_id": pool.pk,
        "previous_stock": previous,
        "new_stock": new_stock,
    })


@api_view(["GET"])
@permission_classes([IsAdminUser])
def inventory_history(request: Request, pool_id: int):
    try:
        pool = InventoryPool.objects.get(pk=pool_id)
    except InventoryPool.DoesNotExist:
        return Response({"error": "Pool de inventario no encontrado."}, status=404)

    logs = InventoryAdjustmentLog.objects.filter(
        inventory_pool=pool
    ).select_related("adjusted_by").order_by("-created_at")

    return Response({
        "pool_id": pool.pk,
        "category": pool.category.name,
        "value": pool.value,
        "color": pool.color,
        "history": [
            {
                "id": log.pk,
                "previous_stock": log.previous_stock,
                "new_stock": log.new_stock,
                "diff": log.new_stock - log.previous_stock,
                "reason": log.reason,
                "adjusted_by": log.adjusted_by.username if log.adjusted_by else None,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ],
    })
