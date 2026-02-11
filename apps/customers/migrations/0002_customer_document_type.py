from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("customers", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="customer",
            name="document_type",
            field=models.CharField(
                max_length=10,
                blank=True,
                default="CC",
                help_text="Tipo de documento principal del cliente (CC, NIT, ...).",
            ),
        ),
    ]

