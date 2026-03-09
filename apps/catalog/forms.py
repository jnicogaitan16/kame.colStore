from django import forms
from django.core.exceptions import ValidationError

from apps.catalog.models import Category, InventoryPool
from apps.catalog.variant_rules import get_variant_rule, normalize_variant_color, normalize_variant_value


class InventoryPoolAdminForm(forms.ModelForm):
    class Meta:
        model = InventoryPool
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if "value" in self.fields:
            self.fields["value"].help_text = ""
        if "color" in self.fields:
            self.fields["color"].help_text = ""

        self._category_obj = self._resolve_category()
        self._rule = get_variant_rule(getattr(self._category_obj, "slug", None))
        self._schema = (getattr(self._category_obj, "variant_schema", "") or "").strip()

        self._configure_value_field()
        self._configure_color_field()
        self._configure_schema_visibility()

    def _resolve_category(self):
        if self.instance and getattr(self.instance, "pk", None):
            category = getattr(self.instance, "category", None)
            if category:
                return category

        category_id = self.data.get("category") or self.initial.get("category")
        if not category_id:
            return None

        try:
            return Category.objects.get(pk=category_id)
        except (Category.DoesNotExist, TypeError, ValueError):
            return None

    def _get_allowed_values(self):
        return self._rule.get("allowed_values") or []

    def _get_allowed_colors(self):
        return self._rule.get("allowed_colors") or []

    def _configure_value_field(self):
        if "value" not in self.fields:
            return

        self.fields["value"].label = self._rule.get("label", "Value")
        allowed_values = self._get_allowed_values()
        current_value = normalize_variant_value(getattr(self.instance, "value", None))

        if self._rule.get("use_select") and allowed_values:
            choices = [(v, v) for v in allowed_values]
            choice_values = [c[0] for c in choices]
            if current_value and current_value not in choice_values:
                choices = [(current_value, current_value)] + choices

            self.fields["value"].widget = forms.Select(
                choices=[("", "---------")] + choices
            )

            if current_value:
                self.initial["value"] = current_value
                self.fields["value"].initial = current_value

    def _configure_color_field(self):
        if "color" not in self.fields:
            return

        allowed_colors = self._get_allowed_colors()
        current_color = normalize_variant_color(getattr(self.instance, "color", None))

        if allowed_colors:
            choices = [(c, c) for c in allowed_colors]
            choice_values = [c[0] for c in choices]
            if current_color and current_color not in choice_values:
                choices = [(current_color, current_color)] + choices

            self.fields["color"].widget = forms.Select(
                choices=[("", "---------")] + choices
            )

            if current_color:
                self.initial["color"] = current_color
                self.fields["color"].initial = current_color
        else:
            self.fields["color"].widget = forms.TextInput()
            if current_color:
                self.initial["color"] = current_color
                self.fields["color"].initial = current_color

        self.fields["color"].required = self._schema == Category.VariantSchema.SIZE_COLOR

    def _configure_schema_visibility(self):
        if self._schema != Category.VariantSchema.NO_VARIANT:
            return

        if "value" in self.fields:
            self.fields["value"].widget = forms.HiddenInput()
            self.fields["value"].required = False
        if "color" in self.fields:
            self.fields["color"].widget = forms.HiddenInput()
            self.fields["color"].required = False

    def clean_value(self):
        value = self.cleaned_data.get("value")
        if value is None:
            return value

        value = str(value).strip().upper()
        allowed_values = self._get_allowed_values()

        if self._rule.get("use_select") and allowed_values and value and value not in allowed_values:
            raise ValidationError("Selecciona un valor válido para la categoría elegida.")

        return value

    def clean_color(self):
        color = self.cleaned_data.get("color")
        if color is None:
            return color

        color = normalize_variant_color(color)
        allowed_colors = self._get_allowed_colors()

        if allowed_colors and color and color not in allowed_colors:
            raise ValidationError("Selecciona un color válido para la categoría elegida.")

        return color


