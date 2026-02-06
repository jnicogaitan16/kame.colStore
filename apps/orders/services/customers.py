from __future__ import annotations

from django.core.exceptions import ValidationError

from apps.customers.models import Customer


def get_or_create_customer_from_form_data(form_data: dict) -> Customer:
    """Obtiene o crea un Customer a partir de los datos del checkout."""

    from django.db import IntegrityError

    full_name = (form_data.get("full_name") or "").strip()
    if not full_name:
        first_name = (form_data.get("cedula") or "").strip()
        last_name = ""
    else:
        full_name_parts = full_name.split(maxsplit=1)
        first_name = full_name_parts[0]
        last_name = full_name_parts[1] if len(full_name_parts) > 1 else ""

    cedula = (form_data.get("cedula") or "").strip()
    if not cedula:
        raise ValidationError("La cédula es obligatoria.")

    email = (form_data.get("email") or "").strip()
    phone = (form_data.get("phone") or "").strip()

    try:
        customer, _created = Customer.objects.get_or_create(
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
        try:
            customer = Customer.objects.get(cedula=cedula)
            changed = False

            if phone and not customer.phone:
                customer.phone = phone
                changed = True
            if email and not customer.email:
                customer.email = email
                changed = True

            if first_name and (not customer.first_name or customer.first_name == customer.cedula):
                customer.first_name = first_name
                customer.last_name = last_name
                changed = True

            if changed:
                customer.save(
                    update_fields=[
                        "first_name",
                        "last_name",
                        "phone",
                        "email",
                    ]
                )
            return customer
        except Customer.DoesNotExist:
            if email:
                try:
                    customer = Customer.objects.get(email=email)
                    if customer.cedula != cedula:
                        raise ValidationError(
                            f"El email '{email}' ya está registrado con otra cédula."
                        )
                    return customer
                except Customer.DoesNotExist:
                    pass

        raise ValidationError("Error al crear o obtener el cliente.") from e
