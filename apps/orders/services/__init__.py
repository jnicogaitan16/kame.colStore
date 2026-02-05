# apps/orders/services/__init__.py
from __future__ import annotations

import logging
from typing import Dict, Tuple

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from django.apps import apps as django_apps

from apps.customers.models import Customer
from apps.orders.models import Order, OrderItem
from apps.orders.services.shipping import calculate_shipping_cost

logger = logging.getLogger(__name__)


def _get_product_variant_model():
    """Return the ProductVariant model regardless of whether it's in catalog or products.

    This avoids hard-coding the import path and makes the service reusable across app layouts.
    """

    for app_label in ("catalog", "products"):
        try:
            return django_apps.get_model(app_label, "ProductVariant")
        except LookupError:
            continue

    raise ImportError(
        "No se encontró el modelo ProductVariant. Asegúrate de que exista en la app 'catalog' o 'products'."
    )


def confirm_order_payment(order: Order) -> None:
    """
    Confirma el pago de un pedido y descuenta stock exactamente una vez.

    Garantías:
    - Idempotencia: si ya fue procesado (PAID + stock_deducted_at), no descuenta de nuevo.
    - Concurrencia: bloquea el pedido y las variantes involucradas con select_for_update().
    - Atomicidad: todo ocurre dentro de una transacción.

    Errores:
    - Lanza ValidationError para casos de negocio (stock insuficiente, estado inválido, etc.).

    Nota: Esta función actualiza el estado de la instancia `order` pasada como parámetro
    para reflejar los cambios realizados en la base de datos.
    """

    if order.pk is None:
        raise ValidationError("El pedido debe estar guardado antes de confirmar pago.")

    logger.info(f"Iniciando confirmación de pago para orden #{order.id}")

    with transaction.atomic():
        ProductVariant = _get_product_variant_model()
        # 1) Lock del pedido (evita doble procesamiento paralelo)
        locked_order = Order.objects.select_for_update().get(pk=order.pk)

        # 2) Validaciones por estado
        if locked_order.status in (Order.Status.CANCELLED, Order.Status.REFUNDED):
            raise ValidationError("No se puede confirmar pago para un pedido cancelado o reembolsado.")

        # 3) Idempotencia: ya descontado => no repetir
        if locked_order.status == Order.Status.PAID and locked_order.stock_deducted_at is not None:
            logger.info(f"Orden #{order.id} ya está pagada y procesada (idempotencia)")
            # Actualizar la instancia con los valores actuales de la BD
            order.status = locked_order.status
            order.total = locked_order.total
            order.subtotal = locked_order.subtotal
            order.shipping_cost = locked_order.shipping_cost
            order.payment_confirmed_at = locked_order.payment_confirmed_at
            order.stock_deducted_at = locked_order.stock_deducted_at
            return

        # 4) Solo PENDING_PAYMENT/CREATED o un PAID parcialmente procesado pueden proceder
        if locked_order.status not in (Order.Status.PENDING_PAYMENT, Order.Status.CREATED, Order.Status.PAID):
            raise ValidationError(
                "Solo se puede confirmar pago para un pedido en estado PENDING_PAYMENT/CREATED."
            )

        # 5) Consolidar cantidades por variante
        required_by_variant: Dict[int, int] = {}
        items_qs = locked_order.items.select_related("product_variant").all()
        if not items_qs.exists():
            raise ValidationError("El pedido no tiene ítems para procesar.")

        for item in items_qs:
            vid = item.product_variant_id
            required_by_variant[vid] = required_by_variant.get(vid, 0) + item.quantity

        # 6) Lock de variantes + validación stock
        variants_qs = (
            ProductVariant.objects.select_for_update()
            .filter(id__in=required_by_variant.keys(), is_active=True)
            .select_related("product")
        )
        variants_by_id = {v.id: v for v in variants_qs}

        missing = [vid for vid in required_by_variant.keys() if vid not in variants_by_id]
        if missing:
            raise ValidationError("Hay variantes inválidas o inactivas en el pedido.")

        for vid, required_qty in required_by_variant.items():
            variant = variants_by_id[vid]
            if variant.stock < required_qty:
                raise ValidationError(
                    f"Stock insuficiente para {variant}. Disponible: {variant.stock}, requerido: {required_qty}."
                )

        # 7) Descuento real (una sola vez)
        for vid, required_qty in required_by_variant.items():
            variant = variants_by_id[vid]
            variant.stock = variant.stock - required_qty
            variant.save(update_fields=["stock"])

        # 8) Total + estado + marcador idempotencia
        locked_order.recalculate_total()
        locked_order.status = Order.Status.PAID
        locked_order.payment_confirmed_at = timezone.now()
        locked_order.stock_deducted_at = timezone.now()
        locked_order.save(update_fields=["status", "payment_confirmed_at", "stock_deducted_at"])

        # 9) Actualizar la instancia original con los valores de la BD
        order.status = locked_order.status
        order.total = locked_order.total
        order.subtotal = locked_order.subtotal
        order.shipping_cost = locked_order.shipping_cost
        order.payment_confirmed_at = locked_order.payment_confirmed_at
        order.stock_deducted_at = locked_order.stock_deducted_at

        logger.info(
            f"Pago confirmado exitosamente para orden #{order.id}",
            extra={
                "order_id": order.id,
                "total": order.total,
                "items_count": locked_order.items.count(),
            }
        )


