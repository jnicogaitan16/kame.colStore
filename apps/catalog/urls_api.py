"""
URLs de la API del catálogo (DRF).
Prefijo: /api/
"""
from django.urls import path

from . import views_api

app_name = "catalog_api"

urlpatterns = [
    path("categories/", views_api.CategoryListAPIView.as_view(), name="category-list"),
    path("products/", views_api.ProductListAPIView.as_view(), name="product-list"),
    path("products/<slug:slug>/", views_api.ProductDetailAPIView.as_view(), name="product-detail"),
    path("homepage-banners/", views_api.HomepageBannerListAPIView.as_view(), name="homepage-banners"),
    path("homepage-story/", views_api.HomepageStoryAPIView.as_view(), name="homepage-story"),
]
