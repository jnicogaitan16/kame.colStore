from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from apps.notifications.email_assets import (
    WOMPI_LOGO_CID,
    enrich_context_with_brand_assets,
    get_brand_asset_cid_urls,
    get_brand_asset_resend_attachments,
    get_public_email_assets_base_url,
)


class EmailAssetsBaseUrlTests(SimpleTestCase):
    @override_settings(DEBUG=True)
    def test_never_uses_localhost_in_debug_without_public_env(self):
        with patch.dict("os.environ", {}, clear=False):
            base = get_public_email_assets_base_url()
        self.assertTrue(base.startswith("https://"))
        self.assertNotIn("localhost", base)

    def test_email_assets_base_url_override(self):
        with patch.dict("os.environ", {"EMAIL_ASSETS_BASE_URL": "https://cdn.example.com"}):
            self.assertEqual(
                get_public_email_assets_base_url(),
                "https://cdn.example.com",
            )


class EmailBrandAssetTests(SimpleTestCase):
    def test_cid_urls_when_files_exist(self):
        urls = get_brand_asset_cid_urls()
        self.assertEqual(urls["wompi_logo_url"], f"cid:{WOMPI_LOGO_CID}")
        self.assertTrue(urls["whatsapp_icon_url"].startswith("cid:"))

    def test_resend_attachments_include_content_id(self):
        attachments = get_brand_asset_resend_attachments()
        self.assertGreaterEqual(len(attachments), 2)
        ids = {item["content_id"] for item in attachments}
        self.assertIn(WOMPI_LOGO_CID, ids)
        for item in attachments:
            self.assertTrue(item.get("content"))
            self.assertTrue(item.get("filename"))

    def test_enrich_context_adds_brand_urls(self):
        ctx = enrich_context_with_brand_assets({})
        self.assertIn("wompi_logo_url", ctx)
        self.assertIn("whatsapp_icon_url", ctx)
