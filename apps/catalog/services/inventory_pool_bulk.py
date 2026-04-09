"""Aplicar líneas de stock masivo (compartido entre Django admin y admin API)."""

from django.db import IntegrityError, transaction

from apps.catalog.models import InventoryPool


def process_bulk_stock_lines(category_id: int, lines, add_to_existing: bool):
    """Crea o actualiza filas de InventoryPool.

    lines: iterable de (value, color, qty); value/color ya normalizados como en el formulario bulk.
    Retorna (created_count, updated_count, errors).
    """
    created = 0
    updated = 0
    errors = []
    for value, color, qty in lines:
        value = (value or "").strip().upper()
        color = (color or "").strip()
        try:
            # CONCURRENCY: select_for_update prevents race condition on stock decrement
            with transaction.atomic():
                pool = (
                    InventoryPool.objects.select_for_update()
                    .filter(category_id=category_id, value=value, color=color)
                    .first()
                )
                if pool is None:
                    try:
                        pool = InventoryPool.objects.create(
                            category_id=category_id,
                            value=value,
                            color=color,
                            quantity=qty,
                            is_active=True,
                        )
                        created += 1
                    except IntegrityError:
                        pool = InventoryPool.objects.select_for_update().get(
                            category_id=category_id, value=value, color=color
                        )
                        if add_to_existing:
                            pool.quantity = (pool.quantity or 0) + qty
                        else:
                            pool.quantity = qty
                        pool.is_active = True
                        pool.save(update_fields=["quantity", "updated_at", "is_active"])
                        updated += 1
                else:
                    if add_to_existing:
                        pool.quantity = (pool.quantity or 0) + qty
                    else:
                        pool.quantity = qty
                    pool.is_active = True
                    pool.save(update_fields=["quantity", "updated_at", "is_active"])
                    updated += 1
        except Exception as e:
            errors.append(f"{value}/{color}: {e}")
    return created, updated, errors
