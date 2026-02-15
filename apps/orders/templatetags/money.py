"""apps.orders.templatetags.money

Utilidades para formateo monetario consistente en todo el proyecto.
Objetivo: mostrar valores como $165.000 (COP).

Uso en templates:
    {% load money %}
    {{ order.total|money }}
"""

from decimal import Decimal

from django import template

register = template.Library()


def format_money(value: int | float | Decimal | None) -> str:
    """Formatea un número como moneda colombiana.

    Ejemplo:
        165000 -> $165.000

    Reglas:
        - None o valores inválidos -> "—"
        - Sin sufijo "COP" (solo símbolo y separador de miles)
    """
    if value is None:
        return "—"

    try:
        amount = int(Decimal(value))
    except Exception:
        return "—"

    formatted = f"{amount:,}".replace(",", ".")
    return f"${formatted}"


@register.filter(name="money")
def money_filter(value):
    """Template usage:
        {{ order.total|money }}
    """
    return format_money(value)
