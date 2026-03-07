"""Inventory service.

Fuente de verdad: InventoryPool (pool global por base).

Este módulo centraliza:
- normalización de keys (value/color)
- lectura de stock disponible desde pool
- validación de disponibilidad
- descuento seguro (sin race conditions) usando select_for_update

Contrato (obligatorio):
1) normalize(s) -> str
2) get_pool_map(category_id) -> dict[(value,color)] = qty
3) get_variant_available_stock(variant) -> int
4) assert_stock_available(variant, qty) -> None
5) decrement_pool_stock(variant, qty) -> None (transaction + select_for_update)

Keys soportadas por schema (sin cambiar la estructura del pool):
- size_color -> ("L", "Negro")
- jean_size -> ("32", "")
- shoe_size -> ("40", "")
- no_variant -> ("", "")
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Tuple, Any, Optional

from django.db import transaction

from apps.catalog.models import InventoryPool


# ======================
# Exceptions
# ======================


@dataclass
class InventoryError(Exception):
    code: str
    message: str

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.code}: {self.message}"


class OutOfStockError(InventoryError):
    """Raised when the requested qty is not available in the pool."""


# ======================
# Helpers
# ======================


def normalize(s: Any) -> str:
    """Normalize arbitrary input into a safe string.

    Contract:
    - strip()
    - fallback ""

    Nota: InventoryPool.clean() normaliza `value` a upper.
    ProductVariant.clean() normaliza `value` a upper.
    """
    if s is None:
        return ""
    return str(s).strip()


def _norm_value(value: Any) -> str:
    # Para asegurar match con InventoryPool.value (upper en clean)
    return normalize(value).upper()


def _norm_color(color: Any) -> str:
    # Color se mantiene como texto (sin upper) para no romper nombres.
    return normalize(color)


def _variant_category_id(variant: Any) -> Optional[int]:
    """Obtiene el category_id leaf desde un ProductVariant-like object."""
    try:
        # variant.product.category_id es lo esperado
        return int(getattr(getattr(variant, "product", None), "category_id", None))
    except Exception:
        return None


def _variant_key(variant: Any) -> Tuple[str, str]:
    """Key (value,color) normalizada para usar en el pool.

    La estructura del pool NO cambia:
    - size_color -> (value, color)
    - jean_size -> (value, "")
    - shoe_size -> (value, "")
    - no_variant -> ("", "")
    """ 
    value = _norm_value(getattr(variant, "value", ""))
    color = _norm_color(getattr(variant, "color", ""))
    return value, color


# ======================
# Public API (contract)
# ======================


def get_available_stock(
    category_id: int,
    value: Any,
    color: Any,
    *,
    pool_map: Optional[Dict[Tuple[str, str], int]] = None,
) -> int:
    """Returns available stock for a (category_id, value, color) combination.

    This is the low-level (pool) stock source of truth.

    La estructura de resolución sigue siendo siempre (value, color),
    pero el contenido depende del schema de la categoría:
    - size_color -> ("L", "Negro")
    - jean_size -> ("32", "")
    - shoe_size -> ("40", "")
    - no_variant -> ("", "")

    Contract:
    - Uses the same normalization rules as InventoryPool/ProductVariant clean()
    - If pool_map is provided, it will be used instead of hitting the DB
    """
    if not category_id:
        return 0

    key = (_norm_value(value), _norm_color(color))

    if pool_map is None:
        pool_map = get_pool_map(int(category_id))

    return int(pool_map.get(key, 0) or 0)


def consume_stock(category_id: int, value: Any, color: Any, qty: int) -> None:
    """Consumes (decrements) pool stock safely.

    This is the low-level function that performs the transactional, locked decrement.

    Contract:
    - transaction.atomic()
    - select_for_update() on the InventoryPool row
    - raises OutOfStockError when insufficient
    """
    try:
        qty_int = int(qty)
    except Exception:
        qty_int = 0

    if qty_int <= 0:
        return

    if not category_id:
        raise OutOfStockError(code="OUT_OF_STOCK", message="Categoría inválida.")

    value_norm = _norm_value(value)
    color_norm = _norm_color(color)

    with transaction.atomic():
        try:
            pool_row = (
                InventoryPool.objects
                .select_for_update()
                .get(
                    category_id=int(category_id),
                    value=value_norm,
                    color=color_norm,
                    is_active=True,
                )
            )
        except InventoryPool.DoesNotExist:
            raise OutOfStockError(
                code="OUT_OF_STOCK",
                message="No existe pool para esta combinación técnica (value/color).",
            )

        if int(pool_row.quantity or 0) < qty_int:
            raise OutOfStockError(
                code="OUT_OF_STOCK",
                message=f"Stock insuficiente en pool: solicitado={qty_int}, disponible={pool_row.quantity}.",
            )

        pool_row.quantity = int(pool_row.quantity or 0) - qty_int
        pool_row.save(update_fields=["quantity", "updated_at"])


def get_pool_map(category_id: int) -> Dict[Tuple[str, str], int]:
    """Returns a dict mapping (value,color) -> quantity for a category.

    La clave sigue siendo siempre `(value, color)` para todos los schemas.

    Ejemplos:
    - size_color -> ("L", "Negro")
    - jean_size -> ("32", "")
    - shoe_size -> ("40", "")
    - no_variant -> ("", "")

    Contract:
    - 1 query
    - dict en memoria
    """
    if not category_id:
        return {}

    rows = (
        InventoryPool.objects
        .filter(category_id=category_id, is_active=True)
        .values_list("value", "color", "quantity")
    )

    pool: Dict[Tuple[str, str], int] = {}
    for value, color, qty in rows:
        pool[(_norm_value(value), _norm_color(color))] = int(qty or 0)
    return pool


def get_variant_available_stock(variant: Any, *, pool_map: Optional[Dict[Tuple[str, str], int]] = None) -> int:
    """Stock disponible para una variante, derivado del InventoryPool.

    Contract: usa pool_map.
    La resolución sigue usando `(value, color)` aunque algunas categorías
    usen `color=""` o incluso `value=""` y `color=""`.
    """
    category_id = _variant_category_id(variant)
    if not category_id:
        return 0

    value, color = _variant_key(variant)
    return get_available_stock(category_id, value, color, pool_map=pool_map)


def assert_stock_available(variant: Any, qty: int, *, pool_map: Optional[Dict[Tuple[str, str], int]] = None) -> None:
    """Validates availability; raises OutOfStockError if insufficient."""
    try:
        qty_int = int(qty)
    except Exception:
        qty_int = 0

    if qty_int <= 0:
        return

    available = get_variant_available_stock(variant, pool_map=pool_map)
    if available < qty_int:
        raise OutOfStockError(
            code="OUT_OF_STOCK",
            message=f"Stock insuficiente: solicitado={qty_int}, disponible={available}.",
        )


def decrement_pool_stock(variant: Any, qty: int) -> None:
    """Decrements pool stock safely.

    Contract:
    - en transacción
    - select_for_update() sobre InventoryPool row

    Criterio:
    - No hay race condition (dos compras simultáneas)
    """
    # Backwards-compatible wrapper around consume_stock()
    category_id = _variant_category_id(variant)
    if not category_id:
        raise OutOfStockError(code="OUT_OF_STOCK", message="Variante sin categoría válida.")

    value, color = _variant_key(variant)
    consume_stock(category_id, value, color, qty)