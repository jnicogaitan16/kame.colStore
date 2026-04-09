"""
Admin API — Product catalog CRUD.

GET    /api/admin/products/
POST   /api/admin/products/
GET    /api/admin/products/{id}/
PUT    /api/admin/products/{id}/
DELETE /api/admin/products/{id}/   → soft delete (is_active=False)
POST   /api/admin/products/{id}/variants/
"""
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.request import Request

from apps.catalog.models import (
    Category,
    InventoryPool,
    Product,
    ProductVariant,
    ProductColorImage,
)
from apps.catalog.services.inventory import get_variant_available_stock
from apps.catalog.variant_rules import resolve_variant_rule

from .views_homepage import _rewind_upload


def _abs_url(request: Request, relative: str | None) -> str | None:
    if not relative:
        return None
    if relative.startswith("http://") or relative.startswith("https://"):
        return relative
    try:
        return request.build_absolute_uri(relative)
    except Exception:
        return relative


def _parse_bool(val) -> bool:
    if isinstance(val, bool):
        return val
    s = str(val).strip().lower()
    return s in ("1", "true", "yes", "on")


def _serialize_color_image(request: Request, img: ProductColorImage) -> dict:
    thumb = None
    if getattr(img, "image", None):
        try:
            thumb = getattr(img.image_thumb, "url", None) or img.image.url
        except Exception:
            thumb = None
    return {
        "id": img.pk,
        "color": img.color,
        "alt_text": img.alt_text or "",
        "is_primary": bool(img.is_primary),
        "sort_order": int(img.sort_order or 0),
        "image_thumb_url": _abs_url(request, thumb),
    }


def _serialize_product(p: Product) -> dict:
    variant_count = p.variants.filter(is_active=True).count() if hasattr(p, "variants") else 0
    # Get primary image URL
    primary_image = None
    schema = getattr(getattr(p, "category", None), "variant_schema", "") or ""
    if schema == Category.VariantSchema.SIZE_COLOR and hasattr(p, "color_images"):
        img = p.color_images.order_by("-is_primary", "sort_order", "created_at", "id").first()
        if img and getattr(img, "image", None):
            try:
                primary_image = getattr(img.image_thumb, "url", None) or img.image.url
            except Exception:
                try:
                    primary_image = img.image.url
                except Exception:
                    primary_image = None

    if not primary_image:
        first_variant = p.variants.first() if hasattr(p, "variants") else None
        if first_variant:
            img = first_variant.images.first()
            if img and img.image:
                try:
                    primary_image = img.image.url
                except Exception:
                    pass

    return {
        "id": p.pk,
        "name": p.name,
        "slug": p.slug,
        "description": p.description,
        "price": float(p.price),
        "category_id": p.category_id,
        "category_name": p.category.name if p.category_id else "",
        "category_variant_schema": schema,
        "is_active": p.is_active,
        "total_stock": p.total_stock,
        "variant_count": variant_count,
        "primary_image": primary_image,
        "created_at": p.created_at.isoformat(),
    }


def _serialize_product_detail(p: Product) -> dict:
    base = _serialize_product(p)
    rule = resolve_variant_rule(
        category_slug=getattr(getattr(p, "category", None), "slug", None),
        variant_schema=base.get("category_variant_schema"),
    )
    base["variant_rule"] = {
        "label": rule.get("label", "Value"),
        "use_select": bool(rule.get("use_select")),
        "allowed_values": rule.get("allowed_values"),
        "allowed_colors": rule.get("allowed_colors"),
        "normalize_upper": bool(rule.get("normalize_upper", True)),
    }
    variants = []
    for v in p.variants.all():
        stock = get_variant_available_stock(v) if hasattr(v, "value") else 0
        variants.append({
            "id": v.pk,
            "value": v.value,
            "color": v.color,
            "is_active": v.is_active,
            "stock": stock,
        })
    base["variants"] = variants

    request = getattr(p, "_request", None)
    if (
        request is not None
        and base.get("category_variant_schema") == Category.VariantSchema.SIZE_COLOR
        and hasattr(p, "color_images")
    ):
        imgs = list(p.color_images.all().order_by("-is_primary", "sort_order", "created_at", "id"))
        base["color_images"] = [_serialize_color_image(request, img) for img in imgs]
    else:
        base["color_images"] = []
    return base


