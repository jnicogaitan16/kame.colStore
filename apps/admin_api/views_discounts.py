"""Admin API views for discount rules management."""
from __future__ import annotations

import json
import logging

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser

from apps.catalog.models import DiscountRule

logger = logging.getLogger(__name__)


def _serialize_rule(rule: DiscountRule) -> dict:
    return {
        "id": rule.pk,
        "name": rule.name,
        "discount_type": rule.discount_type,
        "discount_value": float(rule.discount_value),
        "scope": rule.scope,
        "department_id": rule.department_id,
        "department_name": getattr(rule.department, "name", None),
        "category_id": rule.category_id,
        "category_name": getattr(rule.category, "name", None),
        "product_id": rule.product_id,
        "product_name": getattr(rule.product, "name", None),
        "starts_at": rule.starts_at.isoformat() if rule.starts_at else None,
        "ends_at": rule.ends_at.isoformat() if rule.ends_at else None,
        "is_active": rule.is_active,
        "is_currently_active": rule.is_currently_active(),
        "priority": rule.priority,
        "created_at": rule.created_at.isoformat(),
    }


@api_view(["GET"])
@permission_classes([IsAdminUser])
def discounts_list(request):
    rules = (
        DiscountRule.objects
        .select_related("department", "category", "product")
        .order_by("-is_active", "-priority", "-created_at")
    )
    return JsonResponse([_serialize_rule(r) for r in rules], safe=False)


@api_view(["POST"])
@permission_classes([IsAdminUser])
def discount_create(request):
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "JSON inválido."}, status=400)

    rule = DiscountRule(
        name=data.get("name", ""),
        discount_type=data.get("discount_type", DiscountRule.DiscountType.PERCENTAGE),
        discount_value=data.get("discount_value", 0),
        scope=data.get("scope", DiscountRule.Scope.STORE_WIDE),
        department_id=data.get("department_id") or None,
        category_id=data.get("category_id") or None,
        product_id=data.get("product_id") or None,
        starts_at=data.get("starts_at"),
        ends_at=data.get("ends_at") or None,
        is_active=data.get("is_active", True),
        priority=data.get("priority", 0),
    )

    try:
        rule.full_clean()
        rule.save()
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse(_serialize_rule(rule), status=201)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAdminUser])
def discount_detail(request, rule_id):
    try:
        rule = DiscountRule.objects.select_related("department", "category", "product").get(pk=rule_id)
    except DiscountRule.DoesNotExist:
        return JsonResponse({"error": "No encontrado."}, status=404)

    if request.method == "GET":
        return JsonResponse(_serialize_rule(rule))

    if request.method == "DELETE":
        rule.delete()
        return JsonResponse({"ok": True})

    # PUT
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "JSON inválido."}, status=400)

    for field in ("name", "discount_type", "discount_value", "scope", "is_active", "priority"):
        if field in data:
            setattr(rule, field, data[field])

    if "department_id" in data:
        rule.department_id = data["department_id"] or None
    if "category_id" in data:
        rule.category_id = data["category_id"] or None
    if "product_id" in data:
        rule.product_id = data["product_id"] or None
    if "starts_at" in data:
        rule.starts_at = data["starts_at"]
    if "ends_at" in data:
        rule.ends_at = data["ends_at"] or None

    try:
        rule.full_clean()
        rule.save()
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse(_serialize_rule(rule))
