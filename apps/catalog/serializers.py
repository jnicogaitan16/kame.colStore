"""
Serializers para la API del catálogo (DRF).
Incluyen imágenes con URL absoluta y orden primary + gallery.
"""

from rest_framework import serializers
from imagekit.cachefiles import ImageCacheFile
from django.conf import settings


from .models import (
    Category,
    Department,
    HomepageBanner,
    HomepageSection,
    HomepagePromo,
    Product,
    ProductImage,
    ProductColorImage,
    ProductVariant,
)

from .services.inventory import get_pool_map, get_variant_available_stock
from .variant_rules import sort_variant_values


def public_media_url(value, request=None):
    """Construye una URL pública absoluta para cualquier ImageField/path.

    Reglas:
    1) Si value ya es http(s):// -> devolver tal cual
    2) Si value es path relativo (/media/... o products/...) -> prefijar con settings.R2_PUBLIC_BASE_URL si existe
    3) En dev/local, si no hay R2_PUBLIC_BASE_URL pero hay request -> request.build_absolute_uri(value)
    """

    if not value:
        return None

    # ImageField / FieldFile
    try:
        url = value.url
    except Exception:
        url = str(value)

    if not url:
        return None

    if url.startswith("http://") or url.startswith("https://"):
        return url

    base = (getattr(settings, "R2_PUBLIC_BASE_URL", "") or "").rstrip("/")

    if base:
        if not url.startswith("/"):
            url = f"/{url}"
        return f"{base}{url}"

    if request is not None:
        try:
            return request.build_absolute_uri(url)
        except Exception:
            return url

    return url


def _absolute_uri(request, url):
    # Compat wrapper
    return public_media_url(url, request=request)


def _spec_url(obj, spec_attr: str):
    """Retorna URL del spec solo si el cachefile ya existe.

    Política de lectura optimizada:
    - NO forzar `generate()` en serialización.
    - Intentar usar la URL del spec/cachefile si ya existe.
    - Verificar existencia en storage cuando sea posible.
    - Si el derivado no existe o algo falla, retornar None para fallback al original.
    """
    try:
        spec = getattr(obj, spec_attr, None)
        if not spec:
            return None

        # Intentar resolver el cachefile sin generarlo
        try:
            cachefile = ImageCacheFile(spec)
            url = getattr(cachefile, "url", None)
            if not url:
                return None

            storage = getattr(cachefile, "storage", None)
            name = getattr(cachefile, "name", None)
            exists = getattr(storage, "exists", None) if storage else None
            if callable(exists) and name and not exists(name):
                return None

            return url
        except Exception:
            # Fallback: si spec ya expone url, úsala solo si el archivo existe
            url = getattr(spec, "url", None)
            if not url:
                return None

            storage = getattr(spec, "storage", None)
            name = getattr(spec, "name", None)
            exists = getattr(storage, "exists", None) if storage else None
            if callable(exists) and name and not exists(name):
                return None

            return url
    except Exception:
        return None




# --- POOL MAP CACHE HELPER ---
def _pool_map_cached(category_id: int, ctx: dict) -> dict:
    """Cache get_pool_map per-category inside serializer context."""
    cache = ctx.setdefault("_pool_maps_by_category", {})
    cid = int(category_id or 0)
    if cid <= 0:
        return {}
    if cid not in cache:
        cache[cid] = get_pool_map(cid)
    return cache[cid]


