from django.db import migrations, models


def clear_default_cta_on_image_only_promos(apps, schema_editor):
    HomepagePromo = apps.get_model("catalog", "HomepagePromo")
    HomepagePromo.objects.filter(
        show_text=False,
        cta_label="Ver más",
    ).update(cta_label="")


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0011_add_xs_to_apparel_size_guides"),
    ]

    operations = [
        migrations.AlterField(
            model_name="homepagepromo",
            name="cta_label",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Texto del CTA (por ejemplo, 'Ver más'). Dejar vacío para no mostrar botón.",
                max_length=80,
            ),
        ),
        migrations.AlterField(
            model_name="homepagepromo",
            name="show_text",
            field=models.BooleanField(
                default=True,
                help_text=(
                    "Si se desactiva, no se muestran título/subtítulo aunque existan. "
                    "El botón CTA es independiente: solo aparece si Cta label tiene texto."
                ),
            ),
        ),
        migrations.RunPython(
            clear_default_cta_on_image_only_promos,
            migrations.RunPython.noop,
        ),
    ]
