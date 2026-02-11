"""
Vistas API del catálogo (DRF).
Endpoints: categories, products (list + detail by slug).
"""
from django.db.models import Prefetch, Q
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache

from rest_framework import generics
from rest_framework.pagination import PageNumberPagination
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Category, HomepageBanner, HomepageSection, Product, ProductVariant
from .serializers import (
    CategorySerializer,
    HomepageBannerSerializer,
    HomepageStorySerializer,
    ProductDetailSerializer,
    ProductListSerializer,
)


# Paginación para listado de productos (por si se quiere distinto al global)
class ProductListPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


# ---------------------------------------------------------------------------
# GET /api/categories/
# ---------------------------------------------------------------------------
@method_decorator(never_cache, name="dispatch")
class CategoryListAPIView(generics.ListAPIView):
    """Listado de categorías activas."""
    queryset = Category.objects.filter(is_active=True).order_by("name")
    serializer_class = CategorySerializer
    pagination_class = None  # listado pequeño, sin paginación


# ---------------------------------------------------------------------------
# GET /api/products/?category=slug&search=...
# ---------------------------------------------------------------------------
@method_decorator(never_cache, name="dispatch")
class ProductListAPIView(generics.ListAPIView):
    """Listado de productos activos. Filtros: category (slug), search (nombre/descripción)."""
    serializer_class = ProductListSerializer
    pagination_class = ProductListPagination

    def get_queryset(self):
        qs = (
            Product.objects.filter(is_active=True)
            .select_related("category")
            .order_by("-created_at", "id")
        )
        category_slug = self.request.query_params.get("category")
        if category_slug:
            qs = qs.filter(category__slug=category_slug, category__is_active=True)
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search) | Q(description__icontains=search)
            )
        return qs


# ---------------------------------------------------------------------------
# GET /api/products/<slug>/
# ---------------------------------------------------------------------------
@method_decorator(never_cache, name="dispatch")
class ProductDetailAPIView(generics.RetrieveAPIView):
    """Detalle de producto por slug: producto + variantes + imágenes (primary + gallery)."""
    serializer_class = ProductDetailSerializer
    lookup_field = "slug"
    lookup_url_kwarg = "slug"

    def get_queryset(self):
        active_variants = ProductVariant.objects.filter(is_active=True).prefetch_related(
            "images"
        )
        return (
            Product.objects.filter(is_active=True)
            .select_related("category")
            .prefetch_related(
                Prefetch("variants", queryset=active_variants),
            )
            .order_by("-created_at", "id")
        )


# ---------------------------------------------------------------------------
# GET /api/homepage-banners/
# ---------------------------------------------------------------------------
@method_decorator(never_cache, name="dispatch")
class HomepageBannerListAPIView(generics.ListAPIView):
    """Listado de hero banners activos para la home."""

    serializer_class = HomepageBannerSerializer
    pagination_class = None

    def get_queryset(self):
        return HomepageBanner.objects.filter(is_active=True).order_by("sort_order", "-created_at")


# ---------------------------------------------------------------------------
# GET /api/homepage-story/
# ---------------------------------------------------------------------------
class HomepageStoryAPIView(APIView):
    """Retorna la historia del home (1 registro activo).

    Convención recomendada:
      - Crear un HomepageSection con key='brand-story'
      - Este endpoint prioriza ese key; si no existe, usa el primero activo.
    """

    def get(self, request):
        story = HomepageSection.objects.filter(is_active=True, key="brand-story").first()
        if not story:
            story = HomepageSection.objects.filter(is_active=True).order_by("sort_order", "-updated_at", "id").first()

        if not story:
            return Response({}, status=200)

        serializer = HomepageStorySerializer(story)
        return Response(serializer.data)
