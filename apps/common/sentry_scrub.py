"""Scrub checkout PII from Sentry events (Ley 1581 / SEC-08)."""

from __future__ import annotations

import json
import re
from typing import Any

FILTERED = "[Filtered]"
MAX_DEPTH = 12

# Normalized with str.lower().replace("-", "_") before lookup.
SENSITIVE_KEYS = frozenset(
    {
        "password",
        "card_number",
        "cvv",
        "cvc",
        "token",
        "secret",
        "authorization",
        "email",
        "user_email",
        "customer_email",
        "to_email",
        "full_name",
        "first_name",
        "last_name",
        "customer_name",
        "cedula",
        "document_number",
        "document",
        "legal_id",
        "legalid",
        "phone",
        "phone_number",
        "phonenumber",
        "phone_number_prefix",
        "phonenumberprefix",
        "customer_phone",
        "address",
        "customer_address",
        "delivery_notes",
        "notes",
    }
)

SENSITIVE_HEADER_KEYS = frozenset(
    {
        "authorization",
        "cookie",
        "set_cookie",
        "x_csrftoken",
        "x_api_key",
    }
)

_EMAIL_RE = re.compile(r"[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}", re.IGNORECASE)


def _normalize_key(key: Any) -> str:
    return str(key).strip().lower().replace("-", "_")


def _is_sensitive_key(key: Any) -> bool:
    return _normalize_key(key) in SENSITIVE_KEYS


def _is_sensitive_header(key: Any) -> bool:
    return _normalize_key(key) in SENSITIVE_HEADER_KEYS


def scrub_text(value: str) -> str:
    if not value:
        return value
    return _EMAIL_RE.sub(FILTERED, value)


def scrub_value(value: Any, *, depth: int = 0) -> Any:
    if depth > MAX_DEPTH:
        return value

    if isinstance(value, dict):
        return {
            key: FILTERED if _is_sensitive_key(key) else scrub_value(item, depth=depth + 1)
            for key, item in value.items()
        }

    if isinstance(value, list):
        return [scrub_value(item, depth=depth + 1) for item in value]

    if isinstance(value, tuple):
        return tuple(scrub_value(item, depth=depth + 1) for item in value)

    if isinstance(value, str):
        return scrub_text(value)

    return value


def scrub_request_data(data: Any) -> Any:
    if isinstance(data, str):
        try:
            parsed = json.loads(data)
        except (TypeError, ValueError):
            return scrub_text(data)
        scrubbed = scrub_value(parsed)
        return json.dumps(scrubbed) if isinstance(parsed, (dict, list)) else scrubbed
    return scrub_value(data)


def _scrub_request(request: dict[str, Any]) -> None:
    if "data" in request:
        request["data"] = scrub_request_data(request.get("data"))
    if "cookies" in request:
        request["cookies"] = FILTERED
    headers = request.get("headers")
    if isinstance(headers, dict):
        request["headers"] = {
            key: FILTERED if _is_sensitive_header(key) else value
            for key, value in headers.items()
        }
    env = request.get("env")
    if isinstance(env, dict):
        request["env"] = {
            key: FILTERED if _is_sensitive_header(key) or _is_sensitive_key(key) else value
            for key, value in env.items()
        }
    query_string = request.get("query_string")
    if isinstance(query_string, str) and query_string:
        request["query_string"] = scrub_text(query_string)


def _scrub_user(user: dict[str, Any]) -> None:
    for key in ("email", "ip_address", "username", "name", "geo"):
        if key in user:
            user[key] = FILTERED


def _scrub_breadcrumbs(breadcrumbs: Any) -> None:
    values = breadcrumbs.get("values") if isinstance(breadcrumbs, dict) else breadcrumbs
    if not isinstance(values, list):
        return
    for crumb in values:
        if not isinstance(crumb, dict):
            continue
        if isinstance(crumb.get("message"), str):
            crumb["message"] = scrub_text(crumb["message"])
        if "data" in crumb:
            crumb["data"] = scrub_value(crumb.get("data"))


def sentry_before_send(event: dict[str, Any], hint: Any = None) -> dict[str, Any]:
    """Drop checkout PII from a Sentry event. Always returns the event."""
    del hint
    try:
        request = event.get("request")
        if isinstance(request, dict):
            _scrub_request(request)

        extra = event.get("extra")
        if isinstance(extra, dict):
            event["extra"] = scrub_value(extra)

        contexts = event.get("contexts")
        if isinstance(contexts, dict):
            event["contexts"] = scrub_value(contexts)

        user = event.get("user")
        if isinstance(user, dict):
            _scrub_user(user)

        breadcrumbs = event.get("breadcrumbs")
        if breadcrumbs:
            _scrub_breadcrumbs(breadcrumbs)

        if isinstance(event.get("message"), str):
            event["message"] = scrub_text(event["message"])

        logentry = event.get("logentry")
        if isinstance(logentry, dict) and isinstance(logentry.get("message"), str):
            logentry["message"] = scrub_text(logentry["message"])
    except Exception:
        return event
    return event