def _effective_inventory_from_pool(category_id: int, variants_qs_or_list):
    """Fuente de verdad de inventario efectivo desde InventoryPool.

    Contrato:
    - Variant.stock se calcula desde InventoryPool (no ProductVariant.stock legacy)
    - sold_out: boolean real
    - stock_total: NO sumar (puede inflar).
      Usamos: max(stock_variants) o 0.

    Retorna:
    - stock_total (int)
    - sold_out (bool)
    - pool_map (dict)
    """
    pool_map = _pool_map_cached(category_id, {}) if variants_qs_or_list is None else None
    # Prefer using serializer context cache when possible (caller can pass ctx via setattr)
    ctx = getattr(variants_qs_or_list, "_serializer_ctx", None) if hasattr(variants_qs_or_list, "__class__") else None
    if isinstance(ctx, dict):
        pool_map = _pool_map_cached(category_id, ctx)
    if pool_map is None:
        pool_map = get_pool_map(int(category_id or 0))

    max_stock = 0
    for v in variants_qs_or_list:
        try:
            is_active = bool(getattr(v, "is_active", False))
        except Exception:
            is_active = False
        if not is_active:
            continue

        try:
            available = int(get_variant_available_stock(v, pool_map=pool_map) or 0)
        except Exception:
            available = 0

        if available > max_stock:
            max_stock = available

    sold_out = max_stock <= 0
    return max_stock, sold_out, pool_map



# ---------------------------------------------------------------------------
# Department
# ---------------------------------------------------------------------------
class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name", "slug", "sort_order"]


# ---------------------------------------------------------------------------
# Category
# ---------------------------------------------------------------------------
class CategorySerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)

    class Meta:
        model = Category
        fields = ["id", "name", "slug", "sort_order", "is_active", "variant_schema", "department"]


# Lightweight serializer for menu categories (no nested department)
class CategoryMenuSerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "sort_order"]


# Department + categories[] (only active) for menu

class DepartmentWithCategoriesSerializer(serializers.ModelSerializer):
    categories = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ["id", "name", "slug", "sort_order", "categories"]

    def get_categories(self, obj):
        qs = obj.categories.filter(is_active=True).order_by("sort_order", "name")
        return CategoryMenuSerializer(qs, many=True, context=self.context).data


# ---------------------------------------------------------------------------
# Navigation serializers (departments + categories) for GET /api/navigation/
# Lightweight: no products.
# ---------------------------------------------------------------------------
class NavCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "slug", "sort_order")


class NavDepartmentSerializer(serializers.ModelSerializer):
    categories = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ("id", "name", "slug", "sort_order", "categories")

    def get_categories(self, obj):
        # Only active categories and consistently ordered for navigation
        qs = obj.categories.filter(is_active=True).order_by("sort_order", "name")
        return NavCategorySerializer(qs, many=True, context=self.context).data


# ---------------------------------------------------------------------------
# Product image (URL absoluta, orden: is_primary primero, luego sort_order)
# ---------------------------------------------------------------------------

class ProductImageSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    image_thumb_url = serializers.SerializerMethodField()
    image_medium_url = serializers.SerializerMethodField()
    image_large_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = [
            "id",
            "image",
            "image_thumb_url",
            "image_medium_url",
            "image_large_url",
            "alt_text",
            "is_primary",
            "sort_order",
        ]

    def get_image(self, obj):
        """Devuelve SIEMPRE la URL pública final (cachefile/webp) si es posible.

        Orden:
        1) cachefile (image_large -> image_medium -> image_thumb)
        2) fallback: original URL pública (último recurso)
        """
        if not obj.image:
            return None

        request = self.context.get("request")

        cache_url = (
            _spec_url(obj, "image_large")
            or _spec_url(obj, "image_medium")
            or _spec_url(obj, "image_thumb")
        )

        return public_media_url(cache_url or obj.image.url, request=request)

    def get_image_thumb_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return public_media_url(_spec_url(obj, "image_thumb"), request=request)

    def get_image_medium_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return public_media_url(_spec_url(obj, "image_medium"), request=request)

    def get_image_large_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return public_media_url(_spec_url(obj, "image_large"), request=request)



