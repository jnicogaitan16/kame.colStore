from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0003_order_address_order_cedula_order_city_code_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="document_type",
            field=models.CharField(
                max_length=10,
                blank=True,
                default="CC",
                help_text="Tipo de documento al momento del pedido (CC, NIT, ...).",
            ),
        ),
    ]

