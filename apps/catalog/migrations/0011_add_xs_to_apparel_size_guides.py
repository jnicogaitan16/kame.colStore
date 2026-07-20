"""Add XS row to existing apparel size guides that don't have it."""

from django.db import migrations


def add_xs_row(apps, schema_editor):
    CategorySizeGuide = apps.get_model("catalog", "CategorySizeGuide")

    for guide in CategorySizeGuide.objects.select_related("category").all():
        schema = getattr(guide.category, "variant_schema", "") or ""
        if schema != "size_color":
            continue

        rows = guide.rows_json
        if not isinstance(rows, list):
            continue

        existing_sizes = {r.get("size") for r in rows if isinstance(r, dict)}
        if "XS" in existing_sizes:
            continue

        columns = guide.columns_json
        num_values = max(len(columns) - 1, 0) if isinstance(columns, list) else 0
        if num_values == 0:
            continue

        # Estimate XS values by extrapolating from S row (subtract ~3 per measurement)
        s_row = next(
            (r for r in rows if isinstance(r, dict) and r.get("size") == "S"),
            None,
        )

        if s_row and isinstance(s_row.get("values"), list):
            xs_values = [
                round(v - 3, 1) if isinstance(v, (int, float)) else v
                for v in s_row["values"]
            ]
        else:
            xs_values = [0] * num_values

        rows.insert(0, {"size": "XS", "values": xs_values})
        guide.rows_json = rows
        guide.save(update_fields=["rows_json"])


def remove_xs_row(apps, schema_editor):
    CategorySizeGuide = apps.get_model("catalog", "CategorySizeGuide")

    for guide in CategorySizeGuide.objects.select_related("category").all():
        schema = getattr(guide.category, "variant_schema", "") or ""
        if schema != "size_color":
            continue

        rows = guide.rows_json
        if not isinstance(rows, list):
            continue

        guide.rows_json = [
            r for r in rows if not (isinstance(r, dict) and r.get("size") == "XS")
        ]
        guide.save(update_fields=["rows_json"])


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0010_alter_homepagesection_key"),
    ]

    operations = [
        migrations.RunPython(add_xs_row, remove_xs_row),
    ]
