from django.db import migrations


def backfill_department(apps, schema_editor):
    Department = apps.get_model("catalog", "Department")
    Category = apps.get_model("catalog", "Category")

    dept, _ = Department.objects.get_or_create(
        slug="general",
        defaults={"name": "General", "sort_order": 999},
    )

    Category.objects.filter(department__isnull=True).update(department=dept)


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0003_department_inventorypool_alter_category_options_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill_department, migrations.RunPython.noop),
    ]