def validate_and_prepare_order_item(order_item: OrderItem) -> None:
    """
    Valida y prepara un OrderItem antes de guardarlo.

    Reglas de negocio aplicadas:
    - No permitir modificaciones de items si la orden ya está PAGADA.
    - Si es un item nuevo y no viene precio definido, toma automáticamente
      el precio base del producto asociado a la variante.

    Args:
        order_item: Instancia de OrderItem a validar y preparar.

    Raises:
        ValidationError: Si se intenta modificar un item de una orden pagada.
    """
    # Bloquear edición si la orden ya fue pagada
    if order_item.pk and order_item.order.status == Order.Status.PAID:
        raise ValidationError("No se pueden modificar items de una orden ya pagada.")

    # Autocompletar precio unitario al crear el item
    if order_item._state.adding and (order_item.unit_price is None or order_item.unit_price == 0):
        if order_item.product_variant and order_item.product_variant.product:
            order_item.unit_price = order_item.product_variant.product.price


def validate_cart(cart: dict) -> Tuple[Dict[int, dict], int]:
    """
    Valida el contenido del carrito y calcula el subtotal.

    Args:
        cart: Diccionario con el contenido del carrito desde la sesión.
              Formato: {variant_id: {"qty": int, "unit_price": int}, ...}

    Returns:
        Tupla con:
        - Dict de variantes validadas: {variant_id: {"qty": int, "unit_price": int}}
        - Subtotal calculado (int)

    Raises:
        ValidationError: Si el carrito es inválido, contiene variantes inexistentes,
                        cantidades inválidas o stock insuficiente.
    """
    ProductVariant = _get_product_variant_model()

    if not cart:
        raise ValidationError("El carrito está vacío.")

    # Extraer IDs de variantes del carrito
    try:
        variant_ids = [int(v_id) for v_id in cart.keys()]
    except (TypeError, ValueError):
        raise ValidationError("Carrito inválido: variantes incorrectas.")

    # Obtener variantes de la BD con lock para evitar cambios durante validación
    variants_qs = (
        ProductVariant.objects.select_for_update()
        .filter(id__in=variant_ids)
    )
    variants_by_id = {v.id: v for v in variants_qs}

    # Validar que todas las variantes existan
    missing_ids = [v_id for v_id in variant_ids if v_id not in variants_by_id]
    if missing_ids:
        raise ValidationError(
            f"Algunos productos del carrito ya no existen: {', '.join(map(str, missing_ids))}."
        )

    # Validar cada item del carrito y calcular subtotal
    validated_items = {}
    subtotal = 0

    for variant_id_raw, item in cart.items():
        try:
            variant_id = int(variant_id_raw)
            qty = int(item.get("qty", 0))
            unit_price = int(item.get("unit_price", 0))
        except (TypeError, ValueError):
            raise ValidationError("Carrito inválido: cantidades o precios incorrectos.")

        if qty <= 0:
            raise ValidationError("Carrito inválido: la cantidad debe ser mayor a 0.")

        variant = variants_by_id[variant_id]

        # Validar que la variante esté activa
        if not getattr(variant, "is_active", True):
            raise ValidationError(f"La variante '{variant}' no está disponible.")

        # Validar stock disponible (verificar múltiples campos posibles)
        stock = None
        for field_name in ("stock", "stock_qty", "available_stock"):
            if hasattr(variant, field_name):
                stock_value = getattr(variant, field_name)
                if stock_value is not None:
                    stock = int(stock_value)
                    break

        if stock is not None and qty > stock:
            raise ValidationError(
                f"Stock insuficiente para '{variant}'. Disponible: {stock}, solicitado: {qty}."
            )

        validated_items[variant_id] = {"qty": qty, "unit_price": unit_price}
        subtotal += qty * unit_price

    return validated_items, subtotal


