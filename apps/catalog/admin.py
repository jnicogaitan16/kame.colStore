from django.contrib import admin, messages
from django import forms
from django.db.models import Count
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import path

from .models import (
    Department,
    Category,
    CategorySizeGuide,
    InventoryPool,
    Product,
    ProductVariant,
    ProductImage,
    ProductColorImage,
    HomepageBanner,
    HomepageSection,
    HomepagePromo,
)

from .variant_rules import get_variant_rule, resolve_variant_rule
from .forms import (
    CategorySizeGuideAdminForm,
    InventoryPoolAdminForm,
    InventoryPoolBulkLoadForm,
    ProductVariantAdminForm,
    ProductColorImageAdminForm,
)
from apps.catalog.services.inventory_pool_bulk import process_bulk_stock_lines
from apps.catalog.services.variant_sync import sync_variants_for_pool


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
# Department
# ======================

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "sort_order", "is_active")
    search_fields = ("name", "slug")
    list_filter = ("is_active",)
    prepopulated_fields = {"slug": ("name",)}
    ordering = ("sort_order", "name")

class CategorySizeGuideInline(admin.StackedInline):
    model = CategorySizeGuide
    form = CategorySizeGuideAdminForm
    extra = 0
    max_num = 1
    can_delete = True

    fieldsets = (
        (
            "Guía de medidas",
            {
                "fields": (
                    "is_active",
                    "title",
                    "subtitle",
                    "columns_json",
                    "rows_json",
                ),
            },
        ),
    )

    def get_extra(self, request, obj=None, **kwargs):
        try:
            has_guide = bool(obj and obj.size_guide)
        except CategorySizeGuide.DoesNotExist:
            has_guide = False

        return 0 if has_guide else 1

    def get_formset(self, request, obj=None, **kwargs):
        formset = super().get_formset(request, obj, **kwargs)

        schema = getattr(obj, "variant_schema", "") if obj else ""

        examples = {
            "size_color": {
                "title": "Guía de tallas — Oversize",
                "subtitle": "Medidas reales en centímetros (cm). Corte amplio, caída relajada y fit urbano. Puede variar ±1–2 cm según el lote.",
                "columns_json": ["Talla", "Largo (cm)", "Ancho (cm)", "Manga (cm)"],
                "rows_json": [
                    {"size": "S", "values": [71, 50, 21]},
                    {"size": "M", "values": [74, 55, 22]},
                    {"size": "L", "values": [77, 60, 23]},
                    {"size": "XL", "values": [80, 65, 24]},
                    {"size": "2XL", "values": [83, 70, 25]},
                ],
            },
            "jean_size": {
                "title": "Guía de tallas — Jean",
                "subtitle": "Medidas reales en centímetros (cm). Puede variar ±1–2 cm según el lote.",
                "columns_json": ["Talla", "Cintura (cm)", "Cadera (cm)", "Largo (cm)"],
                "rows_json": [
                    {"size": "28", "values": [36, 48, 100]},
                    {"size": "30", "values": [38, 50, 102]},
                    {"size": "32", "values": [40, 52, 104]},
                    {"size": "34", "values": [42, 54, 106]},
                    {"size": "36", "values": [44, 56, 108]},
                ],
            },
            "shoe_size": {
                "title": "Guía de tallas — Zapatillas",
                "subtitle": "Referencia aproximada en centímetros (cm).",
                "columns_json": ["Talla", "Largo pie (cm)"],
                "rows_json": [
                    {"size": "36", "values": [23]},
                    {"size": "37", "values": [23.5]},
                    {"size": "38", "values": [24]},
                    {"size": "39", "values": [24.5]},
                    {"size": "40", "values": [25]},
                    {"size": "41", "values": [25.5]},
                    {"size": "42", "values": [26]},
                ],
            },
            "no_variant": {
                "title": "Medidas del producto",
                "subtitle": "Formato y dimensiones reales en centímetros (cm).",
                "columns_json": ["Formato", "Ancho (cm)", "Alto (cm)"],
                "rows_json": [
                    {"size": "Único", "values": [20, 30]},
                ],
            },
        }

        selected_example = examples.get(schema)
        form = formset.form

        form.base_fields["title"].help_text = ""
        form.base_fields["subtitle"].help_text = ""
        form.base_fields["columns_json"].help_text = ""
        form.base_fields["rows_json"].help_text = ""
        form.base_fields["is_active"].help_text = ""

        form.base_fields["subtitle"].widget = forms.Textarea(attrs={"rows": 3})
        form.base_fields["columns_json"].widget = forms.Textarea(attrs={"rows": 6})
        form.base_fields["rows_json"].widget = forms.Textarea(attrs={"rows": 12})

        try:
            has_guide = bool(obj and obj.size_guide)
        except CategorySizeGuide.DoesNotExist:
            has_guide = False

        if selected_example and obj and not has_guide:
            form.base_fields["title"].initial = selected_example["title"]
            form.base_fields["subtitle"].initial = selected_example["subtitle"]
            form.base_fields["columns_json"].initial = selected_example["columns_json"]
            form.base_fields["rows_json"].initial = selected_example["rows_json"]
            form.base_fields["is_active"].initial = True

        return formset

