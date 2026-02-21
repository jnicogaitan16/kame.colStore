"""
Serializers para la API del catálogo (DRF).
Incluyen imágenes con URL absoluta y orden primary + gallery.
"""

from rest_framework import serializers
from imagekit.cachefiles import ImageCacheFile
from django.conf import settings

from .models import (
    Category,
    HomepageBanner,
    HomepageSection,
    HomepagePromo,
    Product,
    ProductImage,
    ProductVariant,
)


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
    """Retorna URL del spec asegurando que el cachefile exista.

    - Fuerza `generate()` si está disponible.
    - Solo devuelve la URL si el archivo existe en el storage.
    - Si algo falla, retorna None para que el caller haga fallback al original.
    """
    try:
        spec = getattr(obj, spec_attr, None)
        if not spec:
            return None

        # Preferimos cachefile explícito para evitar intermitencias (contract)
        try:
            cachefile = ImageCacheFile(spec)
            cachefile.generate()
            url = getattr(cachefile, "url", None)
            if not url:
                return None

            # Verificación extra: confirmar que el archivo existe en el storage
            storage = getattr(cachefile, "storage", None)
            name = getattr(cachefile, "name", None)
            exists = getattr(storage, "exists", None) if storage else None
            if callable(exists) and name and not exists(name):
                return None

            return url
        except Exception:
            # Fallback: si spec ya es cachefile y tiene url, úsala
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


def _effective_inventory_from_variants(variants_qs_or_list):
    """Fuente de verdad de inventario efectivo desde variantes activas.

    Reglas contractuales:
    - stock_total = sum(v.stock for v in variants if v.is_active)
    - sold_out = stock_total <= 0

    Nota: trata None como 0 y evita contar variantes inactivas.
    """
    stock_total = 0
    for v in variants_qs_or_list:
        try:
            is_active = bool(getattr(v, "is_active", False))
        except Exception:
            is_active = False
        if not is_active:
            continue
        try:
            stock_total += int(getattr(v, "stock", 0) or 0)
        except Exception:
            stock_total += 0
    sold_out = stock_total <= 0
    return stock_total, sold_out


# ---------------------------------------------------------------------------
# Category
# ---------------------------------------------------------------------------
class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug"]


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


# ---------------------------------------------------------------------------
# Variant (con imágenes ordenadas: primary + gallery)
# ---------------------------------------------------------------------------
class ProductVariantSerializer(serializers.ModelSerializer):
    images = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    image_thumb_url = serializers.SerializerMethodField()
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)

    class Meta:
        model = ProductVariant
        fields = [
            "id",
            "kind",
            "kind_display",
            "value",
            "color",
            "stock",
            "is_active",
            "image_url",
            "image_thumb_url",
            "images",
        ]

    def get_images(self, obj):
        # Orden: primary primero, luego por sort_order (galería)
        qs = obj.images.all().order_by("-is_primary", "sort_order", "created_at")
        return ProductImageSerializer(qs, many=True, context=self.context).data

    def get_image_url(self, obj):
        # Usa la primera imagen asociada a la variante
        img = obj.images.order_by("-is_primary", "sort_order", "created_at").first()
        if not img or not img.image:
            return None
        request = self.context.get("request")
        cache_url = _spec_url(img, "image_large") or _spec_url(img, "image_medium")
        return public_media_url(cache_url or img.image.url, request=request)

    def get_image_thumb_url(self, obj):
        img = obj.images.order_by("-is_primary", "sort_order", "created_at").first()
        if not img:
            return None

        # Si no existe spec/thumb en el modelo, retornar None
        if not hasattr(img, "image_thumb") or not img.image_thumb:
            return None

        request = self.context.get("request")

        try:
            cachefile = ImageCacheFile(img.image_thumb)
            cachefile.generate()  # Generación explícita
            return public_media_url(cachefile.url, request=request)
        except Exception:
            # Fallback a original
            return self.get_image_url(obj)


# ---------------------------------------------------------------------------
# Product list (para GET /api/products/)
# ---------------------------------------------------------------------------
class ProductListSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    primary_image = serializers.SerializerMethodField()
    stock_total = serializers.IntegerField(read_only=True)
    sold_out = serializers.BooleanField(read_only=True)

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
        """Primera imagen disponible: primary de la primera variante con imágenes, o primera imagen."""
        img = (
            ProductImage.objects.filter(variant__product=obj)
            .order_by("-is_primary", "sort_order", "created_at")
            .first()
        )
        if not img or not img.image:
            return None
        request = self.context.get("request")
        cache_url = _spec_url(img, "image_medium") or _spec_url(img, "image_thumb")
        return public_media_url(cache_url or img.image.url, request=request)


# ---------------------------------------------------------------------------
# Product detail (producto + variantes + imágenes)
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
        # No exponer variantes inactivas/eliminadas en la API
        qs = obj.variants.filter(is_active=True).order_by("kind", "value")
        return ProductVariantSerializer(qs, many=True, context=self.context).data

    def get_stock_total(self, obj):
        # Fuente de verdad: suma de stock de variantes activas (NO usar product.stock)
        variants = obj.variants.all()
        stock_total, _sold_out = _effective_inventory_from_variants(variants)
        return stock_total

    def get_sold_out(self, obj):
        variants = obj.variants.all()
        _stock_total, sold_out = _effective_inventory_from_variants(variants)
        return sold_out


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