@api_view(["GET"])
@permission_classes([IsAdminUser])
def products_list(request: Request):
    qs = Product.objects.select_related("category").order_by("-created_at")

    category = request.query_params.get("category")
    if category:
        qs = qs.filter(category__slug=category)

    search = request.query_params.get("search", "").strip()
    if search:
        qs = qs.filter(name__icontains=search)

    page = int(request.query_params.get("page", 1))
    page_size = 20
    offset = (page - 1) * page_size
    total = qs.count()

    return Response({
        "count": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
        "results": [_serialize_product(p) for p in qs[offset: offset + page_size]],
    })


@api_view(["POST"])
@permission_classes([IsAdminUser])
def products_create(request: Request):
    data = request.data
    name = data.get("name", "").strip()
    slug = (data.get("slug") or "").strip()
    price = data.get("price")
    category_id = data.get("category_id")
    description = data.get("description", "")

    if not name or price is None or not category_id:
        return Response(
            {"error": "Se requieren name, price y category_id."},
            status=400,
        )

    try:
        category = Category.objects.get(pk=category_id)
    except Category.DoesNotExist:
        return Response({"error": "Categoría no encontrada."}, status=400)

    product = Product(
        name=name,
        slug=slug,
        price=price,
        category=category,
        description=description,
        is_active=False,  # start inactive, let admin activate after adding stock
    )
    # full_clean() valida slug no vacío antes de save(); el modelo solo autollenaba en save().
    if not (product.slug or "").strip():
        product.slug = product._generate_unique_slug()
    try:
        product.full_clean()
        product.save()
    except ValidationError as e:
        err = e.message_dict if getattr(e, "message_dict", None) else {"__all__": list(e.messages)}
        return Response({"error": err}, status=400)
    except Exception as e:
        return Response({"error": str(e)}, status=400)

    product = (
        Product.objects.select_related("category")
        .prefetch_related("variants", "color_images")
        .get(pk=product.pk)
    )
    setattr(product, "_request", request)
    return Response(_serialize_product_detail(product), status=201)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def product_detail(request: Request, product_id: int):
    try:
        p = (
            Product.objects.select_related("category")
            .prefetch_related("variants", "color_images")
            .get(pk=product_id)
        )
    except Product.DoesNotExist:
        return Response({"error": "Producto no encontrado."}, status=404)

    setattr(p, "_request", request)
    return Response(_serialize_product_detail(p))


@api_view(["PUT", "PATCH"])
@permission_classes([IsAdminUser])
def product_update(request: Request, product_id: int):
    try:
        p = Product.objects.get(pk=product_id)
    except Product.DoesNotExist:
        return Response({"error": "Producto no encontrado."}, status=404)

    data = request.data
    if "name" in data:
        p.name = data["name"]
    if "slug" in data:
        s = (data["slug"] or "").strip()
        if not s:
            return Response({"error": {"slug": ["El slug no puede estar vacío."]}}, status=400)
        p.slug = s
    if "price" in data:
        p.price = data["price"]
    if "description" in data:
        p.description = data["description"]
    if "is_active" in data:
        p.is_active = bool(data["is_active"])
    if "category_id" in data:
        try:
            p.category = Category.objects.get(pk=data["category_id"])
        except Category.DoesNotExist:
            return Response({"error": "Categoría no encontrada."}, status=400)
    if "show_in_home_marquee" in data:
        p.show_in_home_marquee = bool(data["show_in_home_marquee"])

    try:
        p.full_clean()
        p.save()
    except ValidationError as e:
        err = e.message_dict if getattr(e, "message_dict", None) else {"__all__": list(e.messages)}
        return Response({"error": err}, status=400)
    except Exception as e:
        return Response({"error": str(e)}, status=400)

    p = (
        Product.objects.select_related("category")
        .prefetch_related("variants", "color_images")
        .get(pk=product_id)
    )
    setattr(p, "_request", request)
    return Response(_serialize_product_detail(p))