# ======================
# Category
# ======================

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "slug",
        "department",
        "parent",
        "sort_order",
        "variant_schema",
        "is_active",
    )
    search_fields = ("name", "slug")
    list_filter = ("department", "is_active")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [CategorySizeGuideInline]
    fieldsets = (
        (
            "Información principal",
            {
                "fields": (
                    "department",
                    "parent",
                    "name",
                    "slug",
                    "sort_order",
                    "variant_schema",
                    "is_active",
                )
            },
        ),
    )
    list_select_related = ("department", "parent")
    ordering = (
        "department__sort_order",
        "sort_order",
        "name",
    )


# ======================
# InventoryPool — Carga masiva de stock
# ======================
# Formato: una línea por (talla, color, cantidad). Separador: coma o espacios.
# Ejemplo:
#   L, Blanco, 10
#   S, Negro, 10
#   M, Rojo, 5





def _process_bulk_stock(category_id, lines, add_to_existing):
    """Delega en servicio compartido con la API admin."""
    return process_bulk_stock_lines(category_id, lines, add_to_existing)




# ======================
# InventoryPool (Fuente de verdad)
# ======================

@admin.register(InventoryPool)
class InventoryPoolAdmin(admin.ModelAdmin):
    form = InventoryPoolAdminForm
    list_display = ("category", "value", "color", "quantity", "is_active", "updated_at")
    list_filter = ("category__department", "category", "color", "is_active")
    search_fields = ("value", "color", "category__name")
    list_select_related = ("category", "category__department")
    ordering = ("category__department__sort_order", "category__name", "value", "color", "id")

    # El stock solo se edita acá.
    fields = ("category", "value", "color", "quantity", "is_active")

    change_list_template = "admin/catalog/inventorypool/change_list.html"

    actions = ["sync_variants_action"]

    @admin.action(description="Sincronizar variantes")
    def sync_variants_action(self, request, queryset):
        """Sincroniza ProductVariant a partir de los pools seleccionados."""
        total = 0
        for pool in queryset:
            try:
                sync_variants_for_pool(pool.id)
                total += 1
            except Exception as e:
                messages.error(request, f"Pool {pool.id}: {e}")
        if total:
            messages.success(request, f"Sincronización ejecutada para {total} pool(s).")

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path(
                "bulk-add/",
                self.admin_site.admin_view(self.bulk_stock_view),
                name="catalog_inventorypool_bulk_add",
            ),
            path(
                "category-rule/",
                self.admin_site.admin_view(self.category_rule_view),
                name="catalog_inventorypool_category_rule",
            ),
        ]
        return custom + urls

    def category_rule_view(self, request):
        category_id = request.GET.get("category_id")

        if not category_id:
            rule = resolve_variant_rule(category_slug=None, variant_schema=None)
            return JsonResponse(
                {
                    "category_slug": "",
                    "label": rule.get("label", "Value"),
                    "use_select": bool(rule.get("use_select")),
                    "allowed_values": rule.get("allowed_values"),
                    "allowed_colors": rule.get("allowed_colors"),
                    "normalize_upper": bool(rule.get("normalize_upper", True)),
                    "variant_schema": "",
                }
            )

        category = get_object_or_404(Category, pk=category_id)
        category_slug = category.slug if category else ""
        category_schema = getattr(category, "variant_schema", "") or ""
        rule = resolve_variant_rule(
            category_slug=category_slug,
            variant_schema=category_schema,
        )

        return JsonResponse(
            {
                "category_slug": (category_slug or "").strip().lower(),
                "label": rule.get("label", "Value"),
                "use_select": bool(rule.get("use_select")),
                "allowed_values": rule.get("allowed_values"),
                "allowed_colors": rule.get("allowed_colors"),
                "normalize_upper": bool(rule.get("normalize_upper", True)),
                "variant_schema": category_schema,
            }
        )

    def bulk_stock_view(self, request):
        """Vista de carga masiva: varias líneas (talla, color, cantidad) para una categoría."""
        if request.method == "POST":
            form = InventoryPoolBulkLoadForm(request.POST)
            if form.is_valid():
                category = form.cleaned_data["category"]
                add_to_existing = form.cleaned_data.get("add_to_existing", False)
                lines = form.parsed_lines

                created, updated, errs = _process_bulk_stock(
                    category.id,
                    [(r["value"], r["color"], r["quantity"]) for r in lines],
                    add_to_existing,
                )

                if errs:
                    for e in errs[:10]:
                        messages.error(request, e)
                    if len(errs) > 10:
                        messages.error(request, f"... y {len(errs) - 10} errores más.")

                if created or updated:
                    messages.success(
                        request,
                        f"Carga masiva: {created} creados, {updated} actualizados.",
                    )

                return redirect("admin:catalog_inventorypool_changelist")
            else:
                # Mostrar errores detallados para que el usuario corrija el textarea rápido.
                for field_name, field_errors in form.errors.items():
                    if field_name == "__all__":
                        for err in field_errors:
                            messages.error(request, str(err))
                    else:
                        label = form.fields.get(field_name).label if field_name in form.fields else field_name
                        for err in field_errors:
                            messages.error(request, f"{label}: {err}")
        else:
            form = InventoryPoolBulkLoadForm()
        context = {
            **self.admin_site.each_context(request),
            "form": form,
            "title": "Carga masiva de stock (Inventory pool)",
            "opts": InventoryPool._meta,
        }
        return render(request, "admin/catalog/inventorypool/bulk_stock.html", context)

    class Media:
        js = (
            "admin/catalog/productvariant_dynamic_value.js",
            "admin/catalog/inventorypool_dynamic_value.js",
        )

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
# ProductVariant Inline
# ======================
class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    form = ProductVariantAdminForm
    extra = 0

    # Stock en variante es LEGACY: visible pero no editable.
    readonly_fields = ("stock",)
    fields = ("value", "color", "stock", "is_active")
    ordering = ("value", "color", "id")

    def get_formset(self, request, obj=None, **kwargs):
        """Pasa explícitamente el producto padre al formset para blindar el edit view."""
        formset_class = super().get_formset(request, obj=obj, **kwargs)
        parent_product = obj

        class ProductVariantFormSetWithParent(formset_class):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                effective_parent = parent_product or getattr(self, "instance", None)
                if effective_parent is not None:
                    self.form_kwargs = getattr(self, "form_kwargs", {}) or {}
                    self.form_kwargs["parent_product"] = effective_parent

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





