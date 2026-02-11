from __future__ import annotations

from django.contrib import admin
from django.contrib import messages
from django import forms
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.urls import path

from .models import Category, Product, ProductVariant, ProductImage, HomepageBanner, HomepageSection
from .variant_rules import get_variant_rule


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
# HomepageBanner
# ======================
@admin.register(HomepageBanner)
class HomepageBannerAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "is_active", "sort_order", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("title", "subtitle")
    ordering = ("sort_order", "-updated_at")


# ======================
# HomepageSection
# ======================
@admin.register(HomepageSection)
class HomepageSectionAdmin(admin.ModelAdmin):
    list_display = ("id", "key", "title", "is_active", "sort_order", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("key", "title", "subtitle", "content")
    ordering = ("sort_order", "-updated_at")


# ======================
# ProductVariant Form
# ======================
class ProductVariantAdminForm(forms.ModelForm):
    class Meta:
        model = ProductVariant
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        # Cuando el form se usa en el inline de Product, el formset puede pasar el producto padre
        self._parent_product = kwargs.pop("parent_product", None)
        super().__init__(*args, **kwargs)

        # Reset help text
        self.fields["value"].help_text = ""
        self.fields["color"].help_text = ""

        category_slug = None

        # 0) Inline en "Change product": producto padre pasado explícitamente por el formset
        if self._parent_product is not None and getattr(self._parent_product, "category", None):
            category_slug = self._parent_product.category.slug

        # 1) Edit form (instance exists, vista standalone o inline)
        if category_slug is None and self.instance and getattr(self.instance, "pk", None):
            product = getattr(self.instance, "product", None)
            if product and getattr(product, "category", None):
                category_slug = product.category.slug

        # 2) Add form en vista standalone (product selected via POST/initial)
        if category_slug is None:
            product_id = self.data.get("product") or self.initial.get("product")
            if product_id:
                try:
                    product = Product.objects.select_related("category").get(pk=product_id)
                    if product.category:
                        category_slug = product.category.slug
                except (Product.DoesNotExist, TypeError, ValueError):
                    pass

        rule = get_variant_rule(category_slug)

        # Label from rule
        self.fields["value"].label = rule.get("label", "Value")

        # Use select widget if rule says so
        if rule.get("use_select") and rule.get("allowed_values"):
            self.fields["value"].widget = forms.Select(
                choices=[(v, v) for v in rule["allowed_values"]]
            )

        # Color field: select for apparel categories; hidden for non-apparel
        allowed_colors = rule.get("allowed_colors")
        slug_norm = (category_slug or "").strip().lower()

        if slug_norm in {"camisetas", "hoodies"}:
            self.fields["color"].required = True
            # Render as list with available colors
            if allowed_colors:
                self.fields["color"].widget = forms.Select(
                    choices=[("", "---------")] + [(c, c) for c in allowed_colors]
                )
        else:
            # Keep the field rendered (JS will show/hide the row)
            # Model.clean() already clears color for non-apparel
            self.fields["color"].required = False
            self.fields["color"].widget = forms.TextInput()

    def clean_value(self):
        value = self.cleaned_data.get("value")
        if value is None:
            return value
        return str(value).strip().upper()

    def clean_color(self):
        color = self.cleaned_data.get("color")
        if color is None:
            return color
        return str(color).strip()


# ======================
# ProductVariant Inline
# ======================
class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    form = ProductVariantAdminForm
    extra = 1

    readonly_fields = ("kind",)
    fields = ("kind", "value", "color", "stock", "is_active")
    ordering = ("kind", "value", "color", "id")

    def get_formset(self, request, obj=None, **kwargs):
        """Pasa el producto padre al formulario para que Talla y Color sean listas desplegables."""
        formset_class = super().get_formset(request, obj=obj, **kwargs)
        parent_product = obj  # Product cuando estamos en "Change product"

        class ProductVariantFormSetWithParent(formset_class):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                # Django mezcla form_kwargs al crear cada form; así el form recibe parent_product
                if self.instance is not None:
                    self.form_kwargs = getattr(self, "form_kwargs", {}) or {}
                    self.form_kwargs["parent_product"] = self.instance

        return ProductVariantFormSetWithParent


# ======================
# ProductImage Inline
# ======================
class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1
    fields = ("image", "alt_text", "is_primary", "sort_order")
    readonly_fields = ("created_at",)
    
    def get_fields(self, request, obj=None):
        fields = list(super().get_fields(request, obj))
        if obj:  # Solo mostrar created_at al editar
            fields.append("created_at")
        return fields


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

    def get_inline_instances(self, request, obj=None):
        """En "Add product" no se muestran variantes; en "Edit product" sí, con dropdowns.

        Flujo: primero guardar producto (categoría, nombre, precio), luego en edición
        agregar variantes con listas desplegables (talla/color) según la categoría.
        """
        if obj is None:
            return []
        return super().get_inline_instances(request, obj)

    def add_view(self, request, form_url="", extra_context=None):
        """Informar al usuario que las variantes se agregan después de guardar."""
        messages.info(
            request,
            "Guarde el producto primero (categoría, nombre, precio). "
            "Luego, en la pantalla de edición, podrá agregar variantes con listas desplegables de talla y color.",
        )
        return super().add_view(request, form_url=form_url, extra_context=extra_context)

    def get_form(self, request, obj=None, **kwargs):
        """Oculta el stock del modelo Product.

        El stock real vive en ProductVariant.stock; en Product se usa un total calculado
        (p.ej. `variants_stock_total`). Este pop mantiene el admin consistente incluso
        antes/después de eliminar el campo `stock` de Product.
        """
        form = super().get_form(request, obj=obj, **kwargs)
        form.base_fields.pop("stock", None)
        return form


# ======================
# ProductVariant
# ======================
@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    form = ProductVariantAdminForm

    list_display = ("id", "product", "kind", "value", "color", "stock", "is_active")
    list_select_related = ("product", "product__category")
    list_filter = ("kind", "is_active", "product__category")
    search_fields = ("product__name", "value", "color")
    readonly_fields = ("kind",)
    inlines = [ProductImageInline]

    def _is_orders_variant_selector(self, request) -> bool:
        """Detecta cuándo ProductVariant se está usando como selector desde Orders.

        - Autocomplete: /admin/autocomplete/ incluye app_label/model_name/field_name
        - Popup selector (_popup=1): lo acotamos a Orders usando el HTTP_REFERER
          para no afectar popups de otros módulos.
        """
        is_orders_autocomplete = (
            request.GET.get("app_label") == "orders"
            and request.GET.get("model_name") == "orderitem"
            and request.GET.get("field_name") == "product_variant"
        )

        is_orders_popup = bool(request.GET.get("_popup")) and (
            "/admin/orders/" in (request.META.get("HTTP_REFERER") or "")
        )

        return is_orders_autocomplete or is_orders_popup

    def get_queryset(self, request):
        """Restringe variantes SOLO cuando se seleccionan desde Orders (popup/autocomplete).

        Evita mostrar variantes sin stock (stock <= 0) y/o inactivas.
        """
        qs = super().get_queryset(request)

        if self._is_orders_variant_selector(request):
            return qs.filter(is_active=True, stock__gt=0)

        return qs

    def get_search_results(self, request, queryset, search_term):
        """Refuerza el filtro también para el endpoint de autocomplete."""
        queryset, use_distinct = super().get_search_results(request, queryset, search_term)

        if self._is_orders_variant_selector(request):
            queryset = queryset.filter(is_active=True, stock__gt=0)

        return queryset, use_distinct

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

        if not product_id:
            rule = get_variant_rule(None)
            return JsonResponse(
                {
                    "category_slug": "",
                    "label": rule.get("label", "Value"),
                    "use_select": bool(rule.get("use_select")),
                    "allowed_values": rule.get("allowed_values"),
                    "allowed_colors": rule.get("allowed_colors"),
                    "normalize_upper": bool(rule.get("normalize_upper", True)),
                }
            )

        product = get_object_or_404(Product.objects.select_related("category"), pk=product_id)
        category_slug = product.category.slug if product.category else ""
        rule = get_variant_rule(category_slug)

        return JsonResponse(
            {
                "category_slug": (category_slug or "").strip().lower(),
                "label": rule.get("label", "Value"),
                "use_select": bool(rule.get("use_select")),
                "allowed_values": rule.get("allowed_values"),
                "allowed_colors": rule.get("allowed_colors"),
                "normalize_upper": bool(rule.get("normalize_upper", True)),
            }
        )

    class Media:
        js = ("admin/catalog/productvariant_dynamic_value.js",)