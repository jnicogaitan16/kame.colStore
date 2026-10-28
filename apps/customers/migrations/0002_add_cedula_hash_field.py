"""Add cedula_hash field and widen cedula for encrypted values. No constraints yet."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("customers", "0001_initial"),
    ]

    operations = [
        # Remove old constraint and index first
        migrations.RemoveConstraint(
            model_name="customer",
            name="uniq_customer_document_type_cedula",
        ),
        migrations.RemoveIndex(
            model_name="customer",
            name="idx_customer_doc",
        ),
        # Add cedula_hash field (no unique constraint yet)
        migrations.AddField(
            model_name="customer",
            name="cedula_hash",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text="HMAC-SHA256 blind index for encrypted cedula lookups.",
                max_length=64,
            ),
        ),
        # Widen cedula to hold encrypted values
        migrations.AlterField(
            model_name="customer",
            name="cedula",
            field=models.CharField(
                max_length=500,
                validators=[],
            ),
        ),
    ]
