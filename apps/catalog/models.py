from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Sum


class Category(models.Model):
    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True)

    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    @property
    def total_stock(self) -> int:
        """Stock real (suma de stock de variantes activas).

        Nota: si el producto no tiene variantes, devuelve 0.
        """
        agg = self.variants.filter(is_active=True).aggregate(total=Sum("stock"))
        return int(agg["total"] or 0)

    @property
    def variants_stock_total(self) -> int:
        """Alias retrocompatible usado por el admin."""
        return self.total_stock


class Product(models.Model):
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)

    description = models.TextField(blank=True)

    price = models.DecimalField(max_digits=10, decimal_places=2)

    # NOTE: For apparel like "camisetas", stock should be managed per size via ProductVariant.
    # This global stock can still be used for products without sizes.
    stock = models.PositiveIntegerField(default=0)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "id"]

    def __str__(self) -> str:
        return self.name


class ProductVariant(models.Model):
    """A generic variant model.

    Requirements:
    - Camisetas: talla -> S/M/L/XL/2XL
    - Cuadros: medida -> 20x30 / 30x40 / 40x50
    - Mugs: tipo -> Blanco / Colores / Mágico

    OrderItem should reference ProductVariant (handled in orders app).
    """

    class Kind(models.TextChoices):
        GENERIC = "generic", "Genérico"
        SIZE = "size", "Talla"
        MEASURE = "measure", "Medida"
        MUG_TYPE = "mug_type", "Tipo de mug"

    # Canonical allowed values per category (by slug/name)
    TSHIRT_SIZES = {"S", "M", "L", "XL", "2XL"}
    FRAME_SIZES = {"20x30", "30x40", "40x50"}
    MUG_TYPES = {"BLANCO", "COLORES", "MAGICO"}  # MAGICO == "Mágico"

    CATEGORY_TO_KIND = {
        "camisetas": Kind.SIZE,
        "cuadros": Kind.MEASURE,
        "mugs": Kind.MUG_TYPE,
    }

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")

    # Derived from product.category for the supported categories.
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.GENERIC, editable=False)

    # Stores the variant value (e.g. "M", "30x40", "MAGICO").
    # For categories that require variants (camisetas/cuadros/mugs) this is required.
    value = models.CharField(max_length=20, null=True, blank=True)

    stock = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["product", "kind", "value"], name="uniq_product_variant"),
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

    def _normalize_value(self, raw: str) -> str:
        """Normalize user input to our canonical storage."""
        if raw is None:
            return ""
        v = str(raw).strip()
        if not v:
            return ""
        # Keep sizes and frame sizes as-is (upper for size, exact for WxH)
        if "x" in v.lower():
            return v.lower().replace(" ", "")
        return v.upper()

    def clean(self):
        category_key = self._normalized_category_key()
        derived_kind = self.CATEGORY_TO_KIND.get(category_key, self.Kind.GENERIC)

        # Always keep kind aligned with category.
        self.kind = derived_kind

        # Enforce value rules by category.
        if derived_kind == self.Kind.SIZE:
            normalized = self._normalize_value(self.value)
            if not normalized:
                raise ValidationError({"value": "Para Camisetas, la talla es obligatoria (S/M/L/XL/2XL)."})
            if normalized not in self.TSHIRT_SIZES:
                raise ValidationError({"value": "Talla inválida. Usa: S, M, L, XL, 2XL."})
            self.value = normalized

        elif derived_kind == self.Kind.MEASURE:
            normalized = self._normalize_value(self.value)
            if not normalized:
                raise ValidationError({"value": "Para Cuadros, la medida es obligatoria (20x30/30x40/40x50)."})
            if normalized not in self.FRAME_SIZES:
                raise ValidationError({"value": "Medida inválida. Usa: 20x30, 30x40, 40x50."})
            self.value = normalized

        elif derived_kind == self.Kind.MUG_TYPE:
            normalized = self._normalize_value(self.value)
            if not normalized:
                raise ValidationError({"value": "Para Mugs, el tipo es obligatorio (Blanco/Colores/Mágico)."})
            if normalized not in self.MUG_TYPES:
                raise ValidationError({"value": "Tipo inválido. Usa: Blanco, Colores, Mágico."})
            self.value = normalized

        else:
            # Generic variants: allow empty value (some products may not use variants).
            # If a value is provided, normalize basic whitespace.
            if self.value is not None:
                v = str(self.value).strip()
                self.value = v if v else None

    def __str__(self) -> str:
        if self.value:
            return f"{self.product.name} - {self.get_kind_display()}: {self.value}"
        return f"{self.product.name} (sin variante)"