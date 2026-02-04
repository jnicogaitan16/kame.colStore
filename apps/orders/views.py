from django.contrib import messages
from django.db import transaction
from django.shortcuts import get_object_or_404, redirect, render
from django.http import JsonResponse

from apps.customers.models import Customer
from apps.orders.forms import CheckoutForm
from apps.orders.models import Order, OrderItem
from apps.orders.services.shipping import calculate_shipping_cost

def checkout_view(request):
    cart = request.session.get("cart", {})
    if not cart:
        messages.error(request, "Tu carrito está vacío.")
        return redirect("catalog:product_list")

    if request.method == "POST":
        form = CheckoutForm(request.POST)
        if form.is_valid():
            with transaction.atomic():
                subtotal = 0
                for variant_id, item in cart.items():
                    qty = int(item["qty"])
                    unit_price = int(item["unit_price"])
                    subtotal += qty * unit_price

                customer, _ = Customer.objects.get_or_create(
                    cedula=form.cleaned_data["cedula"],
                    defaults={
                        "full_name": form.cleaned_data["full_name"],
                        "phone": form.cleaned_data["phone"],
                        "email": form.cleaned_data.get("email") or "",
                    },
                )

                city_code = form.cleaned_data["city_code"]
                shipping_cost = calculate_shipping_cost(subtotal=subtotal, city_code=city_code)
                total = subtotal + shipping_cost

                order = Order.objects.create(
                    customer=customer,
                    status=Order.Status.PENDING_PAYMENT,
                    payment_method="transferencia",

                    full_name=form.cleaned_data["full_name"],
                    cedula=form.cleaned_data["cedula"],
                    phone=form.cleaned_data["phone"],
                    email=form.cleaned_data.get("email") or "",

                    city_code=city_code,
                    address=form.cleaned_data["address"],
                    notes=form.cleaned_data.get("notes") or "",

                    subtotal=subtotal,
                    shipping_cost=shipping_cost,
                    total=total,
                )

                for variant_id, item in cart.items():
                    OrderItem.objects.create(
                        order=order,
                        product_variant_id=int(variant_id),
                        quantity=int(item["qty"]),
                        unit_price=int(item["unit_price"]),
                    )

                request.session["cart"] = {}
                request.session.modified = True

            return redirect("orders:checkout_success", order_id=order.id)
    else:
        form = CheckoutForm()

    return render(request, "orders/checkout.html", {"form": form})

def checkout_success(request, order_id):
    order = get_object_or_404(Order, pk=order_id)
    return render(request, "orders/checkout_success.html", {"order": order})


def shipping_quote_view(request):
    """Return shipping quote based on city_code and subtotal.

    This is a read-only endpoint intended for frontend usage (GET).
    It does not require CSRF protection.
    """
    try:
        city_code = request.GET.get("city_code")
        subtotal = int(request.GET.get("subtotal", 0))
    except (TypeError, ValueError):
        return JsonResponse(
            {"error": "Invalid parameters"},
            status=400,
        )

    if not city_code or subtotal < 0:
        return JsonResponse(
            {"error": "city_code and subtotal are required"},
            status=400,
        )

    shipping_cost = calculate_shipping_cost(
        subtotal=subtotal,
        city_code=city_code,
    )

    total = subtotal + shipping_cost

    return JsonResponse(
        {
            "city_code": city_code,
            "subtotal": subtotal,
            "shipping_cost": shipping_cost,
            "total": total,
        }
    )
