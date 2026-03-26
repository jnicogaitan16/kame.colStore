"""apps.catalog.views_api

API views for the public catalog.

Contract (InventoryPool as source of truth):
- Stock is computed in serializers from InventoryPool, not from ProductVariant.stock.
- List endpoint must avoid N+1 by loading InventoryPool for all categories in the page in ONE query.
- Detail endpoint must load InventoryPool only once for the product category.

This module intentionally keeps logic minimal; business rules live in:
- apps.catalog.services.inventory
- apps.catalog.serializers
"""

from __future__ import annotations

from django.db.models import Prefetch, Q
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Category,
    Department,
    HomepageBanner,
    HomepageSection,
    HomepagePromo,
    InventoryPool,
    Product,
    ProductColorImage,
    ProductImage,
    ProductVariant,
)
from .serializers import (
    CategorySerializer,
    DepartmentWithCategoriesSerializer,
    NavDepartmentSerializer,
    HomepageBannerSerializer,
    HomepagePromoSerializer,
    HomepageStorySerializer,
    HomeMarqueeProductSerializer,
    ProductDetailSerializer,
    ProductListSerializer,
)


def _build_category_pool_maps(category_ids):
    """Build {category_id: {(value,color): qty}} in a single query."""
    ids = [int(x) for x in set(category_ids or []) if x]
    if not ids:
        return {}

    rows = (
        InventoryPool.objects.filter(is_active=True, category_id__in=ids)
        .values_list("category_id", "value", "color", "quantity")
    )

    out = {}
    for cat_id, value, color, qty in rows:
        cat_id = int(cat_id)
        key = (str(value or "").strip().upper(), str(color or "").strip())
        out.setdefault(cat_id, {})[key] = int(qty or 0)
    return out


class CategoryListAPIView(generics.ListAPIView):
    """Flat category list for frontend to build the tree (department_id + parent_id)."""

    serializer_class = CategorySerializer

    def get_queryset(self):
        return (
            Category.objects.filter(is_active=True)
            .select_related("department", "parent")
            .order_by("sort_order", "name")
        )


class NavigationAPIView(APIView):
    """Single endpoint to build the full navigation menu (departments + active categories)."""

    def get(self, request, *args, **kwargs):
        qs = (
            Department.objects.filter(is_active=True)
            .prefetch_related(
                Prefetch(
                    "categories",
                    queryset=Category.objects.filter(is_active=True).order_by(
                        "sort_order", "name"
                    ),
                )
            )
            .order_by("sort_order", "name")
        )

        data = DepartmentWithCategoriesSerializer(
            qs, many=True, context={"request": request}
        ).data
        return Response({"departments": data})


# New API view for navigation (optimized for active categories, no pagination).
class NavigationListAPIView(generics.ListAPIView):
    """GET /api/navigation/ -> departments with active categories (no pagination)."""

    serializer_class = NavDepartmentSerializer
    pagination_class = None

    def get_queryset(self):
        # NOTE: assumes Department -> Category related_name is "categories".
        # If your related_name differs, update it here and in the serializer.
        return (
            Department.objects.filter(is_active=True)
            .prefetch_related(
                Prefetch(
                    "categories",
                    queryset=Category.objects.filter(is_active=True).order_by(
                        "sort_order", "name"
                    ),
                )
            )
            .order_by("sort_order", "name")
        )


class ProductListAPIView(generics.ListAPIView):
    """Product listing.

    Performance:
    - Prefetch active variants + their images.
    - Load InventoryPool for all category_ids in the page in ONE query.
    """

    serializer_class = ProductListSerializer

    def get_queryset(self):
        active_variants = ProductVariant.objects.filter(is_active=True).prefetch_related(
            Prefetch(
                "images",
                queryset=ProductImage.objects.order_by(
                    "-is_primary", "sort_order", "created_at", "id"
                ),
            )
        )

        color_images_queryset = ProductColorImage.objects.order_by(
            "sort_order", "id"
        )
        if hasattr(ProductColorImage, "is_active"):
            color_images_queryset = color_images_queryset.filter(is_active=True)

        qs = (
            Product.objects.filter(is_active=True)
            .select_related("category", "category__department")
            .prefetch_related(
                Prefetch("variants", queryset=active_variants),
                Prefetch(
                    "color_images",
                    queryset=color_images_queryset,
                    to_attr="prefetched_color_images",
                ),
            )
            .order_by("-created_at", "id")
        )

        category_slug = (self.request.query_params.get("category") or "").strip()
        if category_slug:
            qs = qs.filter(category__slug=category_slug, category__is_active=True)

        department_slug = (self.request.query_params.get("department") or "").strip()
        if department_slug:
            qs = qs.filter(category__department__slug=department_slug)

        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(description__icontains=search))

        return qs

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        page = self.paginate_queryset(queryset)
        items = page if page is not None else list(queryset)

        category_ids = [getattr(p, "category_id", None) for p in items]
        category_pool_maps = _build_category_pool_maps(category_ids)

        serializer = self.get_serializer(
            items,
            many=True,
            context={
                **self.get_serializer_context(),
                "category_pool_maps": category_pool_maps,
            },
        )

        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)