def get_or_create_customer_from_form_data(form_data: dict) -> Customer:
    """
    Obtiene o crea un Customer a partir de los datos del formulario de checkout.

    Maneja conflictos de unicidad (cedula o email duplicados) de forma segura.

    Args:
        form_data: Diccionario con datos del formulario. Debe contener:
                   - cedula (str)
                   - full_name (str)
                   - phone (str)
                   - email (str, opcional)

    Returns:
        Instancia de Customer (existente o creada).

    Raises:
        ValidationError: Si hay un conflicto de unicidad que no se puede resolver.
    """
    from django.db import IntegrityError

    # Parsear full_name en first_name y last_name
    full_name = form_data.get("full_name", "").strip()
    if not full_name:
        # Fallback: usar cedula como first_name si full_name está vacío
        first_name = form_data.get("cedula", "")
        last_name = ""
    else:
        full_name_parts = full_name.split(maxsplit=1)
        first_name = full_name_parts[0]
        last_name = full_name_parts[1] if len(full_name_parts) > 1 else ""

    cedula = form_data.get("cedula", "")
    email = form_data.get("email") or ""
    phone = form_data.get("phone", "")

    try:
        customer, created = Customer.objects.get_or_create(
            cedula=cedula,
            defaults={
                "first_name": first_name,
                "last_name": last_name,
                "phone": phone,
                "email": email,
            },
        )
        return customer
    except IntegrityError as e:
        # Manejar conflictos de unicidad (cedula o email duplicados)
        # Intentar obtener el cliente existente por cedula
        try:
            customer = Customer.objects.get(cedula=cedula)
            # Actualizar información si es necesario (solo campos no críticos)
            if phone and not customer.phone:
                customer.phone = phone
            if email and not customer.email:
                customer.email = email
            if first_name and customer.first_name != first_name:
                # Solo actualizar si el nombre actual está vacío o es muy genérico
                if not customer.first_name or customer.first_name == customer.cedula:
                    customer.first_name = first_name
                    customer.last_name = last_name
            customer.save()
            return customer
        except Customer.DoesNotExist:
            # Si no existe por cedula pero hay IntegrityError, puede ser por email
            if email:
                try:
                    customer = Customer.objects.get(email=email)
                    # Si el email existe pero la cedula es diferente, es un conflicto real
                    if customer.cedula != cedula:
                        raise ValidationError(
                            f"El email '{email}' ya está registrado con otra cédula."
                        )
                    return customer
                except Customer.DoesNotExist:
                    pass

        # Si llegamos aquí, hay un error de integridad que no pudimos resolver
        raise ValidationError(
            "Error al crear o obtener el cliente. Por favor, verifica tus datos."
        ) from e


def create_order_from_cart(
    customer: Customer,
    cart_items: Dict[int, dict],
    form_data: dict,
    subtotal: int,
) -> Order:
    """
    Crea una orden completa con sus items a partir del carrito.

    Args:
        customer: Instancia de Customer.
        cart_items: Diccionario validado de items del carrito.
                    Formato: {variant_id: {"qty": int, "unit_price": int}}
        form_data: Datos del formulario de checkout.
        subtotal: Subtotal calculado del carrito.

    Returns:
        Instancia de Order creada con todos sus OrderItems.
    """
    city_code = form_data.get("city_code", "")
    shipping_cost = calculate_shipping_cost(subtotal=subtotal, city_code=city_code)
    total = subtotal + shipping_cost

    # Crear la orden
    order = Order.objects.create(
        customer=customer,
        status=Order.Status.PENDING_PAYMENT,
        payment_method="transferencia",
        full_name=form_data.get("full_name", ""),
        cedula=form_data.get("cedula", ""),
        phone=form_data.get("phone", ""),
        email=form_data.get("email") or "",
        city_code=city_code,
        address=form_data.get("address", ""),
        notes=form_data.get("notes") or "",
        subtotal=subtotal,
        shipping_cost=shipping_cost,
        total=total,
    )

    # Crear los items de la orden
    for variant_id, item in cart_items.items():
        OrderItem.objects.create(
            order=order,
            product_variant_id=variant_id,
            quantity=item["qty"],
            unit_price=item["unit_price"],
        )

    return order