@api_view(["DELETE"])
@permission_classes([IsAdminUser])
def product_delete(request: Request, product_id: int):
    try:
        p = Product.objects.get(pk=product_id)
    except Product.DoesNotExist:
        return Response({"error": "Producto no encontrado."}, status=404)

    p.is_active = False
    p.save(update_fields=["is_active"])
    return Response({"ok": True, "id": p.pk})


@api_view(["POST"])
@permission_classes([IsAdminUser])
def product_add_variant(request: Request, product_id: int):
    try:
        p = Product.objects.get(pk=product_id)
    except Product.DoesNotExist:
        return Response({"error": "Producto no encontrado."}, status=404)

    data = request.data
    value = data.get("value", "").strip()
    color = data.get("color", "").strip()
    initial_stock = int(data.get("initial_stock", 0))

    if not value:
        return Response({"error": "Se requiere value (talla)."}, status=400)

    # Validate against canonical rules (same as Django admin forms/models).
    variant = ProductVariant(product=p, value=value, color=color, is_active=True)
    try:
        variant.full_clean()
    except ValidationError as e:
        err = e.message_dict if getattr(e, "message_dict", None) else {"__all__": list(e.messages)}
        return Response({"error": err}, status=400)

    # Persist (idempotent)
    variant, created = ProductVariant.objects.get_or_create(
        product=p,
        value=variant.value,
        color=variant.color,
        defaults={"is_active": True},
    )

    # Create or update InventoryPool entry (keys alineados con variant tras full_clean)
    # CONCURRENCY: select_for_update prevents race condition on stock decrement
    with transaction.atomic():
        pool = (
            InventoryPool.objects.select_for_update()
            .filter(
                category_id=p.category_id,
                value=variant.value,
                color=variant.color,
            )
            .first()
        )
        if pool is None:
            try:
                pool = InventoryPool.objects.create(
                    category=p.category,
                    value=variant.value,
                    color=variant.color,
                    quantity=max(0, initial_stock),
                    is_active=True,
                )
            except IntegrityError:
                pool = InventoryPool.objects.select_for_update().get(
                    category_id=p.category_id,
                    value=variant.value,
                    color=variant.color,
                )
                if initial_stock > 0:
                    pool.quantity += initial_stock
                    pool.save(update_fields=["quantity"])
        elif initial_stock > 0:
            pool.quantity += initial_stock
            pool.save(update_fields=["quantity"])

    return Response({
        "ok": True,
        "variant_id": variant.pk,
        "created": created,
        "pool_id": pool.pk,
        "stock": pool.quantity,
    }, status=201 if created else 200)


@api_view(["POST"])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def product_color_image_create(request: Request, product_id: int):
    try:
        p = Product.objects.select_related("category").get(pk=product_id)
    except Product.DoesNotExist:
        return Response({"error": "Producto no encontrado."}, status=404)

    if getattr(getattr(p, "category", None), "variant_schema", "") != Category.VariantSchema.SIZE_COLOR:
        return Response({"error": "Este producto no admite imágenes por color."}, status=400)

    data = request.data
    image = request.FILES.get("image")
    if not image:
        return Response({"error": {"image": ["Se requiere una imagen."]}}, status=400)

    color = (data.get("color") or "").strip()
    alt_text = (data.get("alt_text") or "").strip()
    is_primary = _parse_bool(data.get("is_primary", False))
    sort_order = int(data.get("sort_order", 0) or 0)

    _rewind_upload(image)
    obj = ProductColorImage(
        product=p,
        color=color,
        alt_text=alt_text,
        is_primary=is_primary,
        sort_order=sort_order,
        image=image,
    )
    try:
        obj.full_clean()
        _rewind_upload(image)
        obj.save()
    except ValidationError as e:
        err = e.message_dict if getattr(e, "message_dict", None) else {"__all__": list(e.messages)}
        return Response({"error": err}, status=400)
    except Exception as e:
        return Response({"error": str(e)}, status=400)

    return Response(_serialize_color_image(request, obj), status=201)


