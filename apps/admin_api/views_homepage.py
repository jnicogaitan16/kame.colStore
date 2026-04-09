from __future__ import annotations

# Admin API — Homepage content (banners, promos, editorial sections). CRUD vía admin front (multipart para imágenes).
from django.core.exceptions import ValidationError
from django.db.models.deletion import ProtectedError
from django.http import HttpResponse
from django.db import IntegrityError
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAdminUser
from rest_framework.request import Request
from rest_framework.response import Response

from apps.catalog.models import HomepageBanner, HomepagePromo, HomepageSection


def _rewind_upload(f) -> None:
    """Tras full_clean(), la validación de ImageField lee el archivo y deja el cursor al final;
    save() volvería a leer desde ahí y guardaría un archivo vacío/corrupto (Pillow: cannot identify image)."""
    if f is None:
        return
    if hasattr(f, "seek"):
        try:
            f.seek(0)
        except OSError:
            pass


def _abs_url(request: Request, relative: str) -> str | None:
    if not relative:
        return None
    if relative.startswith("http://") or relative.startswith("https://"):
        return relative
    return request.build_absolute_uri(relative)


def _banner_dict(request: Request, b: HomepageBanner) -> dict:
    thumb = None
    if b.image:
        try:
            thumb = getattr(b.image_thumb, "url", None) or b.image.url
        except Exception:
            thumb = None
    return {
        "id": b.pk,
        "title": b.title,
        "subtitle": b.subtitle,
        "description": b.description,
        "alt_text": b.alt_text,
        "is_active": b.is_active,
        "sort_order": b.sort_order,
        "cta_label": b.cta_label,
        "cta_url": b.cta_url,
        "show_text": b.show_text,
        "image_thumb_url": _abs_url(request, thumb),
    }


def _promo_dict(request: Request, p: HomepagePromo) -> dict:
    thumb = None
    if p.image:
        try:
            thumb = getattr(p.image_thumb, "url", None) or p.image.url
        except Exception:
            thumb = None
    return {
        "id": p.pk,
        "title": p.title,
        "subtitle": p.subtitle,
        "placement": p.placement,
        "is_active": p.is_active,
        "sort_order": p.sort_order,
        "cta_label": p.cta_label,
        "cta_url": p.cta_url,
        "show_text": p.show_text,
        "alt_text": p.alt_text,
        "image_thumb_url": _abs_url(request, thumb),
    }


def _section_dict(s: HomepageSection) -> dict:
    content = s.content or ""
    preview = (content[:160] + "…") if len(content) > 160 else content
    return {
        "id": s.pk,
        "key": s.key,
        "title": s.title,
        "subtitle": s.subtitle,
        "content": s.content,
        "content_preview": preview,
        "is_active": s.is_active,
        "sort_order": s.sort_order,
    }


@api_view(["GET"])
@permission_classes([IsAdminUser])
def homepage_banners_list(request: Request):
    qs = HomepageBanner.objects.all().order_by("sort_order", "-created_at")
    return Response([_banner_dict(request, b) for b in qs])


def _parse_bool(val) -> bool:
    if isinstance(val, bool):
        return val
    s = str(val).strip().lower()
    return s in ("1", "true", "yes", "on")


@api_view(["PATCH"])
@permission_classes([IsAdminUser])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def homepage_banner_update(request: Request, banner_id: int):
    try:
        b = HomepageBanner.objects.get(pk=banner_id)
    except HomepageBanner.DoesNotExist:
        return Response({"error": "Banner no encontrado."}, status=404)
    data = request.data
    if "is_active" in data:
        b.is_active = _parse_bool(data["is_active"])
    if "sort_order" in data:
        b.sort_order = int(data["sort_order"])
    if "title" in data:
        b.title = (data["title"] or "").strip()
    if "subtitle" in data:
        b.subtitle = (data["subtitle"] or "").strip()
    if "description" in data:
        b.description = data["description"] or ""
    if "alt_text" in data:
        b.alt_text = (data["alt_text"] or "").strip()
    if "cta_label" in data:
        b.cta_label = (data["cta_label"] or "").strip()
    if "cta_url" in data:
        b.cta_url = (data["cta_url"] or "").strip()
    if "show_text" in data:
        b.show_text = _parse_bool(data["show_text"])
    img = request.FILES.get("image")
    if img:
        _rewind_upload(img)
        b.image = img
    try:
        b.full_clean()
        if img:
            _rewind_upload(img)
        b.save()
    except ValidationError as e:
        err = e.message_dict if getattr(e, "message_dict", None) else {"__all__": list(e.messages)}
        return Response({"error": err}, status=400)
    except Exception as e:
        return Response({"error": str(e)}, status=400)
    return Response(_banner_dict(request, b))


