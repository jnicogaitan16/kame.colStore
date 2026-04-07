"""
QA tests — Flujo de pago Wompi + integridad de inventario.

Casos cubiertos:
  1. payment_reference tiene formato KAME-{order_id}-{random} y es única
  2. El inventario NO se descuenta en checkout (solo al confirmar pago)
  3. El inventario SÍ se descuenta al confirmar pago (confirm_order_payment)
  4. confirm_order_payment es idempotente (no doble descuento)
  5. El webhook APPROVED es idempotente (no doble descuento si se repite)
"""
from __future__ import annotations

import re

from django.test import TestCase
from unittest.mock import patch, MagicMock

from apps.catalog.models import (
    Category,
    Department,
    InventoryPool,
    Product,
    ProductVariant,
)
from apps.customers.models import Customer
from apps.orders.models import Order, OrderItem
from apps.orders.services.payments import generate_payment_reference, confirm_order_payment


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_customer(**kwargs) -> Customer:
    defaults = dict(
        document_type="CC",
        cedula="12345678",
        first_name="Test",
        last_name="User",
        email="test@example.com",
        phone="3001234567",
    )
    defaults.update(kwargs)
    return Customer.objects.create(**defaults)


def _make_category(name="Camisetas") -> Category:
    dept, _ = Department.objects.get_or_create(name="Ropa", defaults={"slug": "ropa"})
    cat, _ = Category.objects.get_or_create(
        slug=f"cat-{name.lower()}",
        defaults={"name": name, "department": dept},
    )
    return cat


def _make_product(category: Category, name="Camiseta Test", price=50_000) -> Product:
    product, _ = Product.objects.get_or_create(
        slug=f"prod-{name.lower().replace(' ', '-')}",
        defaults={"name": name, "price": price, "category": category},
    )
    return product


def _make_variant(product: Product, size="M", color="Negro") -> ProductVariant:
    variant, _ = ProductVariant.objects.get_or_create(
        product=product,
        size=size,
        color=color,
        defaults={"is_active": True},
    )
    return variant


def _make_inventory(category: Category, size="M", color="Negro", quantity=10) -> InventoryPool:
    pool, _ = InventoryPool.objects.get_or_create(
        category=category,
        value=size,
        color=color,
        defaults={"quantity": quantity},
    )
    pool.quantity = quantity
    pool.save(update_fields=["quantity"])
    return pool


def _make_pending_order(customer: Customer, variant: ProductVariant, qty: int = 1, unit_price: int = 50_000) -> Order:
    """Crea una orden PENDING_PAYMENT con su referencia y un item."""
    order = Order.objects.create(
        customer=customer,
        status=Order.Status.PENDING_PAYMENT,
        payment_method="wompi",
        payment_reference=None,
        full_name="Test User",
        cedula="12345678",
        document_type="CC",
        phone="3001234567",
        email="test@example.com",
        city_code="BOG",
        address="Calle 1 #2-3",
        subtotal=unit_price * qty,
        shipping_cost=0,
        total=unit_price * qty,
    )
    # Dos pasos: asignar referencia con order.id ya conocido
    order.payment_reference = generate_payment_reference(order.id)
    order.save(update_fields=["payment_reference"])

    OrderItem.objects.create(
        order=order,
        product_variant=variant,
        quantity=qty,
        unit_price=unit_price,
    )
    return order


# ─────────────────────────────────────────────────────────────────────────────
# TC-1: Formato y unicidad de payment_reference
# ─────────────────────────────────────────────────────────────────────────────

