from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Sum
import os
import uuid

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

    # SOLO LECTURA: el stock del producto se deriva de la suma del stock de sus variantes.
    # Se inicializa en 0 y se mantiene sincronizado.
    stock = models.PositiveIntegerField(default=0, editable=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "id"]

    def clean(self):
        super().clean()

        # En el admin "Add product", el Product aún no tiene PK y no puedes usar self.variants.
        # Además, los inlines todavía no están guardados, así que validar stock aquí sería incorrecto.
        if not self.pk:
            return

        # Stock source of truth is ProductVariant. Do not allow active products with no stock.
        if self.is_active and self.total_stock <= 0:
            raise ValidationError(
                {"is_active": "No puedes activar un producto sin stock disponible en sus variantes."}
            )

    @property
    def total_stock(self) -> int:
        """Stock real (suma de stock de variantes activas)."""
        if not self.pk:
            return 0
        agg = self.variants.filter(is_active=True).aggregate(total=Sum("stock"))
        return int(agg["total"] or 0)

    @property
    def variants_stock_total(self) -> int:
        """Alias retrocompatible usado por el admin."""
        return self.total_stock

    def save(self, *args, **kwargs):
        # Stock en Product es SOLO LECTURA (derivado de variantes)
        if not self.pk:
            self.stock = 0
        else:
            self.stock = self.total_stock
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


def product_image_upload_path(instance, filename):
    """Generate upload path for product variant images with unique filenames."""
    ext = os.path.splitext(filename)[1].lower()
    variant_id = instance.variant.id if instance.variant_id else "unknown"
    product_id = instance.variant.product.id if instance.variant_id else "unknown"
    return f"products/{product_id}/variants/{variant_id}/{uuid.uuid4().hex}{ext}"


def homepage_banner_upload_path(instance, filename):
    """Generate upload path for homepage hero banners."""
    ext = os.path.splitext(filename)[1].lower()
    return f"homepage_banners/{uuid.uuid4().hex}{ext}"


def homepage_banner_upload_path(instance, filename):
  """Upload path for homepage hero banners."""
  ext = os.path.splitext(filename)[1].lower()
  return f"homepage_banners/{uuid.uuid4().hex}{ext}"


class ProductImage(models.Model):
    """Modelo para almacenar imágenes de variantes de productos.
    
    Las imágenes están vinculadas a ProductVariant para permitir imágenes específicas
    por color/talla. Esto mejora la UX al mostrar exactamente el producto que el cliente
    está comprando (ej: camiseta roja vs camiseta azul).
    """
    
    # Límites de validación
    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
    
    variant = models.ForeignKey(
        'ProductVariant',
        on_delete=models.CASCADE,
        related_name="images",
        help_text="Variante del producto a la que pertenece esta imagen"
    )
    image = models.ImageField(upload_to=product_image_upload_path)
    alt_text = models.CharField(
        max_length=200,
        blank=True,
        help_text="Texto alternativo para accesibilidad y SEO (ej: 'Camiseta roja talla M')"
    )
    is_primary = models.BooleanField(
        default=False,
        help_text="Marcar como imagen principal/portada de esta variante"
    )
    sort_order = models.PositiveIntegerField(
        default=0,
        help_text="Orden de visualización (menor = primero)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ["sort_order", "is_primary", "created_at"]
        verbose_name = "Imagen de variante"
        verbose_name_plural = "Imágenes de variantes"
    
    def clean(self):
        super().clean()
        
        # Validar tamaño del archivo
        if self.image:
            if hasattr(self.image, 'size') and self.image.size:
                if self.image.size > self.MAX_FILE_SIZE:
                    raise ValidationError(
                        {"image": f"El archivo es demasiado grande. Tamaño máximo: {self.MAX_FILE_SIZE / (1024 * 1024):.1f}MB"}
                    )
            
            # Validar extensión
            ext = os.path.splitext(self.image.name)[1].lower()
            if ext not in self.ALLOWED_EXTENSIONS:
                raise ValidationError(
                    {"image": f"Formato no permitido. Formatos permitidos: {', '.join(self.ALLOWED_EXTENSIONS)}"}
                )
        
        # Validar que solo haya una imagen primaria por variante
        if self.is_primary and self.variant_id:
            existing_primary = ProductImage.objects.filter(
                variant_id=self.variant_id,
                is_primary=True
            ).exclude(pk=self.pk)
            if existing_primary.exists():
                raise ValidationError(
                    {"is_primary": "Ya existe una imagen marcada como principal para esta variante."}
                )
    
    def save(self, *args, **kwargs):
        # Validar antes de guardar
        self.full_clean()
        
        # Si es la primera imagen y no hay primaria, marcarla como primaria
        if not self.pk and self.variant_id:
            if not ProductImage.objects.filter(variant_id=self.variant_id, is_primary=True).exists():
                self.is_primary = True
        
        super().save(*args, **kwargs)
        
        # Optimizar imagen si es necesario (opcional, requiere Pillow)
        if self.image:
            try:
                from PIL import Image as PILImage
                img = PILImage.open(self.image.path)
                # Convertir RGBA a RGB si es necesario (para JPEG)
                if img.mode in ('RGBA', 'LA', 'P'):
                    rgb_img = PILImage.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    rgb_img.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                    img = rgb_img
                
                # Guardar optimizado (solo si es JPEG/PNG)
                if img.format in ('JPEG', 'PNG'):
                    img.save(self.image.path, optimize=True, quality=85)
            except Exception:
                # Si falla la optimización, continuar sin error
                pass
    
    @property
    def product(self):
        """Acceso directo al producto desde la imagen (conveniencia)."""
        return self.variant.product if self.variant_id else None
    
    def __str__(self) -> str:
        if self.variant_id:
            variant_str = str(self.variant)
            return f"{variant_str} - Imagen {self.id}"
        return f"Imagen {self.id}"


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


class HomepageBanner(models.Model):
    """Hero banners para la página principal (administrables desde el admin).

    Pensados para un carrusel horizontal tipo Skeleton.
    """

    title = models.CharField(max_length=150)
    subtitle = models.CharField(max_length=200, blank=True, default="")
    description = models.TextField(blank=True, default="")

    image = models.ImageField(upload_to=homepage_banner_upload_path)
    alt_text = models.CharField(max_length=200, blank=True, default="")

    cta_label = models.CharField(
        max_length=80,
        blank=True,
        default="",
        help_text="Texto del botón (por ejemplo, 'Ver colección').",
    )
    cta_url = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="URL relativa o absoluta a la que apunta el botón.",
    )

    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(
        default=0,
        help_text="Orden de aparición en el carrusel (menor = primero).",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "-created_at"]

    def __str__(self) -> str:
        return self.title