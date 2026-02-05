from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Sum

from .variant_rules import get_variant_rule, normalize_variant_value


class Category(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True)

    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name



class Product(models.Model):
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)

    description = models.TextField(blank=True)

    price = models.DecimalField(max_digits=10, decimal_places=2)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "id"]

    def clean(self):
        super().clean()

        # Stock source of truth is ProductVariant. Do not allow active products with no stock.
        if self.is_active and self.total_stock <= 0:
            raise ValidationError(
                {"is_active": "No puedes activar un producto sin stock disponible en sus variantes."}
            )

    def __str__(self) -> str:
        return self.name

    @property
    def total_stock(self) -> int:
        """Stock real (suma de stock de variantes activas)."""
        agg = self.variants.filter(is_active=True).aggregate(total=Sum("stock"))
        return int(agg["total"] or 0)

    @property
    def variants_stock_total(self) -> int:
        """Alias retrocompatible usado por el admin."""
        return self.total_stock


class ProductVariant(models.Model):
    """A generic variant model.

    Requirements:
    - Camisetas: talla -> S/M/L/XL/2XL
    OrderItem should reference ProductVariant (handled in orders app).
    """

    # Backward-compatible alias used by admin/forms.
    TSHIRT_SIZES = get_variant_rule("camisetas").get("allowed_values") or []

    # Shared colors for apparel (camisetas/hoodies) - comes from variant_rules
    APPAREL_COLORS = get_variant_rule("camisetas").get("allowed_colors") or []

    class Kind(models.TextChoices):
        GENERIC = "generic", "Genérico"
        SIZE = "size", "Talla"
        MEASURE = "measure", "Medida"
        MUG_TYPE = "mug_type", "Tipo de mug"

    CATEGORY_TO_KIND = {
        "camisetas": Kind.SIZE,
        # Keep for compatibility, but don't use for validation:
        "cuadros": Kind.MEASURE,
        "mugs": Kind.MUG_TYPE,
    }

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")

    # Derived from product.category for the supported categories.
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.GENERIC, editable=False)

    # Stores the variant value (e.g. "M", "30x40", "MAGICO").
    # For categories that require variants (camisetas/cuadros/mugs) this is required.
    value = models.CharField(max_length=20, null=True, blank=True)

    # Optional extra attribute for apparel variants (required for camisetas/hoodies).
    color = models.CharField(max_length=20, null=True, blank=True)

    stock = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["product", "kind", "value", "color"], name="uniq_product_variant"),
        ]
        ordering = ["product__name", "kind", "value", "id"]

    def _normalized_category_key(self) -> str:
        """Returns a normalized category key based on slug or name."""
        if not self.product_id or not getattr(self.product, "category", None):
            return ""
        slug = (getattr(self.product.category, "slug", "") or "").strip().lower()
        if slug:
            return slug
        return (getattr(self.product.category, "name", "") or "").strip().lower()


    def clean(self):
        super().clean()

        category_slug = None
        if self.product and getattr(self.product, "category", None):
            category_slug = self.product.category.slug

        # Derive kind from category (so admin/validation behave consistently)
        slug_norm = (category_slug or "").strip().lower()
        self.kind = self.CATEGORY_TO_KIND.get(slug_norm, self.Kind.GENERIC)

        # Rules are only STRICTLY enforced for apparel categories.
        rule = get_variant_rule(category_slug)

        # -----------------------------
        # Value validation (apparel only)
        # -----------------------------
        if slug_norm in {"camisetas", "hoodies"}:
            # Normalize value according to central rule
            self.value = normalize_variant_value(self.value)

            allowed = rule.get("allowed_values")
            # For apparel, value is required
            if not self.value:
                label = rule.get("label", "Value")
                raise ValidationError({"value": f"Selecciona {label.lower()}."})

            if allowed and self.value not in allowed:
                label = rule.get("label", "Value")
                raise ValidationError({"value": f"{label} inválida. Usa: {', '.join(allowed)}."})
        else:
            # For non-apparel products, do not enforce a fixed list.
            # Keep whatever the user entered (or allow empty).
            if self.value is not None:
                self.value = (self.value or "").strip() or None

        # -----------------------------
        # Color validation (apparel only)
        # -----------------------------
        allowed_colors = rule.get("allowed_colors")
        if slug_norm in {"camisetas", "hoodies"}:
            # For apparel, color is required and must be one of allowed colors
            self.color = (self.color or "").strip()
            if not self.color:
                raise ValidationError({"color": "Selecciona un color."})
            if allowed_colors and self.color not in allowed_colors:
                raise ValidationError({"color": f"Color inválido. Usa: {', '.join(allowed_colors)}."})
        else:
            # For non-apparel products, do not persist color
            self.color = None

        # -----------------------------
        # Prevent duplicates (same product + kind + value + color)
        # -----------------------------
        # Only check duplicates when a concrete value exists.
        if self.product_id and self.kind and self.value:
            exists = (
                type(self).objects
                .filter(
                    product_id=self.product_id,
                    kind=self.kind,
                    value=self.value,
                    color=self.color,
                )
                .exclude(pk=self.pk)
                .exists()
            )
            if exists:
                raise ValidationError({"value": "Ya existe una variante con este valor para este producto."})

    def __str__(self) -> str:
        if self.value and self.color:
            return f"{self.product.name} - {self.get_kind_display()}: {self.value} / {self.color}"
        if self.value:
            return f"{self.product.name} - {self.get_kind_display()}: {self.value}"
        return f"{self.product.name} (sin variante)"