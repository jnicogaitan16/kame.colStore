from django.db import migrations, models
import apps.catalog.models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0004_alter_productimage_options_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="HomepageBanner",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=150)),
                ("subtitle", models.CharField(blank=True, default="", max_length=200)),
                ("description", models.TextField(blank=True, default="")),
                ("image", models.ImageField(upload_to=apps.catalog.models.homepage_banner_upload_path)),
                ("alt_text", models.CharField(blank=True, default="", max_length=200)),
                ("cta_label", models.CharField(blank=True, default="", help_text="Texto del botón (por ejemplo, 'Ver colección').", max_length=80)),
                ("cta_url", models.CharField(blank=True, default="", help_text="URL relativa o absoluta a la que apunta el botón.", max_length=255)),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveIntegerField(default=0, help_text="Orden de aparición en el carrusel (menor = primero).")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["sort_order", "-created_at"],
            },
        ),
    ]

