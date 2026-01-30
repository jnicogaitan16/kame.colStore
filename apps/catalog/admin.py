from django.contrib import admin
from django import forms
from django.db.models import Sum

from .models import Category, Product, ProductVariant


# ======================
# Category
# ======================
@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "is_active")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    list_filter = ("is_active",)


# ======================
# ProductVariant Form
# ======================
class ProductVariantAdminForm(forms.ModelForm):
    """
    Admin form that presents the correct allowed values depending on
    the product category. Final validation lives in ProductVariant.clean().
    """

    class Meta:
        model = ProductVariant
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        instance: ProductVariant | None = kwargs.get("instance")

        category_key = ""
        if instance and instance.product and instance.product.category:
            slug = (instance.product.category.slug or "").strip().lower()
            name = (instance.product.category.name or "").strip().lower()
            category_key = slug or name

        self.fields["value"].help_text = (
            "Camisetas: S/M/L/XL/2XL • "
            "Cuadros: 20x30/30x40/40x50 • "
            "Mugs: Blanco/Colores/Mágico"
        )

        if category_key == "camisetas":
            self.fields["value"].widget = forms.Select(
                choices=[(v, v) for v in sorted(ProductVariant.TSHIRT_SIZES)]
            )

        elif category_key == "cuadros":
            self.fields["value"].widget = forms.Select(
                choices=[(v, v) for v in sorted(ProductVariant.FRAME_SIZES)]
            )

        elif category_key == "mugs":
            self.fields["value"].widget = forms.Select(
                choices=[
                    ("BLANCO", "Blanco"),
                    ("COLORES", "Colores"),
                    ("MAGICO", "Mágico"),
                ]
            )


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
        "stock_total_display",
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

    @admin.display(description="Stock (total)")
    def stock_total_display(self, obj: Product) -> int:
        """Si hay variantes, muestra la suma; si no, muestra el stock legacy."""
        if hasattr(obj, "variants") and obj.variants.exists():
            agg = obj.variants.aggregate(total=Sum("stock"))
            return int(agg["total"] or 0)
        return int(getattr(obj, "stock", 0) or 0)

    @admin.display(description="Stock (variantes)")
    def variants_stock_total_display(self, obj: Product) -> int:
        """Suma el stock de todas las variantes del producto."""
        # `variants` es el related_name usado en este proyecto (se usa arriba en get_form).
        if hasattr(obj, "variants"):
            agg = obj.variants.aggregate(total=Sum("stock"))
            return int(agg["total"] or 0)
        return 0


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