class PaymentReferenceFormatTest(TestCase):
    """TC-1: La referencia tiene formato KAME-{order_id}-{XXXXXX} y es única."""

    def setUp(self):
        self.customer = _make_customer()
        self.category = _make_category()
        self.product = _make_product(self.category)
        self.variant = _make_variant(self.product)
        _make_inventory(self.category, quantity=20)

    def test_reference_format(self):
        order = _make_pending_order(self.customer, self.variant)
        ref = order.payment_reference
        self.assertRegex(ref, rf"^KAME-{order.id}-[A-Z2-7]{{6}}$")

    def test_reference_uniqueness_across_orders(self):
        # Crear varios pedidos con customers distintos para evitar UNIQUE en cedula
        refs = set()
        for i in range(5):
            c = _make_customer(cedula=f"1000000{i}", email=f"user{i}@example.com")
            order = _make_pending_order(c, self.variant)
            refs.add(order.payment_reference)
        self.assertEqual(len(refs), 5, "Cada referencia debe ser única")

    def test_reference_contains_order_id(self):
        order = _make_pending_order(self.customer, self.variant)
        self.assertIn(f"KAME-{order.id}-", order.payment_reference)

    def test_generate_reference_is_unique_db_check(self):
        """generate_payment_reference no debe devolver una referencia ya usada."""
        customer2 = _make_customer(cedula="99999999", email="other@example.com")
        order1 = _make_pending_order(self.customer, self.variant)
        order2 = _make_pending_order(customer2, self.variant)
        self.assertNotEqual(order1.payment_reference, order2.payment_reference)


# ─────────────────────────────────────────────────────────────────────────────
# TC-2: Inventario NO se descuenta en checkout
# ─────────────────────────────────────────────────────────────────────────────

class InventoryNotDecrementedAtCheckoutTest(TestCase):
    """TC-2: El checkout crea una orden PENDING_PAYMENT sin tocar InventoryPool."""

    def setUp(self):
        self.customer = _make_customer()
        self.category = _make_category()
        self.product = _make_product(self.category)
        self.variant = _make_variant(self.product)
        self.pool = _make_inventory(self.category, quantity=10)

    def test_stock_not_decremented_after_checkout(self):
        initial_qty = self.pool.quantity
        order = _make_pending_order(self.customer, self.variant, qty=2)

        self.pool.refresh_from_db()
        self.assertEqual(
            self.pool.quantity,
            initial_qty,
            "El inventario NO debe modificarse al crear la orden.",
        )
        self.assertEqual(order.status, Order.Status.PENDING_PAYMENT)
        self.assertIsNone(order.stock_deducted_at)

    def test_order_created_status_is_pending_payment(self):
        order = _make_pending_order(self.customer, self.variant)
        self.assertEqual(order.status, Order.Status.PENDING_PAYMENT)


# ─────────────────────────────────────────────────────────────────────────────
# TC-3: Inventario SÍ se descuenta al confirmar pago
# ─────────────────────────────────────────────────────────────────────────────

class InventoryDecrementedOnPaymentConfirmTest(TestCase):
    """TC-3: confirm_order_payment() descuenta stock de InventoryPool."""

    def setUp(self):
        self.customer = _make_customer()
        self.category = _make_category()
        self.product = _make_product(self.category)
        self.variant = _make_variant(self.product)
        self.pool = _make_inventory(self.category, quantity=10)

    def test_stock_decremented_after_confirm_payment(self):
        order = _make_pending_order(self.customer, self.variant, qty=3)
        initial_qty = self.pool.quantity

        with patch("apps.notifications.emails.send_payment_confirmed_email"):
            confirm_order_payment(order)

        self.pool.refresh_from_db()
        self.assertEqual(
            self.pool.quantity,
            initial_qty - 3,
            "El inventario debe decrementarse en la cantidad pedida.",
        )

    def test_order_status_is_paid_after_confirm(self):
        order = _make_pending_order(self.customer, self.variant, qty=1)

        with patch("apps.notifications.emails.send_payment_confirmed_email"):
            confirm_order_payment(order)

        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PAID)
        self.assertIsNotNone(order.stock_deducted_at)
        self.assertIsNotNone(order.payment_confirmed_at)


# ─────────────────────────────────────────────────────────────────────────────
# TC-4: confirm_order_payment es idempotente (no doble descuento)
# ─────────────────────────────────────────────────────────────────────────────