@api_view(["POST"])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def homepage_banner_create(request: Request):
    data = request.data
    image = request.FILES.get("image")
    if not image:
        return Response({"error": {"image": ["Se requiere una imagen."]}}, status=400)
    _rewind_upload(image)
    b = HomepageBanner(
        title=(data.get("title") or "").strip(),
        subtitle=(data.get("subtitle") or "").strip(),
        description=data.get("description") or "",
        alt_text=(data.get("alt_text") or "").strip(),
        cta_label=(data.get("cta_label") or "").strip(),
        cta_url=(data.get("cta_url") or "").strip(),
        show_text=_parse_bool(data.get("show_text", True)),
        is_active=_parse_bool(data.get("is_active", True)),
        sort_order=int(data.get("sort_order", 0)),
        image=image,
    )
    try:
        b.full_clean()
        _rewind_upload(image)
        b.save()
    except ValidationError as e:
        err = e.message_dict if getattr(e, "message_dict", None) else {"__all__": list(e.messages)}
        return Response({"error": err}, status=400)
    except Exception as e:
        return Response({"error": str(e)}, status=400)
    return Response(_banner_dict(request, b), status=201)


@api_view(["DELETE"])
@permission_classes([IsAdminUser])
def homepage_banner_delete(request: Request, banner_id: int):
    try:
        b = HomepageBanner.objects.get(pk=banner_id)
    except HomepageBanner.DoesNotExist:
        return Response({"error": "Banner no encontrado."}, status=404)
    try:
        b.delete()
    except ProtectedError:
        return Response({"error": "No se puede eliminar: hay datos relacionados."}, status=409)
    except IntegrityError:
        return Response({"error": "Error de integridad al eliminar."}, status=409)
    return HttpResponse(status=204)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def homepage_promos_list(request: Request):
    qs = HomepagePromo.objects.all().order_by("placement", "sort_order", "id")
    return Response([_promo_dict(request, p) for p in qs])


@api_view(["PATCH"])
@permission_classes([IsAdminUser])
@parser_classes([JSONParser, MultiPartParser, FormParser])
def homepage_promo_update(request: Request, promo_id: int):
    try:
        p = HomepagePromo.objects.get(pk=promo_id)
    except HomepagePromo.DoesNotExist:
        return Response({"error": "Promo no encontrada."}, status=404)
    data = request.data
    if "is_active" in data:
        p.is_active = _parse_bool(data["is_active"])
    if "sort_order" in data:
        p.sort_order = int(data["sort_order"])
    if "title" in data:
        p.title = (data["title"] or "").strip()
    if "subtitle" in data:
        p.subtitle = (data["subtitle"] or "").strip()
    if "placement" in data:
        raw = (data["placement"] or "").strip().upper()
        if raw in (HomepagePromo.Placement.TOP, HomepagePromo.Placement.MID):
            p.placement = raw
    if "cta_label" in data:
        p.cta_label = (data["cta_label"] or "").strip()
    if "cta_url" in data:
        p.cta_url = (data["cta_url"] or "").strip()
    if "show_text" in data:
        p.show_text = _parse_bool(data["show_text"])
    if "alt_text" in data:
        p.alt_text = (data["alt_text"] or "").strip()
    img = request.FILES.get("image")
    if img:
        _rewind_upload(img)
        p.image = img
    try:
        p.full_clean()
        if img:
            _rewind_upload(img)
        p.save()
    except ValidationError as e:
        err = e.message_dict if getattr(e, "message_dict", None) else {"__all__": list(e.messages)}
        return Response({"error": err}, status=400)
    except Exception as e:
        return Response({"error": str(e)}, status=400)
    return Response(_promo_dict(request, p))


