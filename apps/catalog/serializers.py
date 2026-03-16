"""
Serializers para la API del catálogo (DRF).
Incluyen imágenes con URL absoluta y orden primary + gallery.
"""

from rest_framework import serializers
from imagekit.cachefiles import ImageCacheFile

from django.conf import settings
from django.db.models import Exists, OuterRef


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
    """Retorna URL del spec solo si el derivado cacheado existe realmente.

    Política:
    - NO forzar `generate()` en serialización.
    - Verificar disponibilidad real del derivado antes de exponer su URL.
    - Memoizar por objeto/spec para evitar consultas repetidas dentro del mismo ciclo.
    - Si el derivado no existe o algo falla, retornar None para fallback al original.
    """
    try:
        cache = getattr(obj, "_resolved_spec_url_cache", None)
        if cache is None:
            cache = {}
            setattr(obj, "_resolved_spec_url_cache", cache)

        if spec_attr in cache:
            return cache[spec_attr]

        spec = getattr(obj, spec_attr, None)
        if not spec:
            cache[spec_attr] = None
            return None

        # Intentar resolver el cachefile sin generarlo y verificar existencia real.
        try:
            cachefile = ImageCacheFile(spec)
            storage = getattr(cachefile, "storage", None)
            name = getattr(cachefile, "name", None)
            if storage is not None and name:
                try:
                    if storage.exists(name):
                        url = getattr(cachefile, "url", None)
                        cache[spec_attr] = url or None
                        return cache[spec_attr]
                except Exception:
                    pass
        except Exception:
            pass

        cache[spec_attr] = None
        return None
    except Exception:
        return None


# New helper: _resolve_public_image_urls
def _resolve_public_image_urls(obj, request=None, primary_specs=None):
    """Resuelve una sola vez todas las URLs públicas relevantes de una imagen.

    `primary_specs` permite definir la prioridad del campo `image` público por tipo:
    - banners: ("image_hero", "image_large", "image_medium", "image_thumb")
    - promos: ("image_card", "image_large", "image_medium", "image_thumb")
    - default: ("image_large", "image_medium", "image_thumb")
    """
    if not getattr(obj, "image", None):
        return {
            "image": None,
            "image_thumb_url": None,
            "image_medium_url": None,
            "image_large_url": None,
        }

    spec_priority = tuple(primary_specs or ("image_large", "image_medium", "image_thumb"))
    resolved_priority = [_spec_url(obj, spec_attr) for spec_attr in spec_priority]

    thumb = _spec_url(obj, "image_thumb")
    medium = _spec_url(obj, "image_medium")
    large = _spec_url(obj, "image_large")

    primary_public = next((url for url in resolved_priority if url), None)
    original_public = public_media_url(obj.image.url, request=request)

    return {
        "image": public_media_url(primary_public, request=request) or original_public,
        "image_thumb_url": public_media_url(thumb, request=request),
        "image_medium_url": public_media_url(medium, request=request),
        "image_large_url": public_media_url(large, request=request),
    }




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
# Navigation queryset helpers
# ---------------------------------------------------------------------------
def _navigation_categories_qs_for_department(department: Department):
    """Categorías públicas de navegación para un department.

    Contrato de navegación pública:
    - Mantener separación estricta por department.
    - Solo categorías activas.
    - Orden consistente.
    - Exponer categorías leaf/finales para UX pública.
      (Ej: Camisetas, Hoodies, Cuadros, Regular fit)
    - No aplanar departments.
    - No mezclar categorías entre departments.
    """
    active_children = Category.objects.filter(
        parent_id=OuterRef("pk"),
        is_active=True,
    )

    return (
        Category.objects.filter(department=department, is_active=True)
        .annotate(has_active_children=Exists(active_children))
        .filter(has_active_children=False)
        .order_by("sort_order", "name", "id")
    )

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
        qs = _navigation_categories_qs_for_department(obj)
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

    def _get_resolved_urls(self, obj):
        cache = self.context.setdefault("_resolved_image_urls", {})
        key = (self.__class__.__name__, getattr(obj, "id", None))
        if key in cache:
            return cache[key]

        resolved = _resolve_public_image_urls(obj, request=self.context.get("request"))
        cache[key] = resolved
        return resolved

    def get_image(self, obj):
        return self._get_resolved_urls(obj)["image"]

    def get_image_thumb_url(self, obj):
        return self._get_resolved_urls(obj)["image_thumb_url"]

    def get_image_medium_url(self, obj):
        return self._get_resolved_urls(obj)["image_medium_url"]

    def get_image_large_url(self, obj):
        return self._get_resolved_urls(obj)["image_large_url"]



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

    def _get_resolved_urls(self, obj):
        cache = self.context.setdefault("_resolved_image_urls", {})
        key = (self.__class__.__name__, getattr(obj, "id", None))
        if key in cache:
            return cache[key]

        resolved = _resolve_public_image_urls(obj, request=self.context.get("request"))
        cache[key] = resolved
        return resolved

    def get_image(self, obj):
        return self._get_resolved_urls(obj)["image"]

    def get_image_thumb_url(self, obj):
        return self._get_resolved_urls(obj)["image_thumb_url"]

    def get_image_medium_url(self, obj):
        return self._get_resolved_urls(obj)["image_medium_url"]

    def get_image_large_url(self, obj):
        return self._get_resolved_urls(obj)["image_large_url"]


# ---------------------------------------------------------------------------
# Helper: Build prefetched color images index for a product
# ---------------------------------------------------------------------------
def _build_prefetched_color_images_index(product):
    """Construye índice {color: [ProductColorImage, ...]} usando prefetch si existe."""
    prefetched = getattr(product, "prefetched_color_images", None)
    if prefetched is None:
        return None

    index = getattr(product, "_prefetched_color_images_index", None)
    if index is not None:
        return index

    color_index = {}
    for image in prefetched:
        color = getattr(image, "color", "") or ""
        color_index.setdefault(color, []).append(image)

    product._prefetched_color_images_index = color_index
    return color_index



