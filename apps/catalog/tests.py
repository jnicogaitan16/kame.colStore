from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from apps.catalog.serializers import _effective_inventory_from_pool


def _variant(value, color, is_active=True):
    category = SimpleNamespace(variant_schema="size_color")
    product = SimpleNamespace(category=category)
    return SimpleNamespace(value=value, color=color, is_active=is_active, product=product)


class EffectiveInventoryFromPoolTests(SimpleTestCase):
    @patch("apps.catalog.serializers.get_variant_available_stock")
    @patch("apps.catalog.serializers.get_pool_map", return_value={})
    def test_incomplete_size_color_row_does_not_keep_product_in_stock(
        self, _pool_map, mock_stock
    ):
        def available(variant, pool_map=None):
            if variant.value == "" and variant.color == "Azul":
                return 6
            return 0

        mock_stock.side_effect = available

        variants = [
            _variant("S", "Azul"),
            _variant("M", "Blanco"),
            _variant("L", "Azul"),
            _variant("", "Azul"),
        ]

        stock_total, sold_out, _ = _effective_inventory_from_pool(6, variants)

        self.assertEqual(stock_total, 0)
        self.assertTrue(sold_out)

    @patch("apps.catalog.serializers.get_variant_available_stock")
    @patch("apps.catalog.serializers.get_pool_map", return_value={})
    def test_complete_size_color_row_uses_pool_quantity(self, _pool_map, mock_stock):
        def available(variant, pool_map=None):
            if variant.value == "S" and variant.color == "Blanco":
                return 4
            return 0

        mock_stock.side_effect = available

        variants = [
            _variant("S", "Blanco"),
            _variant("", "Azul"),
        ]

        stock_total, sold_out, _ = _effective_inventory_from_pool(6, variants)

        self.assertEqual(stock_total, 4)
        self.assertFalse(sold_out)
