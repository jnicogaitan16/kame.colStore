"""
Discount resolution service.

Finds the best active discount rule for a given product, considering
scope hierarchy: PRODUCT > CATEGORY > DEPARTMENT > STORE_WIDE.
"""
from __future__ import annotations

import math
from decimal import Decimal
from typing import NamedTuple

from django.db.models import Q
from django.utils import timezone

from apps.catalog.models import DiscountRule


class AppliedDiscount(NamedTuple):
    """Result of applying a discount to a product price."""
    original_price: Decimal
    discount_price: int          # final price in COP (int)
    discount_percentage: int     # e.g. 15 (for display)
    discount_amount: int         # savings in COP (int)
    rule_name: str
    rule_id: int


def get_active_discount(product) -> DiscountRule | None:
    """Return the highest-priority active discount rule for a product.

    Priority order:
    1. Product-specific rules (scope=product, matching product)
    2. Category rules (scope=category, matching category)
    3. Department rules (scope=department, matching department)
    4. Store-wide rules (scope=store_wide)

    Within the same scope, higher `priority` field wins.
    """
    now = timezone.now()
    category = getattr(product, "category", None)
    department = getattr(category, "department", None) if category else None

    scope_filters = Q(scope=DiscountRule.Scope.STORE_WIDE)
    if department:
        scope_filters |= Q(scope=DiscountRule.Scope.DEPARTMENT, department=department)
    if category:
        scope_filters |= Q(scope=DiscountRule.Scope.CATEGORY, category=category)
    scope_filters |= Q(scope=DiscountRule.Scope.PRODUCT, product=product)

    rule = (
        DiscountRule.objects
        .filter(
            is_active=True,
            starts_at__lte=now,
        )
        .filter(Q(ends_at__isnull=True) | Q(ends_at__gte=now))
        .filter(scope_filters)
        .order_by("-priority", "-pk")
        .first()
    )

    if rule is None:
        return None

    # Among returned rules, pick most specific scope
    # (the query already orders by priority; if same priority, prefer more specific scope)
    return rule


def apply_discount(price: Decimal, rule: DiscountRule) -> AppliedDiscount:
    """Calculate the discounted price for a given rule."""
    original = int(price)

    if rule.discount_type == DiscountRule.DiscountType.PERCENTAGE:
        pct = float(rule.discount_value)
        discount_amount = int(math.floor(original * pct / 100))
        final = original - discount_amount
        return AppliedDiscount(
            original_price=price,
            discount_price=max(0, final),
            discount_percentage=int(pct),
            discount_amount=discount_amount,
            rule_name=rule.name,
            rule_id=rule.pk,
        )

    # FIXED_AMOUNT
    discount_amount = int(rule.discount_value)
    final = original - discount_amount
    pct = int(round(discount_amount / original * 100)) if original > 0 else 0
    return AppliedDiscount(
        original_price=price,
        discount_price=max(0, final),
        discount_percentage=pct,
        discount_amount=discount_amount,
        rule_name=rule.name,
        rule_id=rule.pk,
    )


def get_product_discount_info(product) -> dict | None:
    """Convenience: get discount info dict ready for serialization.

    Returns None if no discount applies.
    """
    rule = get_active_discount(product)
    if rule is None:
        return None

    price = getattr(product, "price", 0)
    applied = apply_discount(price, rule)

    return {
        "has_discount": True,
        "compare_at_price": int(applied.original_price),
        "discount_price": applied.discount_price,
        "discount_percentage": applied.discount_percentage,
        "discount_amount": applied.discount_amount,
        "discount_label": f"-{applied.discount_percentage}%",
        "rule_name": applied.rule_name,
    }
