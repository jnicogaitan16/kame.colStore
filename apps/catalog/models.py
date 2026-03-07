from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Sum
from django.conf import settings
import os
import uuid

from django.utils.text import slugify

from imagekit.models import ImageSpecField
from imagekit.processors import ResizeToFit

from .variant_rules import get_variant_rule, normalize_variant_value, normalize_variant_color



class Department(models.Model):
    """Nivel 1 de navegación (Hombre / Mujer / Accesorios / Otros).

    E-commerce estándar: Department -> Category (árbol).
    """

    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True)

    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def _generate_unique_slug(self) -> str:
        base = slugify(self.name or "").strip("-")
        base = base or "department"
        slug = base
        i = 2
        while type(self).objects.filter(slug=slug).exclude(pk=self.pk).exists():
            slug = f"{base}-{i}"
            i += 1
        return slug

    def save(self, *args, **kwargs):
        # Autogenerar slug si viene vacío
        if not (self.slug or "").strip():
            self.slug = self._generate_unique_slug()
        return super().save(*args, **kwargs)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name


class Category(models.Model):
    """Categorías en árbol (nivel 2/3/etc) colgadas de un Department.

    Ej:
    - Hombre > Ropa > Camisetas
    - Mujer > Camisetas

    Nota de migración:
    - `department` se deja nullable inicialmente para facilitar migraciones.
      Luego puedes hacerlo NOT NULL cuando ya tengas data poblada.
    """

    class VariantSchema(models.TextChoices):
        SIZE_COLOR = "size_color", "Talla + Color"
        JEAN_SIZE = "jean_size", "Talla Jean"
        SHOE_SIZE = "shoe_size", "Talla Zapatilla"
        NO_VARIANT = "no_variant", "Sin variantes"

    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140)

    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name="categories",
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="children",
    )

    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    # Define cómo se comportan variantes en esta categoría.
    variant_schema = models.CharField(
        max_length=20,
        choices=VariantSchema.choices,
        default=VariantSchema.SIZE_COLOR,
        db_index=True,
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def _generate_unique_slug(self) -> str:
        base = slugify(self.name or "").strip("-")
        base = base or "category"
        slug = base
        i = 2
        qs = type(self).objects.all()
        # La constraint es (department, parent, slug)
        if self.department_id:
            qs = qs.filter(department_id=self.department_id)
        if self.parent_id:
            qs = qs.filter(parent_id=self.parent_id)
        else:
            qs = qs.filter(parent__isnull=True)

        while qs.filter(slug=slug).exclude(pk=self.pk).exists():
            slug = f"{base}-{i}"
            i += 1
        return slug

    def save(self, *args, **kwargs):
        # Autogenerar slug si viene vacío
        if not (self.slug or "").strip():
            self.slug = self._generate_unique_slug()
        return super().save(*args, **kwargs)

    class Meta:
        ordering = ["sort_order", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["department", "parent", "slug"],
                name="uniq_category_department_parent_slug",
            ),
        ]

    def __str__(self) -> str:
        if self.department_id:
            return f"{self.department.name} / {self.name}"
        return self.name

    @property
    def is_leaf(self) -> bool:
        return not self.children.exists()



