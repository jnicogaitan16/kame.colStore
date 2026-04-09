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
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.request import Request

from apps.catalog.models import Category, InventoryPool, Product, ProductVariant
from apps.catalog.services.inventory import get_variant_available_stock


def _serialize_product(p: Product) -> dict:
    variant_count = p.variants.filter(is_active=True).count() if hasattr(p, "variants") else 0
    # Get primary image URL
    primary_image = None
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
        "is_active": p.is_active,
        "total_stock": p.total_stock,
        "variant_count": variant_count,
        "primary_image": primary_image,
        "created_at": p.created_at.isoformat(),
    }


def _serialize_product_detail(p: Product) -> dict:
    base = _serialize_product(p)
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

    return Response(_serialize_product_detail(product), status=201)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def product_detail(request: Request, product_id: int):
    try:
        p = Product.objects.select_related("category").prefetch_related("variants").get(pk=product_id)
    except Product.DoesNotExist:
        return Response({"error": "Producto no encontrado."}, status=404)

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

    variant, created = ProductVariant.objects.get_or_create(
        product=p,
        value=value,
        color=color,
        defaults={"is_active": True},
    )

    # Create or update InventoryPool entry
    pool, pool_created = InventoryPool.objects.get_or_create(
        category=p.category,
        value=value,
        color=color,
        defaults={"quantity": initial_stock, "is_active": True},
    )
    if not pool_created and initial_stock > 0:
        pool.quantity += initial_stock
        pool.save(update_fields=["quantity"])

    return Response({
        "ok": True,
        "variant_id": variant.pk,
        "created": created,
        "pool_id": pool.pk,
        "stock": pool.quantity,
    }, status=201 if created else 200)


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