@api_view(["POST"])
@permission_classes([IsAdminUser])
@parser_classes([MultiPartParser, FormParser])
def homepage_promo_create(request: Request):
    data = request.data
    image = request.FILES.get("image")
    if not image:
        return Response({"error": {"image": ["Se requiere una imagen."]}}, status=400)
    _rewind_upload(image)
    raw_place = (data.get("placement") or HomepagePromo.Placement.MID).strip().upper()
    if raw_place not in (HomepagePromo.Placement.TOP, HomepagePromo.Placement.MID):
        raw_place = HomepagePromo.Placement.MID
    p = HomepagePromo(
        title=(data.get("title") or "").strip(),
        subtitle=(data.get("subtitle") or "").strip(),
        placement=raw_place,
        cta_label=(data.get("cta_label") or "Ver más").strip(),
        cta_url=(data.get("cta_url") or "").strip(),
        alt_text=(data.get("alt_text") or "").strip(),
        show_text=_parse_bool(data.get("show_text", True)),
        is_active=_parse_bool(data.get("is_active", True)),
        sort_order=int(data.get("sort_order", 1)),
        image=image,
    )
    try:
        p.full_clean()
        _rewind_upload(image)
        p.save()
    except ValidationError as e:
        err = e.message_dict if getattr(e, "message_dict", None) else {"__all__": list(e.messages)}
        return Response({"error": err}, status=400)
    except Exception as e:
        return Response({"error": str(e)}, status=400)
    return Response(_promo_dict(request, p), status=201)


@api_view(["DELETE"])
@permission_classes([IsAdminUser])
def homepage_promo_delete(request: Request, promo_id: int):
    try:
        p = HomepagePromo.objects.get(pk=promo_id)
    except HomepagePromo.DoesNotExist:
        return Response({"error": "Promo no encontrada."}, status=404)
    try:
        p.delete()
    except ProtectedError:
        return Response({"error": "No se puede eliminar: hay datos relacionados."}, status=409)
    except IntegrityError:
        return Response({"error": "Error de integridad al eliminar."}, status=409)
    return HttpResponse(status=204)


@api_view(["GET"])
@permission_classes([IsAdminUser])
def homepage_sections_list(request: Request):
    qs = HomepageSection.objects.all().order_by("sort_order", "-updated_at")
    return Response([_section_dict(s) for s in qs])


@api_view(["POST"])
@permission_classes([IsAdminUser])
def homepage_section_create(request: Request):
    data = request.data
    title = (data.get("title") or "").strip()
    if not title:
        return Response({"error": {"title": ["El título es obligatorio."]}}, status=400)
    key = (data.get("key") or "").strip()
    s = HomepageSection(
        key=key,
        title=title,
        subtitle=(data.get("subtitle") or "").strip(),
        content=data.get("content") or "",
        is_active=bool(data.get("is_active", True)),
        sort_order=int(data.get("sort_order", 0)),
    )
    try:
        s.full_clean()
        s.save()
    except ValidationError as e:
        err = e.message_dict if getattr(e, "message_dict", None) else {"__all__": list(e.messages)}
        return Response({"error": err}, status=400)
    except Exception as e:
        return Response({"error": str(e)}, status=400)
    return Response(_section_dict(s), status=201)


@api_view(["DELETE"])
@permission_classes([IsAdminUser])
def homepage_section_delete(request: Request, section_id: int):
    try:
        s = HomepageSection.objects.get(pk=section_id)
    except HomepageSection.DoesNotExist:
        return Response({"error": "Sección no encontrada."}, status=404)
    try:
        s.delete()
    except ProtectedError:
        return Response({"error": "No se puede eliminar: hay datos relacionados."}, status=409)
    except IntegrityError:
        return Response({"error": "Error de integridad al eliminar."}, status=409)
    # HttpResponse evita el pipeline de renderizado JSON de DRF para 204 (cuerpo vacío).
    return HttpResponse(status=204)


@api_view(["PATCH"])
@permission_classes([IsAdminUser])
def homepage_section_update(request: Request, section_id: int):
    try:
        s = HomepageSection.objects.get(pk=section_id)
    except HomepageSection.DoesNotExist:
        return Response({"error": "Sección no encontrada."}, status=404)
    data = request.data
    if "is_active" in data:
        s.is_active = bool(data["is_active"])
    if "sort_order" in data:
        s.sort_order = int(data["sort_order"])
    if "title" in data:
        s.title = (data["title"] or "").strip()
    if "subtitle" in data:
        s.subtitle = (data["subtitle"] or "").strip()
    if "content" in data:
        s.content = data["content"] or ""
    try:
        s.full_clean()
        s.save()
    except ValidationError as e:
        err = e.message_dict if getattr(e, "message_dict", None) else {"__all__": list(e.messages)}
        return Response({"error": err}, status=400)
    except Exception as e:
        return Response({"error": str(e)}, status=400)
    return Response(_section_dict(s))
