from django.contrib import admin
from django import forms
from django.http import JsonResponse
from django.urls import path

from .models import Category, Product, ProductVariant, CAMISETA_VALUES


# ======================
# Category
# ======================
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "is_active")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    list_filter = ("is_active",)


class ProductVariantAdminForm(forms.ModelForm):
    class Meta:
        model = ProductVariant
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # ✅ sin texto informativo
        self.fields["value"].help_text = ""
        self.fields["value"].label = "Value"

    def clean_value(self):
        value = self.cleaned_data.get("value")
        if value is None:
            return value
        return str(value).strip().upper()


# ======================
# ProductVariant Inline
# ======================
class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    form = ProductVariantAdminForm
    extra = 1

    readonly_fields = ("kind",)
    fields = ("kind", "value", "stock", "is_active")
    ordering = ("kind", "value", "id")


# ======================
# Product
# ======================
@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "category",
        "price",
        "variants_stock_total",
        "is_active",
        "created_at",
    )

    list_select_related = ("category",)
    search_fields = ("name", "slug")
    list_filter = ("is_active", "category")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [ProductVariantInline]

    def get_form(self, request, obj=None, **kwargs):
        """
        Oculta el stock legacy cuando el producto ya tiene variantes.
        """
        form = super().get_form(request, obj=obj, **kwargs)

        if obj and obj.variants.exists():
            form.base_fields.pop("stock", None)

        return form


# ======================
# ProductVariant
# ======================
@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    form = ProductVariantAdminForm

    list_display = ("id", "product", "kind", "value", "stock", "is_active")
    list_select_related = ("product", "product__category")
    list_filter = ("kind", "is_active", "product__category")
    search_fields = ("product__name", "value")
    readonly_fields = ("kind",)

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                "product-category/",
                self.admin_site.admin_view(self.product_category_view),
                name="catalog_productvariant_product_category",
            ),
        ]
        return custom + urls

    def product_category_view(self, request):
        product_id = request.GET.get("product_id")
        slug = None

        if product_id:
            try:
                product = Product.objects.select_related("category").get(pk=product_id)
                slug = (product.category.slug or "").lower() if product.category else None
            except Product.DoesNotExist:
                slug = None

        return JsonResponse({"category_slug": slug})

    class Media:
        js = ("admin/catalog/productvariant_dynamic_value.js",)