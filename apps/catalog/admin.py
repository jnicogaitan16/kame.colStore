from django.contrib import admin
from django import forms

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

    # Replaces numeric frame sizes with semantic sizes for admin UX
    CUADROS = [
        ("PEQUEÑO", "Pequeño"),
        ("MEDIANO", "Mediano"),
        ("GRANDE", "Grande"),
    ]

    class Meta:
        model = ProductVariant
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        instance: ProductVariant | None = kwargs.get("instance")

        # Determine category based on instance or posted product id
        category = None

        # 1) Editing an existing instance
        if instance and instance.product_id:
            category = instance.product.category.slug.lower()

        # 2) Creating via inline: product comes from POST data
        elif self.data.get("product"):
            try:
                product_id = int(self.data.get("product"))
                product = Product.objects.select_related("category").get(id=product_id)
                category = product.category.slug.lower()
            except (ValueError, Product.DoesNotExist):
                category = None

        self.fields["value"].help_text = (
            "Camisetas: S / M / L / XL / 2XL · "
            "Cuadros: Pequeño / Mediano / Grande · "
            "Mugs: Blanco / Colores / Mágico"
        )

        category_key = category or ""
        if category_key == "camisetas":
            self.fields["value"].widget = forms.Select(
                choices=[(v, v) for v in sorted(ProductVariant.TSHIRT_SIZES)]
            )
        elif category_key == "cuadros":
            self.fields["value"].widget = forms.Select(
                choices=self.CUADROS
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