class ProductColorImageSerializer(serializers.ModelSerializer):
    color = serializers.CharField(read_only=True)
    image = serializers.SerializerMethodField()
    image_thumb_url = serializers.SerializerMethodField()
    image_medium_url = serializers.SerializerMethodField()
    image_large_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductColorImage
        fields = [
            "id",
            "color",
            "image",
            "image_thumb_url",
            "image_medium_url",
            "image_large_url",
            "alt_text",
            "is_primary",
            "sort_order",
        ]

    def get_image(self, obj):
        if not obj.image:
            return None

        request = self.context.get("request")
        cache_url = (
            _spec_url(obj, "image_large")
            or _spec_url(obj, "image_medium")
            or _spec_url(obj, "image_thumb")
        )
        return public_media_url(cache_url or obj.image.url, request=request)

    def get_image_thumb_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return public_media_url(_spec_url(obj, "image_thumb"), request=request)

    def get_image_medium_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return public_media_url(_spec_url(obj, "image_medium"), request=request)

    def get_image_large_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return public_media_url(_spec_url(obj, "image_large"), request=request)



def _resolve_variant_gallery_images(variant):
    """Resuelve la galería efectiva de una variante sin cambiar el contrato API.

    Reglas:
    - SIZE_COLOR: usar ProductColorImage por product + color.
    - Fallback: ProductImage legacy por variante si no hay imágenes por color.
    - Otros schemas: mantener ProductImage legacy por variante.
    """
    product = getattr(variant, "product", None)
    category = getattr(product, "category", None) if product else None
    schema = getattr(category, "variant_schema", "") if category else ""

    if schema == Category.VariantSchema.SIZE_COLOR:
        color = getattr(variant, "color", "") or ""
        color_images = ProductColorImage.objects.filter(
            product=product,
            color=color,
        ).order_by("-is_primary", "sort_order", "created_at")
        if color_images.exists():
            return color_images, "color"

    legacy_images = variant.images.all().order_by("-is_primary", "sort_order", "created_at")
    return legacy_images, "legacy"



# ---------------------------------------------------------------------------
# Variant (con imágenes ordenadas: primary + gallery)
# ---------------------------------------------------------------------------
class ProductVariantSerializer(serializers.ModelSerializer):
    images = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    image_thumb_url = serializers.SerializerMethodField()

    # Fuente de verdad: InventoryPool.
    # Se mantiene variant.stock = get_variant_available_stock(...)
    stock = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = [
            "id",
            "value",
            "color",
            "stock",
            "is_active",
            "image_url",
            "image_thumb_url",
            "images",
        ]

    def get_stock(self, obj):
        pool_map = self.context.get("pool_map")
        try:
            return int(get_variant_available_stock(obj, pool_map=pool_map) or 0)
        except Exception:
            return 0

    def get_images(self, obj):
        qs, source = _resolve_variant_gallery_images(obj)
        serializer_class = ProductColorImageSerializer if source == "color" else ProductImageSerializer
        return serializer_class(qs, many=True, context=self.context).data

    def get_image_url(self, obj):
        qs, _source = _resolve_variant_gallery_images(obj)
        img = qs.first()
        if not img or not img.image:
            return None
        request = self.context.get("request")
        cache_url = _spec_url(img, "image_large") or _spec_url(img, "image_medium")
        return public_media_url(cache_url or img.image.url, request=request)

    def get_image_thumb_url(self, obj):
        qs, _source = _resolve_variant_gallery_images(obj)
        img = qs.first()
        if not img or not img.image:
            return None

        request = self.context.get("request")
        cache_url = _spec_url(img, "image_thumb")
        if cache_url:
            return public_media_url(cache_url, request=request)

        # Fallback limpio al original sin forzar generación
        return self.get_image_url(obj)


# ---------------------------------------------------------------------------
# Product list (para GET /api/products/)
# ---------------------------------------------------------------------------

class ProductListSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    primary_image = serializers.SerializerMethodField()
    stock_total = serializers.SerializerMethodField()
    sold_out = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "slug",
            "price",
            "stock_total",
            "sold_out",
            "category",
            "primary_image",
            "is_active",
        ]

    def get_primary_image(self, obj):
        """Imagen principal para cards/listados.

        Prioridad:
        1) SIZE_COLOR -> ProductColorImage del producto
        2) fallback legacy -> ProductImage por variante
        """
        request = self.context.get("request")
        schema = getattr(getattr(obj, "category", None), "variant_schema", "")

        if schema == Category.VariantSchema.SIZE_COLOR:
            color_img = (
                ProductColorImage.objects.filter(product=obj)
                .order_by("-is_primary", "sort_order", "created_at")
                .first()
            )
            if color_img and color_img.image:
                cache_url = _spec_url(color_img, "image_medium") or _spec_url(color_img, "image_thumb")
                return public_media_url(cache_url or color_img.image.url, request=request)

        img = (
            ProductImage.objects.filter(variant__product=obj)
            .order_by("-is_primary", "sort_order", "created_at")
            .first()
        )
        if not img or not img.image:
            return None

        cache_url = _spec_url(img, "image_medium") or _spec_url(img, "image_thumb")
        return public_media_url(cache_url or img.image.url, request=request)

    def get_stock_total(self, obj):
        variants = obj.variants.filter(is_active=True)
        # Attach serializer context for caching inside helper
        try:
            setattr(variants, "_serializer_ctx", self.context)
        except Exception:
            pass

        stock_total, sold_out, pool_map = _effective_inventory_from_pool(obj.category_id, variants)
        # Cache on serializer instance to avoid recomputing for sold_out
        cache = getattr(self, "_product_inventory_cache", None)
        if cache is None:
            cache = {}
            setattr(self, "_product_inventory_cache", cache)
        cache[obj.id] = (stock_total, sold_out)
        return stock_total

    def get_sold_out(self, obj):
        cache = getattr(self, "_product_inventory_cache", None) or {}
        if obj.id in cache:
            _stock_total, sold_out = cache[obj.id]
            return bool(sold_out)

        variants = obj.variants.filter(is_active=True)
        try:
            setattr(variants, "_serializer_ctx", self.context)
        except Exception:
            pass

        _stock_total, sold_out, _pool_map = _effective_inventory_from_pool(obj.category_id, variants)
        return bool(sold_out)


 # ---------------------------------------------------------------------------
# Product detail (producto + variantes + imágenes)
#
# Contrato PDP:
# - variants[] expone las variantes activas materializadas desde ProductVariant
# - variant.stock sigue saliendo de InventoryPool vía get_variant_available_stock
# - stock_total y sold_out se calculan desde InventoryPool
#
# Resultado esperado por schema:
# - SIZE_COLOR -> variantes tipo ("L", "Negro"), ("L", "Blanco"), ("M", "Negro")
# - JEAN_SIZE -> variantes tipo ("30", ""), ("32", ""), ("34", "")
# - SHOE_SIZE -> variantes tipo ("36", "") ... ("42", "")
# - NO_VARIANT -> una sola variante técnica ("", "")
# ---------------------------------------------------------------------------

class ProductDetailSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    variants = serializers.SerializerMethodField()
    stock_total = serializers.SerializerMethodField()
    sold_out = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "price",
            "category",
            "is_active",
            "stock_total",
            "sold_out",
            "created_at",
            "updated_at",
            "variants",
        ]

    def get_variants(self, obj):
        # No exponer variantes inactivas/eliminadas en la API.
        # La PDP recibe variants[] exactamente como estén materializadas
        # en ProductVariant según el schema de la categoría.
        variants = list(obj.variants.filter(is_active=True))
        category_slug = getattr(obj.category, "slug", None)

        ordered_values = sort_variant_values(
            [getattr(v, "value", "") for v in variants],
            category_slug,
        )
        value_order_map = {value: index for index, value in enumerate(ordered_values)}

        variants.sort(
            key=lambda v: (
                value_order_map.get(getattr(v, "value", ""), 9999),
                getattr(v, "color", "") or "",
                getattr(v, "id", 0),
            )
        )

        pool_map = get_pool_map(obj.category_id)
        ctx = dict(self.context)
        ctx["pool_map"] = pool_map
        return ProductVariantSerializer(variants, many=True, context=ctx).data

    def get_stock_total(self, obj):
        variants = obj.variants.filter(is_active=True)
        try:
            setattr(variants, "_serializer_ctx", self.context)
        except Exception:
            pass

        # stock_total / sold_out siguen saliendo de InventoryPool,
        # independiente del schema de variantes expuesto en PDP.
        stock_total, sold_out, _pool_map = _effective_inventory_from_pool(obj.category_id, variants)
        cache = getattr(self, "_product_inventory_cache", None)
        if cache is None:
            cache = {}
            setattr(self, "_product_inventory_cache", cache)
        cache[obj.id] = (stock_total, sold_out)
        return stock_total

    def get_sold_out(self, obj):
        cache = getattr(self, "_product_inventory_cache", None) or {}
        if obj.id in cache:
            _stock_total, sold_out = cache[obj.id]
            return bool(sold_out)

        variants = obj.variants.filter(is_active=True)
        try:
            setattr(variants, "_serializer_ctx", self.context)
        except Exception:
            pass

        _stock_total, sold_out, _pool_map = _effective_inventory_from_pool(obj.category_id, variants)
        return bool(sold_out)


# ---------------------------------------------------------------------------
# Homepage banners (hero)
# ---------------------------------------------------------------------------
class HomepageBannerSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    image_thumb_url = serializers.SerializerMethodField()
    image_medium_url = serializers.SerializerMethodField()
    image_large_url = serializers.SerializerMethodField()

    class Meta:
        model = HomepageBanner
        fields = [
            "id",
            "title",
            "subtitle",
            "description",
            "show_text",
            "image",
            "image_thumb_url",
            "image_medium_url",
            "image_large_url",
            "alt_text",
            "cta_label",
            "cta_url",
            "sort_order",
        ]

    def get_image(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return public_media_url(
            _spec_url(obj, "image_hero")
            or _spec_url(obj, "image_large")
            or obj.image.url,
            request=request,
        )

    def get_image_thumb_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return public_media_url(_spec_url(obj, "image_thumb"), request=request)

    def get_image_medium_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return public_media_url(_spec_url(obj, "image_medium"), request=request)

    def get_image_large_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return public_media_url(_spec_url(obj, "image_large"), request=request)


# ---------------------------------------------------------------------------
# Homepage story / sections (editorial)
# ---------------------------------------------------------------------------
class HomepageStorySerializer(serializers.ModelSerializer):
    class Meta:
        model = HomepageSection
        fields = ["title", "subtitle", "content"]


# ---------------------------------------------------------------------------
# Homepage promos (cards / gallery)
# ---------------------------------------------------------------------------
class HomepagePromoSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    image_thumb_url = serializers.SerializerMethodField()
    image_medium_url = serializers.SerializerMethodField()
    image_large_url = serializers.SerializerMethodField()

    class Meta:
        model = HomepagePromo
        fields = [
            "id",
            "title",
            "subtitle",
            "show_text",
            "placement",
            "image",
            "image_thumb_url",
            "image_medium_url",
            "image_large_url",
            "alt_text",
            "cta_label",
            "cta_url",
            "sort_order",
        ]

    def get_image(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return public_media_url(
            _spec_url(obj, "image_card")
            or _spec_url(obj, "image_large")
            or obj.image.url,
            request=request,
        )

    def get_image_thumb_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return public_media_url(_spec_url(obj, "image_thumb"), request=request)

    def get_image_medium_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return public_media_url(_spec_url(obj, "image_medium"), request=request)

    def get_image_large_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return public_media_url(_spec_url(obj, "image_large"), request=request)
