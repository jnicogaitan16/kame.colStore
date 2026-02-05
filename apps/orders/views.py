import json
import logging

from django.contrib import messages
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_GET, require_POST

from apps.customers.models import Customer
from apps.catalog.models import ProductVariant
from apps.orders.forms import CheckoutForm
from apps.orders.models import Order
from apps.orders.services import (
    create_order_from_cart,
    get_or_create_customer_from_form_data,
    validate_cart,
)
from apps.orders.services.shipping import calculate_shipping_cost

logger = logging.getLogger(__name__)


def checkout_view(request):
    """Vista para procesar el checkout del carrito."""
    cart = request.session.get("cart", {})
    if not cart:
        messages.error(request, "Tu carrito está vacío.")
        return redirect("catalog:product_list")

    if request.method == "POST":
        form = CheckoutForm(request.POST)
        if form.is_valid():
            try:
                # Toda la operación de creación de orden debe estar en una transacción
                # La limpieza del carrito se hace después de confirmar la transacción
                with transaction.atomic():
                    logger.info(
                        "Iniciando proceso de checkout",
                        extra={
                            "cart_items_count": len(cart),
                            "user_ip": request.META.get("REMOTE_ADDR"),
                        },
                    )

                    # Validar carrito y calcular subtotal
                    validated_cart, subtotal = validate_cart(cart)
                    logger.debug(
                        "Carrito validado: %s items, subtotal: %s",
                        len(validated_cart),
                        subtotal,
                    )

                    # Obtener o crear cliente
                    customer = get_or_create_customer_from_form_data(form.cleaned_data)
                    logger.debug("Cliente obtenido/creado: %s (%s)", customer.id, getattr(customer, "cedula", ""))

                    # Crear orden con items
                    order = create_order_from_cart(
                        customer=customer,
                        cart_items=validated_cart,
                        form_data=form.cleaned_data,
                        subtotal=subtotal,
                    )
                    logger.info(
                        "Orden creada exitosamente: #%s",
                        order.id,
                        extra={
                            "order_id": order.id,
                            "customer_id": customer.id,
                            "total": order.total,
                        },
                    )

                # Limpiar carrito de la sesión DESPUÉS de confirmar la transacción
                # Esto evita perder el carrito si la transacción falla
                request.session["cart"] = {}
                request.session.modified = True

                return redirect("orders:checkout_success", order_id=order.id)

            except ValidationError as e:
                logger.warning(
                    "Error de validación en checkout: %s",
                    e,
                    extra={
                        "error": str(e),
                        "user_ip": request.META.get("REMOTE_ADDR"),
                    },
                )
                messages.error(request, str(e))
                return redirect(request.path)
            except Exception as e:
                logger.error(
                    "Error inesperado en checkout: %s",
                    e,
                    exc_info=True,
                    extra={
                        "error": str(e),
                        "user_ip": request.META.get("REMOTE_ADDR"),
                    },
                )
                messages.error(request, f"Error al procesar el pedido: {e}")
                return redirect(request.path)
    else:
        form = CheckoutForm()

    return render(request, "orders/checkout.html", {"form": form})


def checkout_success(request, order_id):
    order = get_object_or_404(Order, pk=order_id)
    return render(request, "orders/checkout_success.html", {"order": order})


@require_POST
@csrf_protect
def shipping_quote_view(request):
    """Return shipping quote based on city_code and subtotal.

    This endpoint is intended to be called from our own frontend.
    It requires CSRF (session-based) to prevent cross-site abuse.
    """
    try:
        # Prefer GET params, fallback to JSON body
        city_code = request.GET.get("city_code")
        subtotal = request.GET.get("subtotal")

        if city_code is None or subtotal is None:
            payload = json.loads(request.body.decode("utf-8") or "{}")
            city_code = city_code or payload.get("city_code")
            subtotal = subtotal or payload.get("subtotal")

        subtotal = int(subtotal or 0)
    except (TypeError, ValueError, json.JSONDecodeError):
        return JsonResponse({"error": "Invalid parameters"}, status=400)

    if not city_code or subtotal < 0:
        return JsonResponse({"error": "city_code and subtotal are required"}, status=400)

    shipping_cost = calculate_shipping_cost(subtotal=subtotal, city_code=city_code)
    total = subtotal + shipping_cost

    return JsonResponse(
        {
            "city_code": city_code,
            "subtotal": subtotal,
            "shipping_cost": shipping_cost,
            "total": total,
        }
    )


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


# --- API: variant_price_view ---
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
    # Ensure JSON-serializable numeric output (Decimal -> float)
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