def _resolve_variant_gallery_images(variant):
    """Resuelve la galería efectiva de una variante sin cambiar el contrato API.

    Reglas:
    - SIZE_COLOR: usar ProductColorImage por product + color.
    - Preferir imágenes prefetched en memoria para evitar N+1.
    - Fallback: ProductImage legacy por variante si no hay imágenes por color.
    - Otros schemas: mantener ProductImage legacy por variante.
    """
    product = getattr(variant, "product", None)
    category = getattr(product, "category", None) if product else None
    schema = getattr(category, "variant_schema", "") if category else ""

    if schema == Category.VariantSchema.SIZE_COLOR and product is not None:
        color = getattr(variant, "color", "") or ""
        color_index = _build_prefetched_color_images_index(product)
        if color_index is not None:
            color_images = color_index.get(color) or []
            if color_images:
                return color_images, "color"

        color_images = list(
            ProductColorImage.objects.filter(
                product=product,
                color=color,
            ).order_by("-is_primary", "sort_order", "created_at")
        )
        if color_images:
            return color_images, "color"

    legacy_images = list(
        variant.images.all().order_by("-is_primary", "sort_order", "created_at")
    )
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

    def _get_variant_gallery_cache(self, obj):
        cache = self.context.setdefault("_variant_gallery_cache", {})
        key = getattr(obj, "id", None)
        if key in cache:
            return cache[key]

        resolved = _resolve_variant_gallery_images(obj)
        cache[key] = resolved
        return resolved

    def get_stock(self, obj):
        pool_map = self.context.get("pool_map")
        try:
            return int(get_variant_available_stock(obj, pool_map=pool_map) or 0)
        except Exception:
            return 0

    def get_images(self, obj):
        qs, source = self._get_variant_gallery_cache(obj)
        serializer_class = ProductColorImageSerializer if source == "color" else ProductImageSerializer
        return serializer_class(qs, many=True, context=self.context).data

    def get_image_url(self, obj):
        images, _source = self._get_variant_gallery_cache(obj)
        img = images[0] if images else None
        if not img or not img.image:
            return None
        request = self.context.get("request")
        cache_url = _spec_url(img, "image_large") or _spec_url(img, "image_medium")
        return public_media_url(cache_url or img.image.url, request=request)

    def get_image_thumb_url(self, obj):
        images, _source = self._get_variant_gallery_cache(obj)
        img = images[0] if images else None
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

    def _get_product_inventory_cache(self, obj):
        cache = getattr(self, "_product_inventory_cache", None)
        if cache is None:
            cache = {}
            setattr(self, "_product_inventory_cache", cache)

        if obj.id in cache:
            return cache[obj.id]

        variants = obj.variants.filter(is_active=True)
        try:
            setattr(variants, "_serializer_ctx", self.context)
        except Exception:
            pass

        stock_total, sold_out, pool_map = _effective_inventory_from_pool(obj.category_id, variants)
        cache[obj.id] = (stock_total, sold_out, pool_map)
        return cache[obj.id]

    def _get_detail_pool_map(self, obj):
        pool_map = self.context.get("pool_map")
        if pool_map is not None:
            return pool_map

        _stock_total, _sold_out, pool_map = self._get_product_inventory_cache(obj)
        self.context["pool_map"] = pool_map
        return pool_map

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

        pool_map = self._get_detail_pool_map(obj)
        ctx = dict(self.context)
        ctx["pool_map"] = pool_map
        return ProductVariantSerializer(variants, many=True, context=ctx).data

    def get_stock_total(self, obj):
        stock_total, sold_out, _pool_map = self._get_product_inventory_cache(obj)
        return stock_total

    def get_sold_out(self, obj):
        _stock_total, sold_out, _pool_map = self._get_product_inventory_cache(obj)
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

    def _get_resolved_urls(self, obj):
        cache = self.context.setdefault("_resolved_image_urls", {})
        key = (self.__class__.__name__, getattr(obj, "id", None))
        if key in cache:
            return cache[key]

        resolved = _resolve_public_image_urls(
            obj,
            request=self.context.get("request"),
            primary_specs=("image_hero", "image_large", "image_medium", "image_thumb"),
        )
        cache[key] = resolved
        return resolved

    def get_image(self, obj):
        return self._get_resolved_urls(obj)["image"]

    def get_image_thumb_url(self, obj):
        return self._get_resolved_urls(obj)["image_thumb_url"]

    def get_image_medium_url(self, obj):
        return self._get_resolved_urls(obj)["image_medium_url"]

    def get_image_large_url(self, obj):
        return self._get_resolved_urls(obj)["image_large_url"]


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

    def _get_resolved_urls(self, obj):
        cache = self.context.setdefault("_resolved_image_urls", {})
        key = (self.__class__.__name__, getattr(obj, "id", None))
        if key in cache:
            return cache[key]

        resolved = _resolve_public_image_urls(
            obj,
            request=self.context.get("request"),
            primary_specs=("image_card", "image_large", "image_medium", "image_thumb"),
        )
        cache[key] = resolved
        return resolved

    def get_image(self, obj):
        return self._get_resolved_urls(obj)["image"]

    def get_image_thumb_url(self, obj):
        return self._get_resolved_urls(obj)["image_thumb_url"]

    def get_image_medium_url(self, obj):
        return self._get_resolved_urls(obj)["image_medium_url"]

    def get_image_large_url(self, obj):
        return self._get_resolved_urls(obj)["image_large_url"]
