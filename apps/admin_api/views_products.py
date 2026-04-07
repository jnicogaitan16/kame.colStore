"""
Admin API — Product catalog CRUD.

GET    /api/admin/products/
POST   /api/admin/products/
GET    /api/admin/products/{id}/
PUT    /api/admin/products/{id}/
DELETE /api/admin/products/{id}/   → soft delete (is_active=False)
POST   /api/admin/products/{id}/variants/
"""
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
    price = data.get("price")
    category_id = data.get("category_id")
    description = data.get("description", "")
    is_active = data.get("is_active", False)

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
        price=price,
        category=category,
        description=description,
        is_active=False,  # start inactive, let admin activate after adding stock
    )
    try:
        product.full_clean()
        product.save()
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


@api_view(["GET"])
@permission_classes([IsAdminUser])
def categories_list(request: Request):
    """Helper endpoint: list leaf categories for product form selects."""
    from apps.catalog.models import Category
    cats = Category.objects.filter(is_active=True).select_related("department").order_by("department__name", "name")
    return Response([
        {
            "id": c.pk,
            "name": c.name,
            "slug": c.slug,
            "department": c.department.name if c.department_id else "",
            "is_leaf": c.is_leaf,
        }
        for c in cats
    ])
