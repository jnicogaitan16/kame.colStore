from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.db import transaction
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from urllib.parse import quote
from apps.notifications.email_context import build_payment_confirmed_context
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)
def send_order_paid_email(order) -> None:
    """Envía el correo de "Pago confirmado" (HTML + TXT) de forma compatible.

    Nota: esta función se dispara desde la acción del admin y debe ser idempotente
    a nivel de llamada (la idempotencia real se controla con `is_first_confirmation`).
    """

    recipient = (getattr(order, "email", "") or "").strip()
    if not recipient:
        return

    # Contexto limpio para templates (sin lógica rara en el HTML)
    ctx = build_payment_confirmed_context(order)

    support_digits = str(ctx.get("support_whatsapp") or "").strip()
    support_digits = "".join([c for c in support_digits if c.isdigit()])

    # URLs opcionales para CTA
    order_url = ctx.get("order_public_url")
    whatsapp_url = None
    if support_digits:
        wa_message = f"Hola 👋 Mi pedido es #{order.pk}. ¿Me ayudas por favor?"
        whatsapp_url = f"https://wa.me/{support_digits}?text={quote(wa_message)}"

    template_ctx = {
        **ctx,
        "order_url": order_url,
        "whatsapp_url": whatsapp_url,
    }

    subject = f"Pago confirmado - Pedido #{order.pk}"
    # From/Reply-To robustos (evita None y mejora entregabilidad)
    from_email = (
        (getattr(settings, "DEFAULT_FROM_EMAIL", "") or "").strip()
        or (getattr(settings, "SERVER_EMAIL", "") or "").strip()
        or "no-reply@kame.col"
    )

    # Render TXT (obligatorio). Si falla, abortamos.
    try:
        text_body = render_to_string("emails/orders/paid.txt", template_ctx)
    except Exception:
        logger.exception(
            "[email] Failed to render paid TXT template for order_id=%s",
            getattr(order, "pk", None),
        )
        raise

    # Render HTML (opcional). Si falla, igual enviamos TXT.
    html_body = None
    try:
        html_body = render_to_string("emails/orders/paid.html", template_ctx)
    except Exception:
        logger.exception(
            "[email] Failed to render paid HTML template for order_id=%s (sending TXT only)",
            getattr(order, "pk", None),
        )
        html_body = None

    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=from_email,
        to=[recipient],
        reply_to=[from_email],
        headers={
            "X-Kame-Order-Id": str(getattr(order, "pk", "")),
        },
    )
    if html_body:
        msg.attach_alternative(html_body, "text/html")
    if not (text_body or "").strip():
        logger.error(
            "[email] Empty paid TXT body for order_id=%s; aborting send",
            getattr(order, "pk", None),
        )
        return

    msg.send(fail_silently=False)

from django import forms
from apps.orders.constants import CITY_CHOICES
from apps.orders.services.stock import sellable_variants_queryset

from .models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    """Inline para ítems del pedido.

    Mejora: filtra las variantes disponibles para evitar seleccionar variantes sin stock
    (stock <= 0) y así prevenir errores al confirmar el pago.
    """

    model = OrderItem
    extra = 1
    autocomplete_fields = ("product_variant",)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        # Filtra el selector/autocomplete de product_variant para mostrar solo variantes vendibles.
        if db_field.name == "product_variant":
            kwargs["queryset"] = sellable_variants_queryset()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