class Product(models.Model):
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")  # debe ser leaf

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)

    description = models.TextField(blank=True)

    price = models.DecimalField(max_digits=10, decimal_places=2)

    is_active = models.BooleanField(default=True)

    # LEGACY / SOLO LECTURA: mantenido para no romper admin/serializers.
    # En el modelo nuevo, la verdad de stock vive en InventoryPool (pool global por base).
    # Este campo puede reflejar un agregado del pool para la categoría del producto.
    stock = models.PositiveIntegerField(default=0, editable=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "id"]

    def clean(self):
        super().clean()

        # En el admin "Add product", el Product aún no tiene PK.
        if not self.category_id:
            return

        # El producto debe apuntar a una categoría leaf (sin hijos).
        if self.category and self.category.children.exists():
            raise ValidationError({
                "category": "Selecciona una categoría final (leaf). No puede tener subcategorías."  # noqa: E501
            })

        # Si está activo, debe haber stock disponible (derivado del InventoryPool).
        if self.is_active and self.total_stock <= 0:
            raise ValidationError({
                "is_active": "No puedes activar un producto sin stock disponible (InventoryPool)."
            })

    @property
    def total_stock(self) -> int:
        """Stock real agregado desde InventoryPool para la categoría del producto.

        Ojo: al ser un pool global, este stock NO es exclusivo del producto/diseño;
        es la disponibilidad de la base en esa categoría.
        """
        if not self.category_id:
            return 0
        agg = InventoryPool.objects.filter(
            category_id=self.category_id,
            is_active=True,
        ).aggregate(total=Sum("quantity"))
        return int(agg["total"] or 0)

    def get_stock_total(self) -> int:
        """Fuente de verdad del stock del producto (suma de variantes activas).

        Útil para reuso en serializers/admin/servicios sin duplicar lógica.
        """
        return self.total_stock

    @property
    def stock_total_calc(self) -> int:
        """Alias explícito para consumir el stock calculado desde variantes activas."""
        return self.total_stock

    @property
    def variants_stock_total(self) -> int:
        """Alias retrocompatible usado por el admin."""
        return self.total_stock

    def save(self, *args, **kwargs):
        # Mantener campo legacy sincronizado con agregado del pool.
        self.stock = self.total_stock
        return super().save(*args, **kwargs)
class InventoryPool(models.Model):
    """Fuente de verdad de inventario (pool global por base).

    Ejemplos:
    - Camisetas / Negro / S = 12
    - Jean / 32 (color vacío) = 5

    El checkout debe descontar SIEMPRE de este pool.
    """

    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="inventory_pools",
        help_text="Categoría leaf (Camisetas/Hoodies/Jean/etc).",
    )

    value = models.CharField(max_length=32, blank=True, default="")
    color = models.CharField(max_length=32, blank=True, default="")

    quantity = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category__name", "value", "color", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["category", "value", "color"],
                name="uniq_inventorypool_category_value_color",
            ),
        ]

    def clean(self):
        super().clean()

        # Debe ser leaf para evitar pools ambiguos.
        if self.category_id and self.category.children.exists():
            raise ValidationError({
                "category": "InventoryPool debe apuntar a una categoría final (leaf)."
            })

        # Última capa de seguridad:
        # aunque el admin use dropdowns, aquí seguimos normalizando para cubrir
        # bulk load, scripts, shell, APIs y futuros cambios.
        self.value = normalize_variant_value(self.value) or ""
        self.color = normalize_variant_color(self.color) or ""

    def __str__(self) -> str:
        parts = [self.category.name]
        if self.value:
            parts.append(self.value)
        if self.color:
            parts.append(self.color)
        return " / ".join(parts) + f" = {self.quantity}"



def product_image_upload_path(instance, filename):
    """Generate upload path for product variant images with unique filenames."""
    ext = os.path.splitext(filename)[1].lower()
    variant_id = instance.variant.id if instance.variant_id else "unknown"
    product_id = instance.variant.product.id if instance.variant_id else "unknown"
    return f"products/{product_id}/variants/{variant_id}/{uuid.uuid4().hex}{ext}"


def product_color_image_upload_path(instance, filename):
    """Generate upload path for product color images with unique filenames."""
    ext = os.path.splitext(filename)[1].lower()
    product_id = instance.product.id if instance.product_id else "unknown"
    color_normalized = normalize_variant_color(instance.color) or "no-color"
    return f"products/{product_id}/colors/{color_normalized}/{uuid.uuid4().hex}{ext}"


def homepage_banner_upload_path(instance, filename):
    """Generate upload path for homepage hero banners."""
    ext = os.path.splitext(filename)[1].lower()
    return f"homepage_banners/{uuid.uuid4().hex}{ext}"

