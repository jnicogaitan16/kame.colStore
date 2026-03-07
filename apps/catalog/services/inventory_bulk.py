from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from apps.catalog.models import Category, InventoryPool
from apps.catalog.services.variant_sync import sync_variants_for_pool
from apps.catalog.variant_rules import (
    get_variant_rule,
    normalize_variant_color,
    normalize_variant_value,
)


@dataclass
class BulkLine:
    value: str
    color: str
    quantity: int
    line_number: int


@dataclass
class BulkProcessResult:
    created: int = 0
    updated: int = 0
    errors: list[str] = field(default_factory=list)


def parse_bulk_lines(raw_text: str) -> list[BulkLine]:
    """Parse raw textarea input into normalized bulk lines."""
    lines: list[BulkLine] = []

    for idx, raw_line in enumerate((raw_text or "").splitlines(), start=1):
        line = raw_line.strip()
        if not line:
            continue

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
            raise ValueError(
                f"Línea {idx}: formato inválido. Usa 'value, color, quantity' o 'value, quantity'."
            )

        try:
            quantity = int(quantity_raw)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Línea {idx}: la cantidad debe ser un entero.") from exc

        lines.append(
            BulkLine(
                value=normalize_variant_value(value) or "",
                color=normalize_variant_color(color) or "",
                quantity=quantity,
                line_number=idx,
            )
        )

    return lines


def validate_bulk_lines(category, lines: list[BulkLine]) -> list[str]:
    """Validate parsed bulk lines against the category schema and rules."""
    errors: list[str] = []
    schema = (getattr(category, "variant_schema", "") or "").strip()
    rule = get_variant_rule(getattr(category, "slug", None))
    allowed_values = rule.get("allowed_values") or []
    allowed_colors = rule.get("allowed_colors") or []

    if getattr(category, "children", None) is not None and category.children.exists():
        errors.append("La categoría seleccionada debe ser una categoría final (leaf).")
        return errors

    seen: dict[tuple[str, str], int] = {}

    for line in lines:
        value = normalize_variant_value(line.value) or ""
        color = normalize_variant_color(line.color) or ""
        quantity = line.quantity
        key = (value, color)

        if quantity <= 0:
            errors.append(f"Línea {line.line_number}: la cantidad debe ser mayor que cero.")
            continue

        if key in seen:
            errors.append(
                f"Línea {line.line_number}: combinación duplicada para value/color. "
                f"Ya fue ingresada en la línea {seen[key]}."
            )
            continue
        seen[key] = line.line_number

        if schema == Category.VariantSchema.SIZE_COLOR:
            if not value:
                errors.append(f"Línea {line.line_number}: la talla es obligatoria.")
            elif allowed_values and value not in allowed_values:
                errors.append(
                    f"Línea {line.line_number}: talla '{value}' no válida. Usa: {', '.join(allowed_values)}."
                )

            if not color:
                errors.append(f"Línea {line.line_number}: el color es obligatorio.")
            elif allowed_colors and color not in allowed_colors:
                errors.append(
                    f"Línea {line.line_number}: color '{color}' no válido para {category.name}."
                )
            continue

        if schema == Category.VariantSchema.JEAN_SIZE:
            if not value:
                errors.append(f"Línea {line.line_number}: el valor es obligatorio.")
            elif allowed_values and value not in allowed_values:
                errors.append(
                    f"Línea {line.line_number}: valor '{value}' no válido. Usa: {', '.join(allowed_values)}."
                )

            if color and allowed_colors and color not in allowed_colors:
                errors.append(
                    f"Línea {line.line_number}: color '{color}' no válido para {category.name}."
                )
            continue

        if schema == Category.VariantSchema.DIMENSION:
            if not value:
                errors.append(f"Línea {line.line_number}: el valor es obligatorio.")
            elif allowed_values and value not in allowed_values:
                errors.append(
                    f"Línea {line.line_number}: valor '{value}' no válido. Usa: {', '.join(allowed_values)}."
                )

            if color:
                errors.append(f"Línea {line.line_number}: esta categoría no admite color.")
            continue

        if schema == Category.VariantSchema.NO_VARIANT:
            if value or color:
                errors.append(
                    f"Línea {line.line_number}: esta categoría no admite value ni color; ingresa solo cantidad."
                )
            continue

    return errors


def process_inventorypool_bulk_load(category, lines: list[BulkLine], add_to_existing: bool) -> BulkProcessResult:
    """
    Persist bulk lines into InventoryPool and sync variants.

    - Normalizes values and colors.
    - Validates against the category schema and variant rules.
    - Creates or updates InventoryPool rows.
    - Always leaves `is_active=True`.
    - Triggers variant sync for affected pools.
    """
    result = BulkProcessResult()

    normalized_lines = [
        BulkLine(
            value=normalize_variant_value(line.value) or "",
            color=normalize_variant_color(line.color) or "",
            quantity=line.quantity,
            line_number=line.line_number,
        )
        for line in lines
    ]

    errors = validate_bulk_lines(category, normalized_lines)
    if errors:
        result.errors.extend(errors)
        return result

    for line in normalized_lines:
        try:
            pool, created = InventoryPool.objects.get_or_create(
                category=category,
                value=line.value,
                color=line.color,
                defaults={
                    "quantity": line.quantity,
                    "is_active": True,
                },
            )

            if created:
                result.created += 1
            else:
                pool.quantity = (pool.quantity + line.quantity) if add_to_existing else line.quantity
                pool.is_active = True
                pool.save(update_fields=["quantity", "is_active"])
                result.updated += 1

            sync_variants_for_pool(pool.id)
        except Exception as exc:
            result.errors.append(f"Línea {line.line_number}: {exc}")

    return result
