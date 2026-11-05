import json

from django.test import SimpleTestCase

from apps.common.sentry_scrub import FILTERED, sentry_before_send

# Shape enviado por frontend/lib/api.ts → POST /api/checkout/
CHECKOUT_PII = {
    "full_name": "Ana Garcia",
    "email": "ana@test.com",
    "document_number": "1098765432",
    "phone": "3001234567",
    "address": "Calle 100 # 15-20",
    "notes": "Apartamento 301, porteria",
}


def _checkout_event():
    return {
        "message": "Checkout failed for ana@test.com",
        "request": {
            "data": {
                "customer": {
                    "full_name": CHECKOUT_PII["full_name"],
                    "document_type": "CC",
                    "document_number": CHECKOUT_PII["document_number"],
                    "cedula": CHECKOUT_PII["document_number"],
                    "email": CHECKOUT_PII["email"],
                    "phone": CHECKOUT_PII["phone"],
                },
                "shipping_address": {
                    "city_code": "BOG",
                    "address": CHECKOUT_PII["address"],
                    "notes": CHECKOUT_PII["notes"],
                },
                "items": [{"product_variant_id": 1, "quantity": 2}],
                "payment_method": "NEQUI",
            },
            "headers": {
                "Content-Type": "application/json",
                "Authorization": "Bearer secret-token",
                "Cookie": "sessionid=abc",
            },
            "cookies": {"sessionid": "abc"},
        },
        "extra": {"legalId": CHECKOUT_PII["document_number"], "phoneNumber": CHECKOUT_PII["phone"]},
        "user": {"email": CHECKOUT_PII["email"], "ip_address": "1.2.3.4"},
        "breadcrumbs": {
            "values": [
                {
                    "message": f"Invocando send_payment_confirmed_email email={CHECKOUT_PII['email']}",
                    "data": {"email": CHECKOUT_PII["email"], "order_id": 44},
                }
            ]
        },
    }


class SentryScrubTests(SimpleTestCase):
    def test_settings_wires_the_same_before_send(self):
        from config.settings import _sentry_before_send

        self.assertIs(_sentry_before_send, sentry_before_send)

    def test_filters_nested_checkout_pii(self):
        scrubbed = sentry_before_send(_checkout_event())

        customer = scrubbed["request"]["data"]["customer"]
        shipping = scrubbed["request"]["data"]["shipping_address"]

        self.assertEqual(customer["email"], FILTERED)
        self.assertEqual(customer["cedula"], FILTERED)
        self.assertEqual(customer["document_number"], FILTERED)
        self.assertEqual(customer["phone"], FILTERED)
        self.assertEqual(customer["full_name"], FILTERED)
        self.assertEqual(customer["document_type"], "CC")
        self.assertEqual(shipping["address"], FILTERED)
        self.assertEqual(shipping["notes"], FILTERED)
        self.assertEqual(shipping["city_code"], "BOG")
        self.assertEqual(scrubbed["request"]["data"]["items"][0]["quantity"], 2)
        self.assertEqual(scrubbed["request"]["data"]["payment_method"], "NEQUI")

        self.assertEqual(scrubbed["request"]["headers"]["Authorization"], FILTERED)
        self.assertEqual(scrubbed["request"]["headers"]["Cookie"], FILTERED)
        self.assertEqual(scrubbed["request"]["headers"]["Content-Type"], "application/json")
        self.assertEqual(scrubbed["request"]["cookies"], FILTERED)

        self.assertEqual(scrubbed["extra"]["legalId"], FILTERED)
        self.assertEqual(scrubbed["extra"]["phoneNumber"], FILTERED)
        self.assertEqual(scrubbed["user"]["email"], FILTERED)
        self.assertEqual(scrubbed["user"]["ip_address"], FILTERED)

        crumb = scrubbed["breadcrumbs"]["values"][0]
        self.assertNotIn(CHECKOUT_PII["email"], crumb["message"])
        self.assertEqual(crumb["data"]["email"], FILTERED)
        self.assertEqual(crumb["data"]["order_id"], 44)

        dumped = json.dumps(scrubbed)
        for secret in CHECKOUT_PII.values():
            self.assertNotIn(secret, dumped)

    def test_keeps_event_when_request_data_is_json_string(self):
        event = {
            "request": {
                "data": '{"email": "ana@test.com", "items": [{"sku": "TEE"}]}',
            }
        }
        scrubbed = sentry_before_send(event)
        self.assertIn(FILTERED, scrubbed["request"]["data"])
        self.assertNotIn("ana@test.com", scrubbed["request"]["data"])
        self.assertIn("TEE", scrubbed["request"]["data"])
