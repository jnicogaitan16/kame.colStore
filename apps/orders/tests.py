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


class ApiHealthViewTests(TestCase):
    """GET /api/health/ — comprobar túnel (ngrok) y probes."""

    def test_returns_ok_json(self):
        r = self.client.get("/api/health/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"status": "ok"})


# ─────────────────────────────────────────────────────────────────────────────
# TC-6: Shipping cost calculation
# ─────────────────────────────────────────────────────────────────────────────

class ShippingCostTest(TestCase):
    """TC-6: calculate_shipping_cost edge cases."""

    def test_free_shipping_at_threshold(self):
        from apps.orders.services.shipping import calculate_shipping_cost
        self.assertEqual(calculate_shipping_cost(170_000, "BOGOTA_DC"), 0)

    def test_free_shipping_above_threshold(self):
        from apps.orders.services.shipping import calculate_shipping_cost
        self.assertEqual(calculate_shipping_cost(200_000, "MEDELLIN"), 0)

    def test_bogota_rate_below_threshold(self):
        from apps.orders.services.shipping import calculate_shipping_cost
        self.assertEqual(calculate_shipping_cost(50_000, "BOGOTA_DC"), 11_900)

    def test_national_rate(self):
        from apps.orders.services.shipping import calculate_shipping_cost
        self.assertEqual(calculate_shipping_cost(50_000, "CALI"), 19_900)

    def test_threshold_boundary_minus_one(self):
        from apps.orders.services.shipping import calculate_shipping_cost
        self.assertEqual(calculate_shipping_cost(169_999, "BOGOTA_DC"), 11_900)

    def test_unknown_city_defaults_to_national(self):
        from apps.orders.services.shipping import calculate_shipping_cost
        self.assertEqual(calculate_shipping_cost(50_000, "UNKNOWN"), 19_900)

    def test_empty_city_defaults_to_national(self):
        from apps.orders.services.shipping import calculate_shipping_cost
        self.assertEqual(calculate_shipping_cost(50_000, ""), 19_900)


# ─────────────────────────────────────────────────────────────────────────────
# TC-7: Wompi service functions
# ─────────────────────────────────────────────────────────────────────────────

class WompiIntegritySignatureTest(TestCase):
    """TC-7a: generate_integrity_signature determinism and format."""

    @patch("apps.orders.services.wompi.settings")
    def test_deterministic_output(self, mock_settings):
        from apps.orders.services.wompi import generate_integrity_signature
        mock_settings.WOMPI_INTEGRITY_SECRET = "test-integrity-secret"
        sig1 = generate_integrity_signature("KAME-1-ABC", 10000)
        sig2 = generate_integrity_signature("KAME-1-ABC", 10000)
        self.assertEqual(sig1, sig2)
        self.assertEqual(len(sig1), 64)  # SHA256 hex

    @patch("apps.orders.services.wompi.settings")
    def test_different_references_produce_different_signatures(self, mock_settings):
        from apps.orders.services.wompi import generate_integrity_signature
        mock_settings.WOMPI_INTEGRITY_SECRET = "test-integrity-secret"
        sig1 = generate_integrity_signature("KAME-1-ABC", 10000)
        sig2 = generate_integrity_signature("KAME-2-XYZ", 10000)
        self.assertNotEqual(sig1, sig2)


class WompiWebhookSignatureValidationTest(TestCase):
    """TC-7b: validate_webhook_signature security checks."""

    def _build_valid_payload(self, secret="test-events-secret", timestamp=1234567890):
        """Build a valid webhook payload with matching checksum."""
        import hashlib
        transaction = {"id": "txn-123", "status": "APPROVED", "reference": "KAME-1-ABC"}
        properties = ["transaction.id", "transaction.status"]
        parts = [str(transaction["id"]), str(transaction["status"]),
                 str(timestamp), secret]
        checksum = hashlib.sha256("".join(parts).encode()).hexdigest()
        event_data = {"data": {"transaction": transaction}}
        return event_data, properties, checksum, timestamp

    @patch("apps.orders.services.wompi.settings")
    def test_valid_signature_passes(self, mock_settings):
        from apps.orders.services.wompi import validate_webhook_signature
        mock_settings.WOMPI_EVENTS_SECRET = "test-events-secret"
        event_data, props, checksum, ts = self._build_valid_payload()
        self.assertTrue(validate_webhook_signature(event_data, props, checksum, ts))

    @patch("apps.orders.services.wompi.settings")
    def test_invalid_checksum_fails(self, mock_settings):
        from apps.orders.services.wompi import validate_webhook_signature
        mock_settings.WOMPI_EVENTS_SECRET = "test-events-secret"
        event_data, props, _, ts = self._build_valid_payload()
        self.assertFalse(validate_webhook_signature(event_data, props, "bad-checksum", ts))

    @patch("apps.orders.services.wompi.settings")
    def test_wrong_timestamp_fails(self, mock_settings):
        from apps.orders.services.wompi import validate_webhook_signature
        mock_settings.WOMPI_EVENTS_SECRET = "test-events-secret"
        event_data, props, checksum, _ = self._build_valid_payload()
        self.assertFalse(validate_webhook_signature(event_data, props, checksum, 9999999))

    @patch("apps.orders.services.wompi.settings")
    def test_missing_secret_returns_false(self, mock_settings):
        from apps.orders.services.wompi import validate_webhook_signature
        mock_settings.WOMPI_EVENTS_SECRET = ""
        event_data, props, checksum, ts = self._build_valid_payload()
        self.assertFalse(validate_webhook_signature(event_data, props, checksum, ts))

    @patch("apps.orders.services.wompi.settings")
    def test_missing_transaction_data(self, mock_settings):
        from apps.orders.services.wompi import validate_webhook_signature
        mock_settings.WOMPI_EVENTS_SECRET = "test-events-secret"
        self.assertFalse(validate_webhook_signature({}, ["transaction.id"], "bad", 123))


class WompiCentsConversionTest(TestCase):
    """TC-7c: cop_to_wompi_cents conversion."""

    def test_basic_conversion(self):
        from apps.orders.services.wompi import cop_to_wompi_cents
        self.assertEqual(cop_to_wompi_cents(1), 100)
        self.assertEqual(cop_to_wompi_cents(50_000), 5_000_000)

    def test_zero(self):
        from apps.orders.services.wompi import cop_to_wompi_cents
        self.assertEqual(cop_to_wompi_cents(0), 0)


# ─────────────────────────────────────────────────────────────────────────────
# TC-8: Order._recalc_totals_in_memory
# ─────────────────────────────────────────────────────────────────────────────

class OrderRecalcTotalsTest(TestCase):
    """TC-8: _recalc_totals_in_memory edge cases."""

    def setUp(self):
        dept, _ = Department.objects.get_or_create(name="Test Dept", slug="test-dept")
        cat = _make_category("recalc-cat")
        prod = _make_product(cat, "Recalc Product", 50000)
        variant = _make_variant(prod, "M", "Negro")
        _make_inventory(cat, "M", "Negro", 10)
        customer = _make_customer(email="recalc@test.com")
        self.order = _make_pending_order(customer, variant, qty=2, unit_price=50000)

    def test_recalc_with_priced_items(self):
        """Subtotal recalculated from items; total = subtotal + shipping."""
        self.order.shipping_cost = 12000
        self.order._recalc_totals_in_memory()
        self.assertEqual(self.order.subtotal, 100000)  # 2 × 50,000
        self.assertEqual(self.order.total, 112000)  # 100,000 + 12,000

    def test_recalc_zero_shipping(self):
        """Total equals subtotal when shipping is zero."""
        self.order.shipping_cost = 0
        self.order._recalc_totals_in_memory()
        self.assertEqual(self.order.total, self.order.subtotal)

    def test_recalc_preserves_subtotal_when_no_priced_items(self):
        """Subtotal preserved if all items have unit_price=None."""
        self.order.subtotal = 99999
        for item in self.order.items.all():
            item.unit_price = None
            item.save()
        self.order._recalc_totals_in_memory()
        self.assertEqual(self.order.subtotal, 99999, "Must preserve manual subtotal")

    def test_total_always_recalculated(self):
        """Total is always subtotal + shipping, even if subtotal unchanged."""
        self.order.subtotal = 80000
        self.order.shipping_cost = 15000
        for item in self.order.items.all():
            item.unit_price = None
            item.save()
        self.order._recalc_totals_in_memory()
        self.assertEqual(self.order.total, 95000)  # 80,000 + 15,000


# ─────────────────────────────────────────────────────────────────────────────
# TC-9: Discount rules
# ─────────────────────────────────────────────────────────────────────────────

from django.utils import timezone
from datetime import timedelta
from apps.catalog.models import DiscountRule
from apps.catalog.services.discount import get_active_discount, apply_discount, get_product_discount_info


class DiscountRulePriorityTest(TestCase):
    """TC-9a: Scope priority — PRODUCT > CATEGORY > DEPARTMENT > STORE_WIDE."""

    def setUp(self):
        self.cat = _make_category("Discount Cat")
        self.dept = self.cat.department
        self.product = _make_product(self.cat, "Discount Product", 100_000)
        now = timezone.now()
        self.base = {"starts_at": now - timedelta(hours=1), "is_active": True}

    def test_store_wide_applies_when_only_rule(self):
        DiscountRule.objects.create(
            name="Store 5%", discount_value=5, scope="store_wide", **self.base
        )
        rule = get_active_discount(self.product)
        self.assertIsNotNone(rule)
        self.assertEqual(rule.scope, "store_wide")

    def test_category_beats_store_wide(self):
        DiscountRule.objects.create(
            name="Store 5%", discount_value=5, scope="store_wide", **self.base
        )
        DiscountRule.objects.create(
            name="Cat 10%", discount_value=10, scope="category",
            category=self.cat, **self.base
        )
        rule = get_active_discount(self.product)
        self.assertEqual(rule.scope, "category")

    def test_product_beats_all(self):
        DiscountRule.objects.create(
            name="Store 5%", discount_value=5, scope="store_wide", **self.base
        )
        DiscountRule.objects.create(
            name="Cat 10%", discount_value=10, scope="category",
            category=self.cat, **self.base
        )
        DiscountRule.objects.create(
            name="Prod 20%", discount_value=20, scope="product",
            product=self.product, **self.base
        )
        rule = get_active_discount(self.product)
        self.assertEqual(rule.scope, "product")
        self.assertEqual(rule.discount_value, 20)


class DiscountRuleDateRangeTest(TestCase):
    """TC-9b: Discount only applies within starts_at / ends_at."""

    def setUp(self):
        self.cat = _make_category("Date Cat")
        self.product = _make_product(self.cat, "Date Product", 80_000)

    def test_future_discount_not_active(self):
        DiscountRule.objects.create(
            name="Future",
            discount_value=10,
            scope="store_wide",
            starts_at=timezone.now() + timedelta(days=1),
            is_active=True,
        )
        self.assertIsNone(get_active_discount(self.product))

    def test_expired_discount_not_active(self):
        DiscountRule.objects.create(
            name="Expired",
            discount_value=10,
            scope="store_wide",
            starts_at=timezone.now() - timedelta(days=2),
            ends_at=timezone.now() - timedelta(days=1),
            is_active=True,
        )
        self.assertIsNone(get_active_discount(self.product))

    def test_inactive_rule_not_applied(self):
        DiscountRule.objects.create(
            name="Inactive",
            discount_value=10,
            scope="store_wide",
            starts_at=timezone.now() - timedelta(hours=1),
            is_active=False,
        )
        self.assertIsNone(get_active_discount(self.product))


class DiscountCalculationTest(TestCase):
    """TC-9c: Percentage and fixed amount calculations."""

    def setUp(self):
        self.cat = _make_category("Calc Cat")
        self.product = _make_product(self.cat, "Calc Product", 100_000)
        self.now = timezone.now()

    def test_percentage_discount(self):
        rule = DiscountRule.objects.create(
            name="15% off", discount_type="percentage", discount_value=15,
            scope="store_wide", starts_at=self.now - timedelta(hours=1), is_active=True,
        )
        applied = apply_discount(self.product.price, rule)
        self.assertEqual(applied.discount_price, 85_000)
        self.assertEqual(applied.discount_percentage, 15)
        self.assertEqual(applied.discount_amount, 15_000)

    def test_fixed_amount_discount(self):
        rule = DiscountRule.objects.create(
            name="10k off", discount_type="fixed_amount", discount_value=10_000,
            scope="store_wide", starts_at=self.now - timedelta(hours=1), is_active=True,
        )
        applied = apply_discount(self.product.price, rule)
        self.assertEqual(applied.discount_price, 90_000)
        self.assertEqual(applied.discount_amount, 10_000)

    def test_no_discount_returns_none(self):
        info = get_product_discount_info(self.product)
        self.assertIsNone(info)

    def test_discount_info_structure(self):
        DiscountRule.objects.create(
            name="5%", discount_value=5, scope="store_wide",
            starts_at=self.now - timedelta(hours=1), is_active=True,
        )
        info = get_product_discount_info(self.product)
        self.assertIsNotNone(info)
        self.assertTrue(info["has_discount"])
        self.assertEqual(info["compare_at_price"], 100_000)
        self.assertEqual(info["discount_price"], 95_000)
        self.assertEqual(info["discount_percentage"], 5)
        self.assertEqual(info["discount_label"], "-5%")