def homepage_promo_upload_path(instance, filename):
    """Generate upload path for homepage promo cards."""
    ext = os.path.splitext(filename)[1].lower()
    return f"homepage_promos/{uuid.uuid4().hex}{ext}"


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

    # Derivados optimizados (no alteran el original). Generan WebP bajo demanda.
    # Objetivo:
    # - Catálogo: thumbnail liviano
    # - Detalle (PDP): tamaño "detail" con buena calidad/peso
    # - Large queda disponible para zoom/futuro, pero sigue siendo WebP y CDN-friendly
    image_thumb = ImageSpecField(
        source="image",
        processors=[ResizeToFit(420, 420)],
        format="WEBP",
        # Más liviano para catálogo/listados
        options={"quality": 75},
    )
    image_medium = ImageSpecField(
        source="image",
        # Tamaño detail recomendado para PDP
        processors=[ResizeToFit(1200, 1200)],
        format="WEBP",
        options={"quality": 78},
    )
    image_large = ImageSpecField(
        source="image",
        # Mantener un tamaño grande para zoom/futuro sin exagerar peso
        processors=[ResizeToFit(1600, 1600)],
        format="WEBP",
        options={"quality": 78},
    )

    @property
    def image_thumb_url(self) -> str:
        return getattr(self.image_thumb, 'url', '') if self.image else ''

    @property
    def image_medium_url(self) -> str:
        return getattr(self.image_medium, 'url', '') if self.image else ''

    @property
    def image_large_url(self) -> str:
        return getattr(self.image_large, 'url', '') if self.image else ''
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

        # Optimizar imagen original post-save (opcional).
        # Deshabilitado por defecto para no interferir con ImageKit (CACHE) mientras aislamos issues.
        # Para habilitarlo, define en settings:
        #   ENABLE_PRODUCTIMAGE_POSTSAVE_OPTIMIZATION = True
        if self.image and getattr(settings, "ENABLE_PRODUCTIMAGE_POSTSAVE_OPTIMIZATION", False):
            try:
                from PIL import Image as PILImage

                img = PILImage.open(self.image.path)

                # Convertir RGBA a RGB si es necesario (para JPEG)
                if img.mode in ("RGBA", "LA", "P"):
                    rgb_img = PILImage.new("RGB", img.size, (255, 255, 255))
                    if img.mode == "P":
                        img = img.convert("RGBA")
                    rgb_img.paste(
                        img,
                        mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None,
                    )
                    img = rgb_img

                # Guardar optimizado (solo si es JPEG/PNG)
                if img.format in ("JPEG", "PNG"):
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