# Bulk load form for inventory pools
class InventoryPoolBulkLoadForm(forms.Form):
    category = forms.ModelChoiceField(
        queryset=Category.objects.all(),
        required=True,
        help_text="Categoría leaf (Camisetas/Hoodies/Jean/etc).",
    )
    lines = forms.CharField(
        required=True,
        widget=forms.Textarea(attrs={"rows": 12, "placeholder": "L, Blanco, 10\nM, Negro, 5"}),
        help_text="Una línea por registro. Formato sugerido: value, color, quantity",
    )
    add_to_existing = forms.BooleanField(
        required=False,
        initial=False,
        help_text="Si está activo, consolida duplicados dentro de la carga y suma sobre existentes.",
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.parsed_lines = []
        self._rule = {}
        self._schema = ""

    def clean_category(self):
        category = self.cleaned_data["category"]
        if category.children.exists():
            raise ValidationError("Selecciona una categoría final (leaf).")
        return category

    def clean(self):
        cleaned_data = super().clean()
        category = cleaned_data.get("category")
        raw_lines = cleaned_data.get("lines") or ""
        add_to_existing = bool(cleaned_data.get("add_to_existing"))

        if not category:
            return cleaned_data

        self._rule = get_variant_rule(getattr(category, "slug", None))
        self._schema = (getattr(category, "variant_schema", "") or "").strip()

        parsed_rows = []
        duplicates = {}

        for idx, raw_line in enumerate(raw_lines.splitlines(), start=1):
            line = raw_line.strip()
            if not line:
                continue

            row = self._parse_line(line=line, line_number=idx)
            row = self._normalize_row(row)
            self._validate_row_against_schema(row)

            dedupe_key = (row["value"], row["color"])
            if dedupe_key in duplicates:
                if add_to_existing:
                    duplicates[dedupe_key]["quantity"] += row["quantity"]
                    duplicates[dedupe_key]["source_lines"].append(idx)
                else:
                    raise ValidationError(
                        f"Línea {idx}: combinación duplicada para value/color. "
                        f"Ya fue ingresada en la línea {duplicates[dedupe_key]['line_number']}."
                    )
            else:
                row["source_lines"] = [idx]
                duplicates[dedupe_key] = row
                parsed_rows.append(row)

        if not parsed_rows:
            raise ValidationError("Debes ingresar al menos una línea válida.")

        self.parsed_lines = parsed_rows
        return cleaned_data

    def _parse_line(self, line: str, line_number: int) -> dict:
        parts = [part.strip() for part in line.split(",")]

        if len(parts) == 3:
            value, color, quantity_raw = parts
        elif len(parts) == 2:
            value, quantity_raw = parts
            color = ""
        elif len(parts) == 1:
            value = ""
            color = ""
            quantity_raw = parts[0]
        else:
            raise ValidationError(
                f"Línea {line_number}: formato inválido. Usa 'value, color, quantity' o 'value, quantity'."
            )

        try:
            quantity = int(quantity_raw)
        except (TypeError, ValueError):
            raise ValidationError(f"Línea {line_number}: la cantidad debe ser un entero.")

        return {
            "value": value,
            "color": color,
            "quantity": quantity,
            "line_number": line_number,
        }

    def _normalize_row(self, row: dict) -> dict:
        row["value"] = normalize_variant_value(row.get("value")) or ""
        row["color"] = normalize_variant_color(row.get("color")) or ""
        return row

    def _validate_row_against_schema(self, row: dict) -> None:
        schema = self._schema
        rule = self._rule or {}
        allowed_values = rule.get("allowed_values") or []
        allowed_colors = rule.get("allowed_colors") or []
        line_number = row["line_number"]
        value = row["value"]
        color = row["color"]
        quantity = row["quantity"]

        if quantity <= 0:
            raise ValidationError(f"Línea {line_number}: la cantidad debe ser mayor que cero.")

        if schema == Category.VariantSchema.SIZE_COLOR:
            if not value:
                raise ValidationError(f"Línea {line_number}: el valor/talla es obligatorio.")
            if not color:
                raise ValidationError(f"Línea {line_number}: el color es obligatorio.")
            if allowed_values and value not in allowed_values:
                raise ValidationError(
                    f"Línea {line_number}: valor inválido. Usa: {', '.join(allowed_values)}."
                )
            if allowed_colors and color not in allowed_colors:
                raise ValidationError(
                    f"Línea {line_number}: color inválido. Usa: {', '.join(allowed_colors)}."
                )
            return

        if schema == Category.VariantSchema.JEAN_SIZE:
            if not value:
                raise ValidationError(f"Línea {line_number}: el valor es obligatorio.")
            if allowed_values and value not in allowed_values:
                raise ValidationError(
                    f"Línea {line_number}: valor inválido. Usa: {', '.join(allowed_values)}."
                )
            if color and allowed_colors and color not in allowed_colors:
                raise ValidationError(
                    f"Línea {line_number}: color inválido. Usa: {', '.join(allowed_colors)}."
                )
            return

        if schema == Category.VariantSchema.SHOE_SIZE:
            if not value:
                raise ValidationError(f"Línea {line_number}: el valor es obligatorio.")
            if allowed_values and value not in allowed_values:
                raise ValidationError(
                    f"Línea {line_number}: valor inválido. Usa: {', '.join(allowed_values)}."
                )
            if color:
                raise ValidationError(f"Línea {line_number}: esta categoría no admite color.")
            return

        if schema == Category.VariantSchema.NO_VARIANT:
            if value or color:
                raise ValidationError(
                    f"Línea {line_number}: esta categoría no admite value ni color; ingresa solo cantidad."
                )
            return