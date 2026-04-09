"""Aplicar líneas de stock masivo (compartido entre Django admin y admin API)."""


def process_bulk_stock_lines(category_id: int, lines, add_to_existing: bool):
    """Crea o actualiza filas de InventoryPool.

    lines: iterable de (value, color, qty); value/color ya normalizados como en el formulario bulk.
    Retorna (created_count, updated_count, errors).
    """
    from apps.catalog.models import InventoryPool

    created = 0
    updated = 0
    errors = []
    for value, color, qty in lines:
        value = (value or "").strip().upper()
        color = (color or "").strip()
        try:
            pool, was_created = InventoryPool.objects.get_or_create(
                category_id=category_id,
                value=value,
                color=color,
                defaults={"quantity": qty, "is_active": True},
            )
            if was_created:
                created += 1
            else:
                if add_to_existing:
                    pool.quantity = (pool.quantity or 0) + qty
                else:
                    pool.quantity = qty
                pool.is_active = True
                pool.save(update_fields=["quantity", "updated_at"])
                updated += 1
        except Exception as e:
            errors.append(f"{value}/{color}: {e}")
    return created, updated, errors
