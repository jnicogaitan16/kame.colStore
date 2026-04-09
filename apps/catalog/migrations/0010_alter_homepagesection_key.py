# Generated manually: align HomepageSection.key with Django admin (optional in forms; auto-filled from title).

from django.db import migrations, models
from django.utils.text import slugify


def _fill_empty_keys(apps, schema_editor):
    HomepageSection = apps.get_model("catalog", "HomepageSection")
    for s in HomepageSection.objects.all():
        current = (getattr(s, "key", None) or "").strip()
        if current:
            continue
        base = (slugify(s.title or "")[:60]).strip("-") or "seccion"
        candidate = base
        i = 1
        while HomepageSection.objects.filter(key=candidate).exclude(pk=s.pk).exists():
            suffix = f"-{i}"
            max_base = max(1, 60 - len(suffix))
            trimmed = base[:max_base].rstrip("-")
            candidate = f"{trimmed}{suffix}"[:60]
            i += 1
        s.key = candidate
        s.save(update_fields=["key"])


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0009_add_inventory_adjustment_log"),
    ]

    operations = [
        migrations.AlterField(
            model_name="homepagesection",
            name="key",
            field=models.SlugField(
                blank=True,
                default="",
                help_text="Slug interno (opcional; se genera desde el título si va vacío).",
                max_length=60,
                unique=True,
            ),
        ),
        migrations.RunPython(_fill_empty_keys, migrations.RunPython.noop),
    ]
