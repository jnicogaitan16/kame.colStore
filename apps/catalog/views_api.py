"""apps.catalog.views_api

Vistas API del catálogo (DRF).
- Categories
- Products (list + detail)
- Home content: banners, promos, story

Nota: este archivo NO debe registrar modelos en el admin.
"""

from django.db.models import (
    Prefetch,
    Q,
    Sum,
    Value,
    IntegerField,
    BooleanField,
    Case,
    When,
)
from django.db.models.functions import Coalesce
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache

from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import (
    Category,
    HomepageBanner,
    HomepageSection,
    HomepagePromo,
    Product,
    ProductVariant,
)
from .serializers import (
    CategorySerializer,
    HomepageBannerSerializer,
    HomepageStorySerializer,
    HomepagePromoSerializer,
    ProductDetailSerializer,
    ProductListSerializer,
)


@method_decorator(never_cache, name="dispatch")
class CategoryListAPIView(generics.ListAPIView):
    """Listado de categorías activas."""

    queryset = Category.objects.filter(is_active=True).order_by("name")
    serializer_class = CategorySerializer
    pagination_class = None


@method_decorator(never_cache, name="dispatch")
class ProductListAPIView(generics.ListAPIView):
    """Listado de productos activos."""

    serializer_class = ProductListSerializer

    def get_queryset(self):
        qs = (
            Product.objects.filter(is_active=True)
            .select_related("category")
            .annotate(
                stock_total=Coalesce(
                    Sum(
                        "variants__stock",
                        filter=Q(variants__is_active=True),
                        output_field=IntegerField(),
                    ),
                    Value(0),
                    output_field=IntegerField(),
                )
            )
            .annotate(
                sold_out=Case(
                    When(stock_total__lte=0, then=Value(True)),
                    default=Value(False),
                    output_field=BooleanField(),
                )
            )
            .order_by("-created_at", "id")
        )

        category_slug = self.request.query_params.get("category")
        if category_slug:
            qs = qs.filter(category__slug=category_slug, category__is_active=True)

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(description__icontains=search))

        return qs


@method_decorator(never_cache, name="dispatch")
class CatalogoListAPIView(ProductListAPIView):
    """Alias del listado de productos para el catálogo."""

    pass


@method_decorator(never_cache, name="dispatch")
class ProductDetailAPIView(generics.RetrieveAPIView):
    """Detalle de producto por slug."""

    serializer_class = ProductDetailSerializer
    lookup_field = "slug"
    lookup_url_kwarg = "slug"

    def get_queryset(self):
        active_variants = ProductVariant.objects.filter(is_active=True).prefetch_related("images")
        return (
            Product.objects.filter(is_active=True)
            .select_related("category")
            .prefetch_related(Prefetch("variants", queryset=active_variants, to_attr="active_variants"))
            .order_by("-created_at", "id")
        )


@method_decorator(never_cache, name="dispatch")
class HomepageBannerListAPIView(generics.ListAPIView):
    """Listado de hero banners activos para la home."""

    serializer_class = HomepageBannerSerializer
    pagination_class = None

    def get_queryset(self):
        return HomepageBanner.objects.filter(is_active=True).order_by("sort_order", "-created_at")


@method_decorator(never_cache, name="dispatch")
class HomepagePromoListAPIView(generics.ListAPIView):
    """Listado de promos activas para la home."""

    serializer_class = HomepagePromoSerializer
    pagination_class = None

    def get_queryset(self):
        qs = HomepagePromo.objects.filter(is_active=True)

        placement = (self.request.query_params.get("placement") or "").strip().upper()
        if placement:
            qs = qs.filter(placement=placement)

        return qs.order_by("sort_order", "-id")


class HomepageStoryAPIView(APIView):
    """Retorna la historia del home (1 registro activo)."""

    def get(self, request):
        story = HomepageSection.objects.filter(is_active=True, key="brand-story").first()
        if not story:
            story = (
                HomepageSection.objects.filter(is_active=True)
                .order_by("sort_order", "-updated_at", "id")
                .first()
            )

        if not story:
            return Response({}, status=200)

        serializer = HomepageStorySerializer(story)
        return Response(serializer.data)
