from django.contrib import admin, messages
from django import forms
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.urls import path

from .models import (
    Category,
    Product,
    ProductVariant,
    ProductImage,
    HomepageBanner,
    HomepageSection,
    HomepagePromo,
)

from .variant_rules import get_variant_rule


def _model_has_field(model, field_name: str) -> bool:
    try:
        model._meta.get_field(field_name)
        return True
    except Exception:
        return False


def _first_existing_field(model, candidates: tuple[str, ...]):
    for name in candidates:
        if _model_has_field(model, name):
            return name
    return None


# ======================
# HomepageBanner Form
# ======================
class HomepageBannerAdminForm(forms.ModelForm):
    class Meta:
        model = HomepageBanner
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Si el modelo permite vacío, no obligar título/subtítulo/descripcion desde el admin.
        if "title" in self.fields:
            self.fields["title"].required = False
        if "subtitle" in self.fields:
            self.fields["subtitle"].required = False
        if "description" in self.fields:
            self.fields["description"].required = False



# ======================
# Category
# ======================

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "is_active")
    search_fields = ("name", "slug")
    list_filter = ("is_active",)
    prepopulated_fields = {"slug": ("name",)}

# ======================
# Home content (Banner / Story / Promos)
# ======================

@admin.register(HomepageBanner)
class HomepageBannerAdmin(admin.ModelAdmin):
    form = HomepageBannerAdminForm
    list_display = ("title", "show_text", "cta_label", "cta_url", "is_active", "sort_order", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("title", "subtitle", "description", "alt_text")
    ordering = ("sort_order", "id")

    fieldsets = (
        (
            "Contenido",
            {
                "fields": (
                    "title",
                    "subtitle",
                    "description",
                    "show_text",
                    "alt_text",
                )
            },
        ),
        ("Media", {"fields": ("image",)}),
        (
            "CTA",
            {
                "fields": (
                    "cta_label",
                    "cta_url",
                )
            },
        ),
        (
            "Visibilidad",
            {
                "fields": (
                    "is_active",
                    "sort_order",
                )
            },
        ),
    )




@admin.register(HomepageSection)
class HomepageSectionAdmin(admin.ModelAdmin):
    list_display = ("title", "is_active", "updated_at")
    list_filter = ("is_active",)
    ordering = ("id",)

    def get_search_fields(self, request):
        # Evita FieldError si el modelo cambió (p.ej. body -> content/description)
        fields = ["title", "subtitle"]
        extra = _first_existing_field(self.model, ("body", "content", "description", "text"))
        if extra:
            fields.append(extra)
        return tuple(f for f in fields if _model_has_field(self.model, f))

    def get_fieldsets(self, request, obj=None):
        # Construye fieldsets según campos reales del modelo.
        content_fields = ["title"]

        if _model_has_field(self.model, "subtitle"):
            content_fields.append("subtitle")

        long_text = _first_existing_field(self.model, ("body", "content", "description", "text"))
        if long_text:
            content_fields.append(long_text)

        visibility_fields = []
        if _model_has_field(self.model, "is_active"):
            visibility_fields.append("is_active")

        return (
            (
                "Contenido",
                {
                    "fields": tuple(content_fields),
                },
            ),
            (
                "Visibilidad",
                {
                    "fields": tuple(visibility_fields) or (),
                },
            ),
        )

# ======================
# HomepagePromo Form
# ======================
class HomepagePromoAdminForm(forms.ModelForm):
    class Meta:
        model = HomepagePromo
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Si el modelo permite vacío, no obligar título/subtítulo desde el admin.
        if "title" in self.fields:
            self.fields["title"].required = False
        if "subtitle" in self.fields:
            self.fields["subtitle"].required = False

@admin.register(HomepagePromo)
class HomepagePromoAdmin(admin.ModelAdmin):
    form = HomepagePromoAdminForm
    list_display = ("title", "show_text", "placement", "is_active", "sort_order", "updated_at")
    list_filter = ("placement", "is_active")
    search_fields = ("title", "subtitle", "alt_text")
    ordering = ("placement", "sort_order", "id")

    fieldsets = (
        (
            "Contenido",
            {
                "fields": (
                    "title",
                    "subtitle",
                    "show_text",
                    "alt_text",
                )
            },
        ),
        ("Media", {"fields": ("image",)}),
        (
            "CTA",
            {
                "fields": (
                    "cta_label",
                    "cta_url",
                )
            },
        ),
        (
            "Visibilidad",
            {
                "fields": (
                    "placement",
                    "is_active",
                    "sort_order",
                )
            },
        ),
    )


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

        # Reset help text (guard: field may not exist depending on current model)
        if "value" in self.fields:
            self.fields["value"].help_text = ""
        if "color" in self.fields:
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

        # Color field: only configure if the model currently has `color`
        allowed_colors = rule.get("allowed_colors")
        slug_norm = (category_slug or "").strip().lower()

        if "color" in self.fields:
            # Apparel categories: require color + show dropdown when allowed colors exist
            if slug_norm in {"camisetas", "hoodies"}:
                self.fields["color"].required = True
                if allowed_colors:
                    self.fields["color"].widget = forms.Select(
                        choices=[("", "---------")] + [(c, c) for c in allowed_colors]
                    )
            else:
                # Non-apparel: keep optional and use text input
                self.fields["color"].required = False
                self.fields["color"].widget = forms.TextInput()

    def clean_value(self):
        value = self.cleaned_data.get("value")
        if value is None:
            return value
        return str(value).strip().upper()

    def clean_color(self):
        # Guard: the model may not have `color`
        if "color" not in self.fields:
            return None
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
    extra = 0

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
    autocomplete_fields = ("product",)
    list_display = ("product", "kind", "value", "color", "stock", "is_active")
    list_select_related = ("product", "product__category")
    list_filter = ("kind", "is_active")
    search_fields = ("product__name", "value", "color")
    ordering = ("product", "kind", "value", "color")
    readonly_fields = ("kind",)
    # Explicit fields to ensure `color` renders in the standalone add/edit form.
    fields = ("product", "value", "color", "stock", "is_active", "kind")
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