class ProductColorImage(models.Model):
    """Imagen reutilizable por color para un producto.

    Fuente principal para categorías apparel SIZE_COLOR, donde la galería
    depende de producto + color y no de producto + talla + color.
    ProductImage se mantiene como fallback legacy por variante.
    """

    MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
    ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="color_images",
        help_text="Producto al que pertenece esta imagen por color",
    )
    color = models.CharField(max_length=32, blank=False, default="")
    image = models.ImageField(upload_to=product_color_image_upload_path)

    image_thumb = ImageSpecField(
        source="image",
        processors=[ResizeToFit(420, 420)],
        format="WEBP",
        options={"quality": 75},
    )
    image_medium = ImageSpecField(
        source="image",
        processors=[ResizeToFit(1200, 1200)],
        format="WEBP",
        options={"quality": 78},
    )
    image_large = ImageSpecField(
        source="image",
        processors=[ResizeToFit(1600, 1600)],
        format="WEBP",
        options={"quality": 78},
    )

    alt_text = models.CharField(
        max_length=200,
        blank=True,
        help_text="Texto alternativo para accesibilidad y SEO (ej: 'Camiseta negra')",
    )
    is_primary = models.BooleanField(
        default=False,
        help_text="Marcar como imagen principal/portada para este producto y color",
    )
    sort_order = models.PositiveIntegerField(
        default=0,
        help_text="Orden de visualización (menor = primero)",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "is_primary", "created_at"]
        verbose_name = "Imagen por color"
        verbose_name_plural = "Imágenes por color"

    @property
    def image_thumb_url(self) -> str:
        return getattr(self.image_thumb, "url", "") if self.image else ""

    @property
    def image_medium_url(self) -> str:
        return getattr(self.image_medium, "url", "") if self.image else ""

    @property
    def image_large_url(self) -> str:
        return getattr(self.image_large, "url", "") if self.image else ""

    def clean(self):
        super().clean()

        self.color = normalize_variant_color(self.color) or ""

        if not self.color:
            raise ValidationError({"color": "Selecciona un color válido."})

        if self.product_id and self.product.category.variant_schema != Category.VariantSchema.SIZE_COLOR:
            raise ValidationError({
                "product": "ProductColorImage solo aplica a productos con esquema SIZE_COLOR."
            })

        if self.image:
            if hasattr(self.image, "size") and self.image.size:
                if self.image.size > self.MAX_FILE_SIZE:
                    raise ValidationError({
                        "image": f"El archivo es demasiado grande. Tamaño máximo: {self.MAX_FILE_SIZE / (1024 * 1024):.1f}MB"
                    })

            ext = os.path.splitext(self.image.name)[1].lower()
            if ext not in self.ALLOWED_EXTENSIONS:
                raise ValidationError({
                    "image": f"Formato no permitido. Formatos permitidos: {', '.join(self.ALLOWED_EXTENSIONS)}"
                })

        if self.is_primary and self.product_id and self.color:
            existing_primary = ProductColorImage.objects.filter(
                product_id=self.product_id,
                color=self.color,
                is_primary=True,
            ).exclude(pk=self.pk)
            if existing_primary.exists():
                raise ValidationError({
                    "is_primary": "Ya existe una imagen principal para este producto y color."
                })

    def save(self, *args, **kwargs):
        self.full_clean()

        if not self.pk and self.product_id and self.color:
            has_primary = ProductColorImage.objects.filter(
                product_id=self.product_id,
                color=normalize_variant_color(self.color) or "",
                is_primary=True,
            ).exists()
            if not has_primary:
                self.is_primary = True

        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        product_name = self.product.name if self.product_id else "Producto"
        color = self.color or "Sin color"
        return f"{product_name} / {color} - Imagen {self.id}"



class ProductVariant(models.Model):
    """Variante comprable de un producto (combinación de atributos).

    En el modelo nuevo:
    - El stock NO es fuente de verdad aquí (legacy). Se descuenta del InventoryPool.
    - La validez de atributos depende de `product.category.variant_schema`.
    """

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")

    # Atributos flexibles
    value = models.CharField(max_length=32, blank=True, default="")  # talla/numero/medida
    color = models.CharField(max_length=32, blank=True, default="")

    # LEGACY: mantenido para compatibilidad con admin y vistas actuales.
    # NO usar como fuente de verdad para descontar en checkout.
    stock = models.PositiveIntegerField(default=0)

    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["product", "value", "color"],
                name="uniq_product_variant_value_color",
            ),
        ]
        ordering = ["product__name", "value", "id"]

    def _schema(self) -> str:
        if not self.product_id or not getattr(self.product, "category", None):
            return Category.VariantSchema.SIZE_COLOR
        return getattr(self.product.category, "variant_schema", Category.VariantSchema.SIZE_COLOR)

    def clean(self):
        super().clean()

        schema = self._schema()

        normalized_value = normalize_variant_value(self.value) or ""
        normalized_color = normalize_variant_color(self.color) or ""

        if schema == Category.VariantSchema.NO_VARIANT:
            self.value = ""
            self.color = ""
            return

        if not normalized_value:
            raise ValidationError({"value": "Selecciona un valor de variante (talla/número)."})

        if schema == Category.VariantSchema.SIZE_COLOR:
            if not normalized_color:
                raise ValidationError({"color": "Selecciona un color."})
            self.value = normalized_value
            self.color = normalized_color

            try:
                slug = (getattr(self.product.category, "slug", "") or "").strip().lower()
                rule = get_variant_rule(slug)
                allowed_sizes = rule.get("allowed_values")
                if allowed_sizes and self.value not in allowed_sizes:
                    raise ValidationError({"value": f"Valor inválido. Usa: {', '.join(allowed_sizes)}."})
                allowed_colors = rule.get("allowed_colors")
                if allowed_colors and self.color not in allowed_colors:
                    raise ValidationError({"color": f"Color inválido. Usa: {', '.join(allowed_colors)}."})
            except Exception:
                pass

        elif schema == Category.VariantSchema.JEAN_SIZE:
            self.value = normalized_value
            self.color = ""

        elif schema == Category.VariantSchema.SHOE_SIZE:
            self.value = normalized_value
            self.color = ""

        else:
            raise ValidationError({"product": "Esquema de variante no soportado para este producto."})

        if self.product_id:
            exists = (
                type(self).objects
                .filter(product_id=self.product_id, value=self.value, color=self.color)
                .exclude(pk=self.pk)
                .exists()
            )
            if exists:
                raise ValidationError({
                    "value": "Ya existe una variante con este valor para este producto.",
                    "color": "Ya existe una variante con este valor/color para este producto.",
                })

    def __str__(self) -> str:
        schema = self._schema()
        if schema == Category.VariantSchema.NO_VARIANT:
            return f"{self.product.name}"
        color_part = f" / {self.color}" if (self.color or "").strip() else ""
        return f"{self.product.name} - {self.value}{color_part}"



