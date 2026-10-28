"""Add unique constraint and index on (document_type, cedula_hash) now that all hashes are populated."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("customers", "0003_populate_cedula_hash"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="customer",
            index=models.Index(
                fields=["document_type", "cedula_hash"],
                name="idx_customer_doc_hash",
            ),
        ),
        migrations.AddConstraint(
            model_name="customer",
            constraint=models.UniqueConstraint(
                fields=["document_type", "cedula_hash"],
                name="uniq_customer_document_type_cedula_hash",
            ),
        ),
    ]