class ProductColorImageInline(admin.TabularInline):
    model = ProductColorImage
    form = ProductColorImageAdminForm
    extra = 1
    fields = ("color", "image", "alt_text", "is_primary", "sort_order")
    readonly_fields = ("created_at",)

    def get_fields(self, request, obj=None):
        fields = list(super().get_fields(request, obj))
        if obj:  # Solo mostrar created_at al editar
            fields.append("created_at")
        return fields

    def get_formset(self, request, obj=None, **kwargs):
        """Pasa explícitamente el producto padre al formset para blindar el edit view."""
        formset_class = super().get_formset(request, obj=obj, **kwargs)
        parent_product = obj

        class ProductColorImageFormSetWithParent(formset_class):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                effective_parent = parent_product or getattr(self, "instance", None)
                if effective_parent is not None:
                    self.form_kwargs = getattr(self, "form_kwargs", {}) or {}
                    self.form_kwargs["parent_product"] = effective_parent

        return ProductColorImageFormSetWithParent


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
        "show_in_home_marquee",
        "home_marquee_order",
        "is_active",
        "created_at",
    )

    list_select_related = ("category",)
    search_fields = ("name", "slug")
    list_filter = ("is_active", "show_in_home_marquee", "category")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [ProductVariantInline, ProductColorImageInline]
    actions = ["generate_variants_from_pool_action"]

    fieldsets = (
        (
            "Información principal",
            {
                "fields": (
                    "category",
                    "name",
                    "slug",
                    "description",
                    "price",
                )
            },
        ),
        (
            "Estado / publicación",
            {
                "fields": (
                    "is_active",
                )
            },
        ),
        (
            "Home / Marquee",
            {
                "fields": (
                    "show_in_home_marquee",
                    "home_marquee_order",
                )
            },
        ),
    )

    @admin.action(description="Generar variantes desde pool")
    def generate_variants_from_pool_action(self, request, queryset):
        """Crea ProductVariant por cada (value, color) existente en InventoryPool para la categoría del producto."""
        created_total = 0
        skipped_no_category = 0
        for product in queryset.select_related("category"):
            if not product.category_id:
                skipped_no_category += 1
                continue
            if product.category.children.exists():
                messages.warning(
                    request,
                    f"Producto «{product.name}»: la categoría no es leaf; no se generan variantes.",
                )
                continue
            pool_rows = (
                InventoryPool.objects.filter(category_id=product.category_id, is_active=True)
                .values_list("value", "color", flat=False)
                .distinct()
            )
            created = 0
            for value, color in pool_rows:
                value = (value or "").strip().upper()
                color = (color or "").strip()
                _, was_created = ProductVariant.objects.get_or_create(
                    product_id=product.id,
                    value=value,
                    color=color,
                    defaults={"is_active": True, "stock": 0},
                )
                if was_created:
                    created += 1
            created_total += created
            if created:
                messages.success(request, f"«{product.name}»: {created} variante(s) creada(s).")
        if skipped_no_category:
            messages.warning(request, f"{skipped_no_category} producto(s) sin categoría omitidos.")
        if created_total:
            messages.success(request, f"Total: {created_total} variante(s) generada(s) desde el pool.")

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
            "Luego, en la pantalla de edición, podrá agregar variantes y configurar imágenes por color "
            "usando listas desplegables según la categoría.",
        )
        return super().add_view(request, form_url=form_url, extra_context=extra_context)

    def get_form(self, request, obj=None, **kwargs):
        """Oculta el stock del modelo Product.

        El stock real vive en InventoryPool.quantity; en Product se usa un total calculado
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
    list_display = ("product_category_label", "value", "color", "stock", "is_active")
    list_select_related = ("product", "product__category")
    list_filter = ("product__category__department", "product__category", "is_active")
    search_fields = ("product__name", "value", "color")
    ordering = ("product", "value", "color")
    readonly_fields = ("stock",)
    # Explicit fields to ensure `color` renders in the standalone add/edit form.
    fields = ("product", "value", "color", "stock", "is_active")

    @admin.display(description="PRODUCT", ordering="product__category__name")
    def product_category_label(self, obj):
        category = getattr(getattr(obj, "product", None), "category", None)
        return str(category) if category else "-"
    # Legacy fallback por variante: mantener por compatibilidad mientras
    # la PDP migra completamente a ProductColorImage para categorías SIZE_COLOR.
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

        Evita mostrar variantes inactivas.
        """
        qs = super().get_queryset(request)

        if self._is_orders_variant_selector(request):
            return qs.filter(is_active=True)

        return qs

    def get_search_results(self, request, queryset, search_term):
        """Refuerza el filtro también para el endpoint de autocomplete."""
        queryset, use_distinct = super().get_search_results(request, queryset, search_term)

        if self._is_orders_variant_selector(request):
            queryset = queryset.filter(is_active=True)

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
            rule = resolve_variant_rule(category_slug=None, variant_schema=None)
            return JsonResponse(
                {
                    "category_slug": "",
                    "label": rule.get("label", "Value"),
                    "use_select": bool(rule.get("use_select")),
                    "allowed_values": rule.get("allowed_values"),
                    "allowed_colors": rule.get("allowed_colors"),
                    "normalize_upper": bool(rule.get("normalize_upper", True)),
                    "variant_schema": "",
                }
            )

        product = get_object_or_404(Product.objects.select_related("category"), pk=product_id)
        category_slug = product.category.slug if product.category else ""
        category_schema = getattr(product.category, "variant_schema", "") or ""
        rule = resolve_variant_rule(
            category_slug=category_slug,
            variant_schema=category_schema,
        )

        return JsonResponse(
            {
                "category_slug": (category_slug or "").strip().lower(),
                "label": rule.get("label", "Value"),
                "use_select": bool(rule.get("use_select")),
                "allowed_values": rule.get("allowed_values"),
                "allowed_colors": rule.get("allowed_colors"),
                "normalize_upper": bool(rule.get("normalize_upper", True)),
                "variant_schema": category_schema,
            }
        )

    class Media:
        js = ("admin/catalog/productvariant_dynamic_value.js",)