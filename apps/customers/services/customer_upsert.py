

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

from django.db import transaction

from apps.customers.models import Customer


def split_full_name(full_name: str) -> Tuple[str, str]:
    """
    Split a full name into (first_name, last_name).

    Rules:
    - Trims extra whitespace.
    - If only one token is provided, it becomes first_name and last_name is "".
    - Otherwise: first token -> first_name, the rest -> last_name.

    This is intentionally simple and predictable for checkout usage.
    """
    name = (full_name or "").strip()
    if not name:
        return "", ""

    parts = [p for p in name.split(" ") if p.strip()]
    if len(parts) == 1:
        return parts[0], ""

    return parts[0], " ".join(parts[1:])


def _clean_str(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def get_or_create_customer_from_checkout(payload: Dict[str, Any]) -> Customer:
    """
    Centralized upsert for Customer from checkout payload.

    Lookup key:
    - document_type + cedula

    Update rules (soft overwrite):
    - email: if provided and (customer.email is empty OR different)
    - phone: if provided and (customer.phone is empty OR different)
    - first_name/last_name: update only if currently empty; if checkout sends a different
      name, we keep existing unless it's empty.

    Expected payload keys (any casing is NOT handled here; keep consistent in checkout):
    - full_name OR first_name/last_name
    - document_type
    - cedula
    - email (optional)
    - phone (optional)
    """
    document_type = _clean_str(payload.get("document_type"))
    cedula = _clean_str(payload.get("cedula"))

    if not document_type or not cedula:
        raise ValueError("document_type y cedula son requeridos para crear/actualizar Customer.")

    # Name inputs
    full_name = _clean_str(payload.get("full_name"))
    first_name_in = _clean_str(payload.get("first_name"))
    last_name_in = _clean_str(payload.get("last_name"))

    if full_name and (not first_name_in and not last_name_in):
        first_name_in, last_name_in = split_full_name(full_name)

    email_in = _clean_str(payload.get("email"))
    phone_in = _clean_str(payload.get("phone"))

    with transaction.atomic():
        customer = Customer.objects.filter(document_type=document_type, cedula=cedula).first()

        if customer is None:
            customer = Customer.objects.create(
                document_type=document_type,
                cedula=cedula,
                first_name=first_name_in or "",
                last_name=last_name_in or "",
                email=email_in or None,
                phone=phone_in or "",
            )
            return customer

        changed = False

        # Email (nullable)
        if email_in and (not customer.email or customer.email.strip().lower() != email_in.lower()):
            customer.email = email_in
            changed = True

        # Phone (blank allowed)
        if phone_in and (not customer.phone or customer.phone.strip() != phone_in):
            customer.phone = phone_in
            changed = True

        # Names: only fill if empty
        if first_name_in and not (customer.first_name or "").strip():
            customer.first_name = first_name_in
            changed = True

        if last_name_in and not (customer.last_name or "").strip():
            customer.last_name = last_name_in
            changed = True

        if changed:
            customer.save(update_fields=["first_name", "last_name", "email", "phone"])

        return customer