# Custom ModelForm for OrderAdmin to control city_code choices
class OrderAdminForm(forms.ModelForm):
    city_code = forms.ChoiceField(
        choices=[("", "---------")] + CITY_CHOICES,
        required=False,
        label="City",
    )

    class Meta:
        model = Order
        fields = "__all__"


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    form = OrderAdminForm
    list_display = (
        "id",
        "full_name",
        "email",
        "phone",
        "document_type",
        "cedula",
        "status",
        "total",
        "created_at",
    )
    autocomplete_fields = ("customer",)
    list_filter = ("status", "created_at")
    search_fields = (
        "full_name",
        "email",
        "phone",
        "cedula",
        "document_type",
        "payment_reference",
    )
    readonly_fields = (
        "status",
        "total",
        "stock_deducted_at",
        "created_at",
        # Snapshot (histórico)
        "full_name",
        "email",
        "phone",
        "document_type",
        "cedula",
        "city_code",
        "address",
        "notes",
    )
    inlines = (OrderItemInline,)
    actions = ("confirm_payment_action",)

    @admin.action(description="Confirmar pago y descontar stock")
    def confirm_payment_action(self, request, queryset):
        ok = 0
        failed = 0

        for order in queryset:
            try:
                prev_deducted_at = order.stock_deducted_at

                order.confirm_payment()
                order.refresh_from_db(fields=["status", "stock_deducted_at", "email", "full_name"])

                is_first_confirmation = (
                    prev_deducted_at is None
                    and order.stock_deducted_at is not None
                    and order.status == "paid"
                )

                if is_first_confirmation:
                    # Asegura payment_reference persistida (idempotente) para el correo.
                    # Solo setea si viene vacía.
                    if not (getattr(order, "payment_reference", "") or "").strip():
                        order.payment_reference = (
                            f"KME-{timezone.localdate().strftime('%Y%m%d')}-{order.id}"
                        )
                        order.save(update_fields=["payment_reference"])
                        logger.info(
                            "[admin] payment_reference generated for order_id=%s: %s",
                            getattr(order, "pk", None),
                            order.payment_reference,
                        )

                    # Email: DEPRECADO en Admin.
                    # El correo "Pago confirmado" se dispara únicamente desde el service layer
                    # (apps.orders.services.payments.confirm_order_payment) para evitar dobles envíos.
                    self.message_user(
                        request,
                        f"Pedido #{order.pk}: ✅ Pago confirmado.",
                        level=messages.SUCCESS,
                    )

                ok += 1
            except ValidationError as e:
                failed += 1
                messages.error(request, f"Pedido #{order.pk}: {e}")
            except Exception as e:
                failed += 1
                messages.error(request, f"Pedido #{order.pk}: error inesperado: {e}")

        if ok:
            messages.success(request, f"Pagos confirmados: {ok}")
        if failed and not ok:
            messages.warning(request, f"No se pudo confirmar pago en {failed} pedido(s).")

    def save_model(self, request, obj, form, change):
        """Guarda la orden y aplica reglas de negocio desde el Admin.

        - Autorellena snapshot (full_name, phone, email, cedula) desde Customer solo si vienen vacíos.
        - Detecta transición real a estado "paid" para confirmar pago y descontar stock (idempotente).
        - Si falla (p. ej. stock insuficiente), NO rompe el admin: muestra mensaje y revierte status.
        """
        # Estado previo (solo si es edición)
        previous_status = None
        if change and obj.pk:
            previous_status = (
                Order.objects.filter(pk=obj.pk)
                .values_list("status", flat=True)
                .first()
            )

        # Autorellenar snapshot desde el customer (también aplica en Add)
        if getattr(obj, "customer_id", None):
            customer = obj.customer

            if not (getattr(obj, "full_name", "") or "").strip():
                first = getattr(customer, "first_name", "") or ""
                last = getattr(customer, "last_name", "") or ""
                full = f"{first} {last}".strip()
                # Fallback: si tu Customer usa un solo campo 'name'
                if not full:
                    full = (getattr(customer, "name", "") or "").strip()
                obj.full_name = full

            if not (getattr(obj, "phone", "") or "").strip():
                obj.phone = (getattr(customer, "phone", "") or "").strip()

            if not (getattr(obj, "email", "") or "").strip():
                obj.email = (getattr(customer, "email", "") or "").strip()

            if not (getattr(obj, "cedula", "") or "").strip():
                obj.cedula = (getattr(customer, "cedula", "") or "").strip()

        # Persistir cambios del formulario
        super().save_model(request, obj, form, change)

        # Guardar estado previo para usarlo en save_related (cuando los inlines ya están guardados)
        obj._admin_previous_status = previous_status

    def save_related(self, request, form, formsets, change):
        """Confirma pago DESPUÉS de guardar inlines.

        En el admin, los inlines (OrderItem) se guardan en save_related().
        Si confirmamos pago en save_model(), confirm_payment() puede validar/deducir
        usando ítems antiguos o incompletos.
        """
        super().save_related(request, form, formsets, change)

        # Deprecado: La confirmación de pago se hace SOLO por la acción del admin (confirm_payment_action).
        # Evitamos confirmación “silenciosa” por edición manual del status.
        return

    class Media:
        js = ("orders/js/order_admin_shipping.js",)


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ("order", "product_variant", "quantity", "unit_price", "created_at")
    autocomplete_fields = ("order", "product_variant")
    search_fields = (
        "order__id",
        "product_variant__product__name",
    )

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "product_variant":
            kwargs["queryset"] = sellable_variants_queryset()
        return super().formfield_for_foreignkey(db_field, request, **kwargs)