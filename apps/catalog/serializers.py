"""
Serializers para la API del catálogo (DRF).
Incluyen imágenes con URL absoluta y orden primary + gallery.
"""
from rest_framework import serializers

from .models import Category, HomepageBanner, HomepageSection, Product, ProductImage, ProductVariant


def _absolute_uri(request, url):
    """
    Devuelve siempre URL relativa (/media/...)
    para evitar problemas con host 127.0.0.1 en túneles o LAN.
    """
    return url if url else None


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

    class Meta:
        model = ProductImage
        fields = ["id", "image", "alt_text", "is_primary", "sort_order"]

    def get_image(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return _absolute_uri(request, obj.image.url)


# ---------------------------------------------------------------------------
# Variant (con imágenes ordenadas: primary + gallery)
# ---------------------------------------------------------------------------
class ProductVariantSerializer(serializers.ModelSerializer):
    images = serializers.SerializerMethodField()
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
            "images",
        ]

    def get_images(self, obj):
        # Orden: primary primero, luego por sort_order (galería)
        qs = obj.images.all().order_by("-is_primary", "sort_order", "created_at")
        return ProductImageSerializer(qs, many=True, context=self.context).data


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
        from .models import ProductImage

        img = (
            ProductImage.objects.filter(variant__product=obj)
            .order_by("-is_primary", "sort_order", "created_at")
            .first()
        )
        if not img or not img.image:
            return None
        request = self.context.get("request")
        return _absolute_uri(request, img.image.url)


# ---------------------------------------------------------------------------
# Product detail (producto + variantes + imágenes)
# ---------------------------------------------------------------------------
class ProductDetailSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    variants = serializers.SerializerMethodField()

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
            "stock",
            "created_at",
            "updated_at",
            "variants",
        ]

    def get_variants(self, obj):
        # No exponer variantes inactivas/eliminadas en la API
        qs = obj.variants.filter(is_active=True).order_by("kind", "value")
        return ProductVariantSerializer(qs, many=True, context=self.context).data


# ---------------------------------------------------------------------------
# Homepage banners (hero)
# ---------------------------------------------------------------------------
class HomepageBannerSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = HomepageBanner
        fields = [
            "id",
            "title",
            "subtitle",
            "description",
            "image",
            "alt_text",
            "cta_label",
            "cta_url",
            "sort_order",
        ]

    def get_image(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return _absolute_uri(request, obj.image.url)


# ---------------------------------------------------------------------------
# Homepage story / sections (editorial)
# ---------------------------------------------------------------------------
class HomepageStorySerializer(serializers.ModelSerializer):
    class Meta:
        model = HomepageSection
        fields = ["title", "subtitle", "content"]