@api_view(["PATCH"])
@permission_classes([IsAdminUser])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def product_color_image_update(request: Request, product_id: int, image_id: int):
    try:
        obj = ProductColorImage.objects.select_related("product", "product__category").get(
            pk=image_id, product_id=product_id
        )
    except ProductColorImage.DoesNotExist:
        return Response({"error": "Imagen no encontrada."}, status=404)

    if getattr(getattr(obj.product, "category", None), "variant_schema", "") != Category.VariantSchema.SIZE_COLOR:
        return Response({"error": "Este producto no admite imágenes por color."}, status=400)

    data = request.data
    if "color" in data:
        obj.color = (data.get("color") or "").strip()
    if "alt_text" in data:
        obj.alt_text = (data.get("alt_text") or "").strip()
    if "is_primary" in data:
        obj.is_primary = _parse_bool(data.get("is_primary"))
    if "sort_order" in data:
        obj.sort_order = int(data.get("sort_order") or 0)

    img = request.FILES.get("image")
    if img:
        _rewind_upload(img)
        obj.image = img

    try:
        obj.full_clean()
        if img:
            _rewind_upload(img)
        obj.save()
    except ValidationError as e:
        err = e.message_dict if getattr(e, "message_dict", None) else {"__all__": list(e.messages)}
        return Response({"error": err}, status=400)
    except Exception as e:
        return Response({"error": str(e)}, status=400)

    return Response(_serialize_color_image(request, obj))


@api_view(["DELETE"])
@permission_classes([IsAdminUser])
def product_color_image_delete(request: Request, product_id: int, image_id: int):
    try:
        obj = ProductColorImage.objects.get(pk=image_id, product_id=product_id)
    except ProductColorImage.DoesNotExist:
        return Response({"error": "Imagen no encontrada."}, status=404)

    obj.delete()
    return Response(status=204)


def _serialize_category(c: Category) -> dict:
    return {
        "id": c.pk,
        "name": c.name,
        "slug": c.slug,
        "department": c.department.name if c.department_id else "",
        "department_id": c.department_id or 0,
        "is_leaf": c.is_leaf,
        "is_active": c.is_active,
        "variant_schema": c.variant_schema,
        "product_count": c.products.count(),
        "parent_id": c.parent_id,
        "sort_order": c.sort_order,
    }


@api_view(["GET"])
@permission_classes([IsAdminUser])
def categories_list(request: Request):
    """List categories. By default only active; pass ?include_inactive=1 for all."""
    include_inactive = request.query_params.get("include_inactive", "0") == "1"
    qs = Category.objects.select_related("department").order_by("department__name", "sort_order", "name")
    if not include_inactive:
        qs = qs.filter(is_active=True)
    return Response([_serialize_category(c) for c in qs])


@api_view(["POST"])
@permission_classes([IsAdminUser])
def category_create(request: Request):
    from apps.catalog.models import Department
    data = request.data
    name = data.get("name", "").strip()
    slug = (data.get("slug") or "").strip()
    department_id = data.get("department_id")
    variant_schema = data.get("variant_schema", Category.VariantSchema.SIZE_COLOR)
    parent_id = data.get("parent_id")

    if not name or not department_id:
        return Response({"error": "Se requieren name y department_id."}, status=400)

    try:
        department = Department.objects.get(pk=department_id)
    except Department.DoesNotExist:
        return Response({"error": "Departamento no encontrado."}, status=400)

    parent = None
    if parent_id:
        try:
            parent = Category.objects.get(pk=parent_id)
        except Category.DoesNotExist:
            return Response({"error": "Categoría padre no encontrada."}, status=400)

    cat = Category(
        name=name,
        slug=slug,
        department=department,
        parent=parent,
        variant_schema=variant_schema,
        is_active=True,
    )
    # full_clean() exige slug no vacío antes de save(); el modelo solo autollenaba en save().
    if not (cat.slug or "").strip():
        cat.slug = cat._generate_unique_slug()
    try:
        cat.full_clean()
        cat.save()
    except ValidationError as e:
        err = e.message_dict if getattr(e, "message_dict", None) else {"__all__": list(e.messages)}
        return Response({"error": err}, status=400)
    except Exception as e:
        return Response({"error": str(e)}, status=400)

    return Response(_serialize_category(cat), status=201)


