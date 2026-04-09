"""
Admin API — Inventory management.

GET    /api/admin/inventory/
POST   /api/admin/inventory/              (alta unitaria)
POST   /api/admin/inventory/bulk/         (carga masiva)
PATCH  /api/admin/inventory/{pool_id}/
DELETE /api/admin/inventory/{pool_id}/
GET    /api/admin/inventory/{pool_id}/history/
"""
from django.db import transaction
from django.db.models import Q
from django.core.exceptions import ValidationError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.request import Request

from apps.catalog.forms import InventoryPoolBulkLoadForm
from apps.catalog.models import InventoryPool, InventoryAdjustmentLog
from apps.catalog.services.inventory_pool_bulk import process_bulk_stock_lines


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
        "updated_at": pool.updated_at.isoformat(),
    }


@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
def inventory_list(request: Request):
    if request.method == "POST":
        return _inventory_create(request)

    qs = InventoryPool.objects.select_related("category").order_by(
        "category__name", "value", "color"
    )

    category = request.query_params.get("category")
    if category:
        qs = qs.filter(category__slug=category)

    search = request.query_params.get("search", "").strip()
    if search:
        qs = qs.filter(
            Q(category__name__icontains=search)
            | Q(value__icontains=search)
            | Q(color__icontains=search)
        )

    return Response([_serialize_pool(p) for p in qs])


def _inventory_create(request: Request) -> Response:
    data = request.data
    category_id = data.get("category_id")
    if not category_id:
        return Response({"error": "Se requiere category_id."}, status=400)

    try:
        quantity = int(data.get("quantity", 0))
        if quantity < 0:
            raise ValueError
    except (TypeError, ValueError):
        return Response({"error": "quantity debe ser un entero no negativo."}, status=400)

    pool = InventoryPool(
        category_id=category_id,
        value=(data.get("value") or ""),
        color=(data.get("color") or ""),
        quantity=quantity,
        is_active=bool(data.get("is_active", True)),
    )
    try:
        pool.full_clean()
    except ValidationError as e:
        err = getattr(e, "error_dict", None)
        if err:
            return Response({"errors": err}, status=400)
        return Response({"errors": {"__all__": list(e.messages)}}, status=400)

    pool.save()
    return Response(_serialize_pool(pool), status=201)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def inventory_bulk_load(request: Request):
    form = InventoryPoolBulkLoadForm(
        data={
            "category": request.data.get("category_id"),
            "lines": request.data.get("lines", "") or "",
            "add_to_existing": bool(request.data.get("add_to_existing")),
        }
    )
    if not form.is_valid():
        return Response({"errors": form.errors}, status=400)

    category = form.cleaned_data["category"]
    add_to_existing = bool(form.cleaned_data.get("add_to_existing"))
    rows = [
        (r["value"], r["color"], r["quantity"])
        for r in form.parsed_lines
    ]
    created, updated, errs = process_bulk_stock_lines(category.id, rows, add_to_existing)
    return Response(
        {
            "ok": True,
            "created": created,
            "updated": updated,
            "errors": errs,
        }
    )


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAdminUser])
def inventory_update(request: Request, pool_id: int):
    # CONCURRENCY: select_for_update prevents race condition on stock decrement
    if request.method == "DELETE":
        with transaction.atomic():
            try:
                locked = InventoryPool.objects.select_for_update().get(pk=pool_id)
            except InventoryPool.DoesNotExist:
                return Response({"error": "Pool de inventario no encontrado."}, status=404)
            locked.delete()
        return Response(status=204)

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

    with transaction.atomic():
        try:
            pool = InventoryPool.objects.select_for_update().get(pk=pool_id)
        except InventoryPool.DoesNotExist:
            return Response({"error": "Pool de inventario no encontrado."}, status=404)
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