class HomepageBanner(models.Model):
    """Hero banners para la página principal (administrables desde el admin).

    Pensados para un carrusel horizontal tipo Skeleton.
    """

    title = models.CharField(max_length=150, blank=True, default="")
    subtitle = models.CharField(max_length=200, blank=True, default="")
    description = models.TextField(blank=True, default="")

    show_text = models.BooleanField(
        default=True,
        help_text="Si se desactiva, no se muestran título/subtítulo/descripcion aunque existan.",
    )

    image = models.ImageField(upload_to=homepage_banner_upload_path)

    # Derivados optimizados (WebP) para servir en frontend sin usar el original.
    image_thumb = ImageSpecField(
        source='image',
        processors=[ResizeToFit(400, 400)],
        format='WEBP',
        options={'quality': 82},
    )
    image_medium = ImageSpecField(
        source='image',
        processors=[ResizeToFit(900, 900)],
        format='WEBP',
        options={'quality': 82},
    )
    image_large = ImageSpecField(
        source='image',
        processors=[ResizeToFit(1600, 1600)],
        format='WEBP',
        options={'quality': 82},
    )
    # Hero optimizado para Home (mejor balance peso/calidad)
    image_hero = ImageSpecField(
        source='image',
        processors=[ResizeToFit(1400, 1400)],
        format='WEBP',
        options={'quality': 75},
    )

    @property
    def image_hero_url(self) -> str:
        return getattr(self.image_hero, 'url', '') if self.image else ''

    @property
    def image_thumb_url(self) -> str:
        return getattr(self.image_thumb, 'url', '') if self.image else ''

    @property
    def image_medium_url(self) -> str:
        return getattr(self.image_medium, 'url', '') if self.image else ''

    @property
    def image_large_url(self) -> str:
        return getattr(self.image_large, 'url', '') if self.image else ''
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
        help_text="Usa una ruta relativa. Ej: /catalogo (NO uses http(s)://, localhost, 127.0.0.1, 192.168.x.x ni dominios .trycloudflare.com).",
    )

    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(
        default=0,
        help_text="Orden de aparición en el carrusel (menor = primero).",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        super().clean()

        # Enforce relative CTA URL to keep the frontend tunnel-safe (same-origin).
        # Allowed examples: "/catalogo", "/catalogo?x=1", "/".
        raw = (self.cta_url or "").strip()
        if not raw:
            self.cta_url = ""
            return

        lowered = raw.lower()
        # Block absolute URLs or host-based URLs.
        if lowered.startswith("http://") or lowered.startswith("https://"):
            raise ValidationError({
                "cta_url": "La URL del CTA debe ser relativa (ej: /catalogo). No uses http(s)://."
            })

        # Also block common host patterns even if the scheme is omitted.
        forbidden_markers = [
            "localhost",
            "127.0.0.1",
            "0.0.0.0",
            ".trycloudflare.com",
            "192.168.",
        ]
        if any(m in lowered for m in forbidden_markers):
            raise ValidationError({
                "cta_url": "La URL del CTA debe ser relativa (ej: /catalogo). No uses hosts/IPs."
            })

        # Normalize: ensure it starts with '/'
        if not raw.startswith("/"):
            raw = "/" + raw.lstrip()

        self.cta_url = raw

    class Meta:
        ordering = ["sort_order", "-created_at"]

    def __str__(self) -> str:
        return self.title


class HomepagePromo(models.Model):
    """Promos/cards para el Home (ej: identidad de marca, materiales, galería).

    Similar a HomepageBanner, pero pensado como tarjetas en una grilla o carrusel.
    """

    title = models.CharField(max_length=150, blank=True, default="")
    subtitle = models.CharField(max_length=200, blank=True, default="")

    show_text = models.BooleanField(
        default=True,
        help_text="Si se desactiva, no se muestran título/subtítulo aunque existan.",
    )

    class Placement(models.TextChoices):
        TOP = "TOP", "Top"
        MID = "MID", "Mid"

    placement = models.CharField(
        max_length=10,
        choices=Placement.choices,
        default=Placement.MID,
        db_index=True,
        help_text="Dónde se muestra esta promo en el Home (Top/Mid).",
    )

    image = models.ImageField(upload_to=homepage_promo_upload_path)

    # Derivados optimizados (WebP) para servir en frontend sin usar el original.
    image_thumb = ImageSpecField(
        source='image',
        processors=[ResizeToFit(400, 400)],
        format='WEBP',
        options={'quality': 82},
    )
    image_medium = ImageSpecField(
        source='image',
        processors=[ResizeToFit(900, 900)],
        format='WEBP',
        options={'quality': 82},
    )
    image_large = ImageSpecField(
        source='image',
        processors=[ResizeToFit(1600, 1600)],
        format='WEBP',
        options={'quality': 82},
    )
    # Promo optimizado (más liviano que hero)
    image_card = ImageSpecField(
        source='image',
        processors=[ResizeToFit(1000, 1000)],
        format='WEBP',
        options={'quality': 75},
    )

    @property
    def image_card_url(self) -> str:
        return getattr(self.image_card, 'url', '') if self.image else ''

    @property
    def image_thumb_url(self) -> str:
        return getattr(self.image_thumb, 'url', '') if self.image else ''

    @property
    def image_medium_url(self) -> str:
        return getattr(self.image_medium, 'url', '') if self.image else ''

    @property
    def image_large_url(self) -> str:
        return getattr(self.image_large, 'url', '') if self.image else ''
    alt_text = models.CharField(max_length=200, blank=True, default="")

    cta_label = models.CharField(
        max_length=80,
        blank=True,
        default="Ver más",
        help_text="Texto del CTA (por ejemplo, 'Ver más').",
    )
    cta_url = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Ruta relativa opcional (ej: /catalogo). Si está vacía, la tarjeta no tendrá link.",
    )

    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(
        default=1,
        help_text="Orden de aparición (menor = primero).",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "Promo de Home"
        verbose_name_plural = "Promos de Home"

    def __str__(self) -> str:
        return self.title or f"Promo #{self.pk or 'nuevo'}"


class HomepageSection(models.Model):
    """Secciones administrables del Home (ej: 'Así nació Kame.col').

    Permite manejar contenido editorial desde Django Admin sin hardcodear en el frontend.
    """

    key = models.SlugField(
        max_length=60,
        unique=True,
        help_text="Identificador único (ej: 'brand-story', 'about', 'shipping-info').",
    )
    title = models.CharField(max_length=150)
    subtitle = models.CharField(max_length=200, blank=True, default="")
    content = models.TextField(help_text="Contenido principal (texto largo).")

    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "-updated_at", "id"]
        verbose_name = "Sección de Home"
        verbose_name_plural = "Secciones de Home"

    def __str__(self) -> str:
        return f"{self.key} - {self.title}"