# New API view for homepage marquee products
class HomepageMarqueeProductListAPIView(generics.ListAPIView):
    """Homepage marquee products.

    Performance:
    - Prefetch active variants + their images.
    - Prefetch active color images using the same media strategy as listing.
    - No pagination: frontend marquee consumes the full curated set.
    """

    serializer_class = HomeMarqueeProductSerializer
    pagination_class = None

    def get_queryset(self):
        active_variants = ProductVariant.objects.filter(is_active=True).prefetch_related(
            Prefetch(
                "images",
                queryset=ProductImage.objects.order_by(
                    "-is_primary", "sort_order", "created_at", "id"
                ),
            )
        )

        color_images_queryset = ProductColorImage.objects.order_by(
            "sort_order", "id"
        )
        if hasattr(ProductColorImage, "is_active"):
            color_images_queryset = color_images_queryset.filter(is_active=True)

        return (
            Product.objects.filter(is_active=True, show_in_home_marquee=True)
            .select_related("category", "category__department")
            .prefetch_related(
                Prefetch("variants", queryset=active_variants),
                Prefetch(
                    "color_images",
                    queryset=color_images_queryset,
                    to_attr="prefetched_color_images",
                ),
            )
            .order_by("home_marquee_order", "id")
        )


class ProductDetailAPIView(generics.RetrieveAPIView):
    """Product detail.

    Performance:
    - Prefetch active variants + their images.
    - Load InventoryPool once for product category.
    """

    serializer_class = ProductDetailSerializer
    lookup_field = "slug"

    def get_queryset(self):
        active_variants = (
            ProductVariant.objects.filter(is_active=True)
            .select_related("product", "product__category")
            .prefetch_related(
                Prefetch(
                    "images",
                    queryset=ProductImage.objects.order_by(
                        "-is_primary", "sort_order", "created_at", "id"
                    ),
                )
            )
            .order_by("value", "color", "id")
        )

        color_images_queryset = ProductColorImage.objects.order_by("sort_order", "id")
        if hasattr(ProductColorImage, "is_active"):
            color_images_queryset = color_images_queryset.filter(is_active=True)

        return (
            Product.objects.filter(is_active=True)
            .select_related("category", "category__department")
            .prefetch_related(
                Prefetch("variants", queryset=active_variants),
                Prefetch(
                    "color_images",
                    queryset=color_images_queryset,
                    to_attr="prefetched_color_images",
                ),
            )
        )

    def retrieve(self, request, *args, **kwargs):
        obj = self.get_object()
        category_pool_maps = _build_category_pool_maps(
            [getattr(obj, "category_id", None)]
        )
        pool_map = category_pool_maps.get(getattr(obj, "category_id", None), {})

        serializer = self.get_serializer(
            obj,
            context={
                **self.get_serializer_context(),
                "pool_map": pool_map,
                "category_pool_maps": category_pool_maps,
            },
        )
        return Response(serializer.data)


class HomepageBannerListAPIView(generics.ListAPIView):
    serializer_class = HomepageBannerSerializer

    def get_queryset(self):
        return HomepageBanner.objects.filter(is_active=True).order_by(
            "sort_order", "id"
        )


class HomepagePromoListAPIView(generics.ListAPIView):
    serializer_class = HomepagePromoSerializer

    def get_queryset(self):
        qs = HomepagePromo.objects.filter(is_active=True)

        placement = (self.request.query_params.get("placement") or "").strip().upper()
        if placement:
            qs = qs.filter(placement__iexact=placement)

        return qs.order_by("sort_order", "id")


class HomepageStoryListAPIView(generics.ListAPIView):
    serializer_class = HomepageStorySerializer

    def get_queryset(self):
        return HomepageSection.objects.filter(is_active=True).order_by(
            "sort_order", "id"
        )


# Backwards-compatible alias: legacy URLConf expects this name
CatalogoListAPIView = ProductListAPIView

# Backwards-compatible alias: some URLConf expects this name
HomepageStoryAPIView = HomepageStoryListAPIView