@api_view(["PATCH"])
@permission_classes([IsAdminUser])
def category_update(request: Request, category_id: int):
    try:
        cat = Category.objects.select_related("department").get(pk=category_id)
    except Category.DoesNotExist:
        return Response({"error": "Categoría no encontrada."}, status=404)

    data = request.data
    if "name" in data:
        cat.name = data["name"].strip()
    if "slug" in data:
        s = (data["slug"] or "").strip()
        if not s:
            return Response({"error": {"slug": ["El slug no puede estar vacío."]}}, status=400)
        cat.slug = s
    if "is_active" in data:
        cat.is_active = bool(data["is_active"])
    if "variant_schema" in data:
        cat.variant_schema = data["variant_schema"]
    if "sort_order" in data:
        cat.sort_order = int(data["sort_order"])

    try:
        cat.full_clean()
        cat.save()
    except ValidationError as e:
        err = e.message_dict if getattr(e, "message_dict", None) else {"__all__": list(e.messages)}
        return Response({"error": err}, status=400)
    except Exception as e:
        return Response({"error": str(e)}, status=400)

    return Response(_serialize_category(cat))


def _serialize_department(d) -> dict:
    return {
        "id": d.pk,
        "name": d.name,
        "slug": d.slug,
        "is_active": d.is_active,
        "sort_order": d.sort_order,
    }


@api_view(["GET"])
@permission_classes([IsAdminUser])
def departments_list(request: Request):
    from apps.catalog.models import Department
    include_inactive = request.query_params.get("include_inactive", "0") == "1"
    qs = Department.objects.all().order_by("sort_order", "name")
    if not include_inactive:
        qs = qs.filter(is_active=True)
    return Response([_serialize_department(d) for d in qs])


@api_view(["PATCH"])
@permission_classes([IsAdminUser])
def department_update(request: Request, department_id: int):
    from apps.catalog.models import Department
    try:
        dep = Department.objects.get(pk=department_id)
    except Department.DoesNotExist:
        return Response({"error": "Departamento no encontrado."}, status=404)

    data = request.data
    if "name" in data:
        dep.name = (data["name"] or "").strip()
    if "slug" in data:
        s = (data["slug"] or "").strip()
        if s:
            dep.slug = s
    if "is_active" in data:
        dep.is_active = bool(data["is_active"])
    if "sort_order" in data:
        dep.sort_order = int(data["sort_order"])

    try:
        dep.full_clean()
        dep.save()
    except ValidationError as e:
        err = e.message_dict if getattr(e, "message_dict", None) else {"__all__": list(e.messages)}
        return Response({"error": err}, status=400)
    except Exception as e:
        return Response({"error": str(e)}, status=400)

    return Response(_serialize_department(dep))


@api_view(["POST"])
@permission_classes([IsAdminUser])
def department_create(request: Request):
    from apps.catalog.models import Department
    data = request.data
    name = (data.get("name") or "").strip()
    if not name:
        return Response({"error": "El nombre es obligatorio."}, status=400)
    slug = (data.get("slug") or "").strip()
    sort_order = int(data.get("sort_order", 0))
    is_active = bool(data.get("is_active", True))

    dep = Department(name=name, slug=slug, sort_order=sort_order, is_active=is_active)
    if not (dep.slug or "").strip():
        dep.slug = dep._generate_unique_slug()
    try:
        dep.full_clean()
        dep.save()
    except ValidationError as e:
        err = e.message_dict if getattr(e, "message_dict", None) else {"__all__": list(e.messages)}
        return Response({"error": err}, status=400)
    except Exception as e:
        return Response({"error": str(e)}, status=400)
    return Response(_serialize_department(dep), status=201)


@api_view(["DELETE"])
@permission_classes([IsAdminUser])
def department_delete(request: Request, department_id: int):
    from django.db.models.deletion import ProtectedError
    from apps.catalog.models import Department
    try:
        dep = Department.objects.get(pk=department_id)
    except Department.DoesNotExist:
        return Response({"error": "Departamento no encontrado."}, status=404)
    try:
        dep.delete()
    except ProtectedError:
        return Response(
            {"error": "No se puede eliminar: hay categorías u otros datos vinculados a este departamento."},
            status=400,
        )
    return Response(status=204)