class IdempotentPaymentConfirmTest(TestCase):
    """TC-4: Llamar confirm_order_payment() dos veces no descuenta stock dos veces."""

    def setUp(self):
        self.customer = _make_customer()
        self.category = _make_category()
        self.product = _make_product(self.category)
        self.variant = _make_variant(self.product)
        self.pool = _make_inventory(self.category, quantity=10)

    def test_no_double_decrement_on_double_confirm(self):
        order = _make_pending_order(self.customer, self.variant, qty=2)
        initial_qty = self.pool.quantity

        with patch("apps.notifications.emails.send_payment_confirmed_email"):
            confirm_order_payment(order)
            # Segunda llamada — idempotente
            confirm_order_payment(order)

        self.pool.refresh_from_db()
        self.assertEqual(
            self.pool.quantity,
            initial_qty - 2,
            "El stock solo debe decrementarse una vez, aunque se llame dos veces.",
        )

    def test_stock_deducted_at_set_only_once(self):
        order = _make_pending_order(self.customer, self.variant, qty=1)

        with patch("apps.notifications.emails.send_payment_confirmed_email"):
            confirm_order_payment(order)

        order.refresh_from_db()
        first_deducted_at = order.stock_deducted_at
        self.assertIsNotNone(first_deducted_at)

        with patch("apps.notifications.emails.send_payment_confirmed_email"):
            confirm_order_payment(order)

        order.refresh_from_db()
        self.assertEqual(
            order.stock_deducted_at,
            first_deducted_at,
            "stock_deducted_at no debe cambiar en la segunda llamada.",
        )


# ─────────────────────────────────────────────────────────────────────────────
# TC-5: Webhook APPROVED idempotente
# ─────────────────────────────────────────────────────────────────────────────

class WompiWebhookIdempotencyTest(TestCase):
    """TC-5: El webhook de Wompi no descuenta stock dos veces si llega duplicado."""

    def setUp(self):
        self.customer = _make_customer()
        self.category = _make_category()
        self.product = _make_product(self.category)
        self.variant = _make_variant(self.product)
        self.pool = _make_inventory(self.category, quantity=10)

    def _build_webhook_payload(self, reference: str, transaction_id: str = "txn-abc123") -> dict:
        return {
            "event": "transaction.updated",
            "data": {
                "transaction": {
                    "id": transaction_id,
                    "reference": reference,
                    "status": "APPROVED",
                    "amount_in_cents": 5000000,
                    "currency": "COP",
                }
            },
            "signature": {
                "properties": ["data.transaction.id", "data.transaction.status", "data.transaction.amount_in_cents"],
                "checksum": "placeholder",
            },
            "timestamp": 1700000000,
        }

    def test_duplicate_webhook_does_not_double_decrement(self):
        from django.test import Client
        import json

        order = _make_pending_order(self.customer, self.variant, qty=2)
        initial_qty = self.pool.quantity

        payload = self._build_webhook_payload(order.payment_reference, "txn-dup-001")

        # Patch signature validation and email so they don't fail
        with (
            patch("apps.orders.services.wompi.validate_webhook_signature", return_value=True),
            patch("apps.notifications.emails.send_payment_confirmed_email"),
        ):
            client = Client()
            # First webhook
            resp1 = client.post(
                "/api/wompi-webhook/",
                data=json.dumps(payload),
                content_type="application/json",
                HTTP_X_WOMPI_EVENT="transaction.updated",
            )
            # Second identical webhook (duplicate delivery)
            resp2 = client.post(
                "/api/wompi-webhook/",
                data=json.dumps(payload),
                content_type="application/json",
                HTTP_X_WOMPI_EVENT="transaction.updated",
            )

        self.pool.refresh_from_db()
        self.assertEqual(
            self.pool.quantity,
            initial_qty - 2,
            "El stock solo debe decrementarse una vez aunque el webhook llegue dos veces.",
        )
        # Both requests should succeed (200 is the idempotent response for duplicates)
        self.assertIn(resp1.status_code, [200, 201])
        self.assertIn(resp2.status_code, [200, 201])
