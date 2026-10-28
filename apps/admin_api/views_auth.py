"""
Admin API — Auth endpoints.

POST /api/auth/login/       → step 1: username + password
                              • Sin 2FA  → crea sesión, devuelve datos de usuario
                              • Con 2FA  → devuelve {requires_otp: true, ephemeral_token}
POST /api/auth/verify-otp/  → step 2: valida OTP, crea sesión
POST /api/auth/logout/
GET  /api/auth/me/
"""
import json
import logging
import os
import urllib.request
import urllib.parse

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.core import signing
from django.views.decorators.csrf import csrf_exempt
from django_otp import devices_for_user, match_token
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework import status
from rest_framework.throttling import AnonRateThrottle

logger = logging.getLogger(__name__)

TURNSTILE_SECRET_KEY = os.getenv("TURNSTILE_SECRET_KEY", "")


class LoginThrottle(AnonRateThrottle):
    scope = "auth_login"


class OTPThrottle(AnonRateThrottle):
    scope = "auth_otp"


def _verify_turnstile(token: str, remote_ip: str) -> bool:
    """Validate a Cloudflare Turnstile token. Returns True if valid or if Turnstile is not configured."""
    if not TURNSTILE_SECRET_KEY:
        return True
    try:
        data = urllib.parse.urlencode({
            "secret": TURNSTILE_SECRET_KEY,
            "response": token,
            "remoteip": remote_ip,
        }).encode()
        req = urllib.request.Request(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data=data,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            result = json.loads(resp.read())
        return result.get("success", False)
    except Exception:
        logger.warning("Turnstile verification failed (network error), allowing request")
        return True

# Salt único para los tokens efímeros de pre-2FA
_OTP_SALT = "kame-admin-otp-step2"
# Ventana de validez del token efímero (segundos)
_OTP_TOKEN_MAX_AGE = 300  # 5 minutos


def _user_has_otp(user) -> bool:
    """True si el usuario tiene al menos un dispositivo TOTP confirmado."""
    return any(True for _ in devices_for_user(user, confirmed=True))


def _make_ephemeral_token(user_pk: int) -> str:
    """Crea un token firmado + timestamp que identifica al usuario en el paso 2."""
    return signing.dumps(user_pk, salt=_OTP_SALT)


def _resolve_ephemeral_token(token: str) -> int:
    """
    Devuelve el user_pk si el token es válido y no expiró.
    Lanza signing.SignatureExpired o signing.BadSignature en caso contrario.
    """
    return signing.loads(token, salt=_OTP_SALT, max_age=_OTP_TOKEN_MAX_AGE)


def _user_payload(user) -> dict:
    return {
        "id": user.pk,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_staff": user.is_staff,
    }


# ── Paso 1: usuario + contraseña ──────────────────────────────────────────

@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
def login_view(request: Request):
    # Verify Turnstile token if configured
    turnstile_token = request.data.get("turnstile_token", "")
    client_ip = request.META.get("HTTP_CF_CONNECTING_IP") or request.META.get("REMOTE_ADDR", "")
    if TURNSTILE_SECRET_KEY and not _verify_turnstile(turnstile_token, client_ip):
        return Response(
            {"error": "Verificación de seguridad fallida. Recarga la página e intenta de nuevo."},
            status=status.HTTP_403_FORBIDDEN,
        )

    username = request.data.get("username", "").strip()
    password = request.data.get("password", "")

    if not username or not password:
        return Response(
            {"error": "Se requieren usuario y contraseña."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(request._request, username=username, password=password)

    if user is None:
        return Response(
            {"error": "Credenciales incorrectas."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_staff:
        return Response(
            {"error": "Acceso denegado. Solo administradores."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if not user.is_active:
        return Response(
            {"error": "Usuario inactivo."},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Si el usuario tiene 2FA activo → paso intermedio
    if _user_has_otp(user):
        return Response({
            "requires_otp": True,
            "ephemeral_token": _make_ephemeral_token(user.pk),
        })

    # Sin 2FA → sesión completa
    login(request._request, user)
    return Response(_user_payload(user))


# ── Paso 2: verificación OTP ──────────────────────────────────────────────

@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([OTPThrottle])
def verify_otp_view(request: Request):
    ephemeral_token = request.data.get("ephemeral_token", "").strip()
    otp_code = str(request.data.get("otp_code", "")).strip()

    if not ephemeral_token or not otp_code:
        return Response(
            {"error": "Se requieren ephemeral_token y otp_code."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Validar token efímero
    try:
        user_pk = _resolve_ephemeral_token(ephemeral_token)
    except signing.SignatureExpired:
        return Response(
            {"error": "El código de acceso expiró. Inicia sesión de nuevo."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except signing.BadSignature:
        return Response(
            {"error": "Token inválido."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Recuperar usuario
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_pk, is_active=True, is_staff=True)
    except User.DoesNotExist:
        return Response(
            {"error": "Usuario no encontrado o inactivo."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Verificar código OTP contra todos los dispositivos confirmados del usuario
    device = match_token(user, otp_code)
    if device is None:
        return Response(
            {"error": "Código incorrecto. Inténtalo de nuevo."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # Crear sesión Django. authenticate() ya corrió en el paso 1 y le añadió
    # el atributo `backend` al objeto; acá lo reconstruimos explícitamente.
    user.backend = "django.contrib.auth.backends.ModelBackend"
    login(request._request, user)

    return Response(_user_payload(user))


# ── Logout ────────────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([AllowAny])
def logout_view(request: Request):
    logout(request._request)
    return Response({"ok": True})


# ── Me ────────────────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([AllowAny])
def me_view(request: Request):
    user = request._request.user
    if not user.is_authenticated or not user.is_staff:
        return Response(
            {"error": "No autenticado."},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    return Response(_user_payload(user))
