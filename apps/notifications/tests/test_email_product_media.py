from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from apps.notifications.email_product_media import (
    _resolve_email_image_url,
    is_email_unsafe_url,
)


class EmailUnsafeUrlTests(SimpleTestCase):
    def test_webp_is_unsafe(self):
        self.assertTrue(is_email_unsafe_url("https://cdn.example/CACHE/x.webp"))
        self.assertTrue(is_email_unsafe_url("/media/foo.WEBP"))

    def test_jpeg_is_safe(self):
        self.assertFalse(is_email_unsafe_url("https://cdn.example/CACHE/x.jpg"))
        self.assertFalse(is_email_unsafe_url("https://cdn.example/CACHE/x.jpeg"))


class ResolveEmailImageUrlTests(SimpleTestCase):
    @patch("apps.notifications.email_product_media.public_media_url")
    def test_prefers_existing_original_over_missing_email_spec(self, mock_public):
        mock_public.side_effect = lambda value, request=None: f"https://cdn.test/{value}"

        original = SimpleNamespace(
            name="products/p1/original.png",
            storage=SimpleNamespace(exists=lambda _n: True),
            url="/media/products/p1/original.png",
        )
        record = SimpleNamespace(
            image_email=SimpleNamespace(url="/CACHE/email-missing.jpg"),
            image=original,
            image_thumb=SimpleNamespace(url="/CACHE/thumb.webp"),
            image_medium=None,
            image_url=None,
        )

        with patch(
            "apps.notifications.email_product_media._resolve_imagespec_url",
            return_value=None,
        ):
            url = _resolve_email_image_url(record)

        self.assertEqual(url, "https://cdn.test//media/products/p1/original.png")

    @patch("apps.notifications.email_product_media.public_media_url")
    def test_uses_image_email_when_original_missing(self, mock_public):
        mock_public.side_effect = lambda value, request=None: f"https://cdn.test/{value}"

        record = SimpleNamespace(
            image=SimpleNamespace(
                name="",
                storage=SimpleNamespace(exists=lambda _n: False),
                url="",
            ),
            image_email=SimpleNamespace(url="/CACHE/email/product.jpg"),
            image_thumb=None,
            image_medium=None,
            image_url=None,
        )

        with patch(
            "apps.notifications.email_product_media._resolve_imagespec_url",
            return_value="https://cdn.test/CACHE/email/product.jpg",
        ):
            url = _resolve_email_image_url(record)

        self.assertEqual(url, "https://cdn.test/CACHE/email/product.jpg")

    @patch("apps.notifications.email_product_media._resolve_imagespec_url")
    @patch("apps.notifications.email_product_media._resolve_imagefield_url")
    def test_skips_missing_imagefield(self, mock_field, mock_spec):
        mock_field.return_value = None
        mock_spec.return_value = "https://cdn.test/thumb.jpg"

        record = SimpleNamespace(
            image=None,
            image_email=None,
            image_thumb=object(),
            image_medium=None,
            image_url=None,
        )

        url = _resolve_email_image_url(record)
        self.assertEqual(url, "https://cdn.test/thumb.jpg")
