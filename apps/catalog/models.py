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

    @property
    def total_stock(self) -> int:
        """Stock real (suma de stock de variantes activas)."""
        agg = self.variants.filter(is_active=True).aggregate(total=Sum("stock"))
        return int(agg["total"] or 0)

    @property
    def variants_stock_total(self) -> int:
        """Alias retrocompatible usado por el admin."""
        return self.total_stock



CAMISETA_VALUES = ["S", "M", "L", "XL", "2XL"]

# Cuadros presets: labels -> canonical measure
CUADRO_PRESETS = {
    # labels -> canonical measure
    "pequeno": "20x30",
    "pequeño": "20x30",
    "mediano": "30x40",
    "grande": "40x50",
}

# For UI/readability you may want to show labels, but we store the canonical measure
# so existing logic (e.g., titles, comparisons) remains consistent.

class ProductVariant(models.Model):
    """A generic variant model.

    Requirements:
    - Camisetas: talla -> S/M/L/XL/2XL
    OrderItem should reference ProductVariant (handled in orders app).
    """

    # Backward-compatible alias used by admin/forms.
    TSHIRT_SIZES = CAMISETA_VALUES

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

    def _normalize_cuadro_value(self, raw: str) -> str:
        """Accepts either a measure (e.g. 20x30) or a preset label (e.g. Pequeño).

        Returns the canonical stored measure (e.g. 20x30) when a preset is provided.
        """
        if raw is None:
            return ""

        v = str(raw).strip()
        if not v:
            return ""

        key = v.strip().lower()
        # normalize common accent variants
        key = (
            key.replace("á", "a")
            .replace("é", "e")
            .replace("í", "i")
            .replace("ó", "o")
            .replace("ú", "u")
        )

        # Keep the original too, because we allow both 'pequeño' and 'pequeno'
        if key in CUADRO_PRESETS:
            return CUADRO_PRESETS[key]

        # If user typed with ñ, keep it handled as well
        if v.strip().lower() in CUADRO_PRESETS:
            return CUADRO_PRESETS[v.strip().lower()]

        return v

    def _normalize_value(self, raw: str) -> str:
        """Normalize user input to our canonical storage.

        Rules:
        - Sizes (e.g. S, M, L, XL, 2XL) -> uppercase
        - Measures written as WxH (e.g. 20x30, 30 x 40) -> lowercase 'wxh' without spaces
        - Anything else -> uppercase

        IMPORTANT:
        Do NOT treat values like '2XL' as a measure just because they contain an 'x'.
        """
        if raw is None:
            return ""

        v = str(raw).strip()
        if not v:
            return ""

        # Detect strict measurement pattern: <digits> x <digits>
        v_compact = v.replace(" ", "")
        parts = v_compact.lower().split("x")
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            return f"{int(parts[0])}x{int(parts[1])}"  # canonical: lowercase + no spaces

        return v.upper()

    def clean(self):
        super().clean()

        category_key = self._normalized_category_key()

        # Normaliza siempre ANTES de validar
        if self.value is not None:
            # Cuadros: permitir labels (Pequeño/Mediano/Grande) pero guardar medida canonical
            if category_key == "cuadros":
                self.value = self._normalize_cuadro_value(self.value)

            self.value = self._normalize_value(self.value)

        # Solo camisetas: valida talla
        if self.product and category_key == "camisetas":
            if self.value not in CAMISETA_VALUES:
                raise ValidationError({"value": "Talla inválida. Usa: S, M, L, XL, 2XL."})

        # 2) Evitar duplicado (mismo product+kind+value)
        if self.product_id and self.kind and self.value:
            exists = (
                type(self).objects
                .filter(product_id=self.product_id, kind=self.kind, value=self.value)
                .exclude(pk=self.pk)
                .exists()
            )
            if exists:
                raise ValidationError({"value": "Ya existe una variante con esta talla/valor para este producto."})

    def __str__(self) -> str:
        if self.value:
            return f"{self.product.name} - {self.get_kind_display()}: {self.value}"
        return f"{self.product.name} (sin variante)"