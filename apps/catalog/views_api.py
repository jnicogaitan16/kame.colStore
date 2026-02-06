"""
Vistas API del catálogo (DRF).
Endpoints: categories, products (list + detail by slug).
"""
from django.db.models import Prefetch, Q

from rest_framework import generics
from rest_framework.pagination import PageNumberPagination

from .models import Category, Product, ProductVariant
from .serializers import (
    CategorySerializer,
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
class CategoryListAPIView(generics.ListAPIView):
    """Listado de categorías activas."""
    queryset = Category.objects.filter(is_active=True).order_by("name")
    serializer_class = CategorySerializer
    pagination_class = None  # listado pequeño, sin paginación


# ---------------------------------------------------------------------------
# GET /api/products/?category=slug&search=...
# ---------------------------------------------------------------------------
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

