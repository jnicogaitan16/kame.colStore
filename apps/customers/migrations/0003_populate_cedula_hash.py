"""Populate cedula_hash for all existing customers and encrypt cedula values."""

from django.db import migrations


def populate_hashes(apps, schema_editor):
    from apps.common.crypto import encrypt_value, make_blind_index

    Customer = apps.get_model("customers", "Customer")
    for customer in Customer.objects.all():
        if customer.cedula and not customer.cedula.startswith("gAAAAA"):
            customer.cedula_hash = make_blind_index(customer.cedula)
            customer.cedula = encrypt_value(customer.cedula)
            customer.save(update_fields=["cedula", "cedula_hash"])
        elif not customer.cedula:
            # Empty cedula — generate a unique hash from pk to avoid constraint violation
            customer.cedula_hash = f"empty-{customer.pk}"
            customer.save(update_fields=["cedula_hash"])


def reverse_hashes(apps, schema_editor):
    # Reverse is not trivially possible for encryption; skip
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("customers", "0002_add_cedula_hash_field"),
    ]

    operations = [
        migrations.RunPython(populate_hashes, reverse_hashes),
    ]
