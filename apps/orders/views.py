import logging

from django.contrib.admin.views.decorators import staff_member_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET

from apps.customers.models import Customer
from apps.catalog.models import ProductVariant

logger = logging.getLogger(__name__)


@staff_member_required
@require_GET
def customer_snapshot_view(request):
    """Return customer snapshot data without saving the order.

    Expected query param: customer_id
    Returns: full_name, phone, email, cedula
    """
    customer_id = request.GET.get("customer_id")

    try:
        customer_id_int = int(customer_id or 0)
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid customer_id"}, status=400)

    if customer_id_int <= 0:
        return JsonResponse({"error": "customer_id is required"}, status=400)

    customer = get_object_or_404(Customer, pk=customer_id_int)

    first_name = (getattr(customer, "first_name", "") or "").strip()
    last_name = (getattr(customer, "last_name", "") or "").strip()
    name = (getattr(customer, "name", "") or "").strip()

    if first_name or last_name:
        full_name = f"{first_name} {last_name}".strip()
    elif name:
        full_name = name
    else:
        full_name = str(customer).strip()

    phone = (getattr(customer, "phone", "") or "").strip()
    email = (getattr(customer, "email", "") or "").strip()
    cedula = (getattr(customer, "cedula", "") or "").strip()

    return JsonResponse(
        {
            "customer_id": customer.id,
            "full_name": full_name,
            "phone": phone,
            "email": email,
            "cedula": cedula,
        }
    )


@staff_member_required
@require_GET
def variant_price_view(request):
    variant_id = request.GET.get("variant_id")

    try:
        variant_id_int = int(variant_id or 0)
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid variant_id"}, status=400)

    if variant_id_int <= 0:
        return JsonResponse({"error": "variant_id is required"}, status=400)

    variant = get_object_or_404(ProductVariant, pk=variant_id_int)

    price = getattr(variant.product, "price", None)
    try:
        price = float(price or 0)
    except (TypeError, ValueError):
        price = 0.0

    return JsonResponse(
        {
            "variant_id": variant.id,
            "unit_price": price,
        }
    )
