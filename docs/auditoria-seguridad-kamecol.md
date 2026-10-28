# Auditoría de Seguridad — KameCol

> Fecha: 2026-10-28
> Auditor: QA Intelligence (JARVIS)
> Stack: Django 5.2 + DRF 3.15 / Next.js 14 / PostgreSQL 18 / Render + Vercel

---

## Resumen ejecutivo

- **OK (sin acción urgente):** 9 de 20 puntos
- **PARCIAL (requiere atención):** 9 de 20 puntos
- **FALTA (acción requerida):** 2 de 20 puntos

---

## Detalle por punto

### 1. Ocultar API keys — ✅ OK

Todos los secretos se leen desde variables de entorno vía `os.getenv()` o `os.environ[]`. No hay valores hardcodeados en el código actual.

- Evidencia: `config/settings.py:38-501` (DJANGO_SECRET_KEY, WOMPI_*, RESEND_API_KEY, R2_*, SENTRY_DSN)
- En producción si `DEBUG=False` y `DJANGO_SECRET_KEY` no está seteado, la app falla con `KeyError` explícito (`settings.py:38`)

### 2. Eliminar secretos de Git — ⚠️ PARCIAL

El commit inicial `080f841` ("chore: init django project") incluye en `config/settings.py` el valor hardcodeado `SECRET_KEY = 'django-insecure-...'`.

- Ese commit existe en la historia pública del repo
- Nunca se commiteó un `.env` real (solo `.env.example`)
- La key es el placeholder `django-insecure-` que Django genera por defecto — no es clave de producción
- Si el repo es público, debería eliminarse con `git filter-repo`

### 3. Conexión a PostgreSQL sin exposición pública — ✅ OK

La conexión a Postgres usa `dj_database_url` con `ssl_require=True` por defecto para hosts no-locales.

- Evidencia: `settings.py:186-199`
- Para hosts locales (Docker/dev) desactiva SSL automáticamente
- La URL de DB proviene de `DATABASE_URL` env var, nunca hardcodeada

### 4. Row-Level Security (RLS) — ⚠️ PARCIAL

No hay RLS a nivel PostgreSQL. A nivel Django, los endpoints de administración (`/api/admin/*`) están protegidos con `@permission_classes([IsAdminUser])`.

- E-commerce sin cuentas de usuario finales: clientes anónimos
- Acceso a órdenes vía `TransactionStatusAPIView` usa `payment_reference` como token implícito (`views_api.py:730`)
- Verificar que `payment_reference` sea suficientemente aleatorio

### 5. Encriptar datos sensibles — ❌ FALTA

El modelo `Customer` almacena `cedula`, `phone`, `email`, `full_name` en texto plano en PostgreSQL.

- Evidencia: `customers/models.py:8-16`
- El modelo `Order` también almacena snapshot de datos personales en texto plano
- No hay ningún campo encriptado
- Para e-commerce con datos PII colombianos (Ley 1581/2012), se recomienda al menos encriptar el número de documento

### 6. Forzar autenticación en endpoints protegidos — ✅ OK

- Todos los endpoints de `/api/admin/*` tienen `@permission_classes([IsAdminUser])`
- Admin Django con `AdminSiteOTPRequired` que fuerza 2FA (`urls.py:27`)
- Admin custom implementa 2FA con tokens efímeros firmados y expiración de 5 min (`views_auth.py:24-42`)
- Endpoints públicos de catálogo y checkout son `AllowAny` por diseño (e-commerce anónimo)

### 7. Restringir acceso a registros propios — ⚠️ PARCIAL

- Admin restringido a `is_staff=True` con `IsAdminUser`
- Flujo anónimo donde `payment_reference` actúa como token de acceso a la orden (`views_api.py:730`)
- Aceptable si las referencias son UUIDs suficientemente aleatorios

### 8. Protección contra mass assignment — ⚠️ PARCIAL

- Serializers públicos con campos explícitos (`fields = [...]`)
- Precio del frontend ignorado: backend recalcula siempre (`views_api.py:434`)
- Admin forms usan `fields = "__all__"` pero están detrás de `IsAdminUser` + 2FA — riesgo bajo

### 9. Proteger Session Cookies — ✅ OK

`config/settings.py:104-107`:

- `SESSION_COOKIE_SECURE = not DEBUG` (True en producción)
- `SESSION_COOKIE_HTTPONLY = True`
- `CSRF_COOKIE_SECURE = not DEBUG`
- `SESSION_COOKIE_SAMESITE = "Lax"`

### 10. Hashear contraseñas — ✅ OK

- Django usa PBKDF2-SHA256 por defecto
- No se sobreescribió `PASSWORD_HASHERS`
- Stack completo de `AUTH_PASSWORD_VALIDATORS` activo (`settings.py:213-226`)

### 11. Rate limiting — ⚠️ PARCIAL

Throttling configurado:

- `anon`: 60/minuto en producción (`settings.py:354`)
- `checkout`: 5/minuto en producción (`settings.py:355`)
- `stock_validate`: 30/minuto en producción (`settings.py:356`)

**Problema crítico**: `/api/auth/login/` y `/api/auth/verify-otp/` NO tienen throttle (`views_auth.py`). Vulnerables a fuerza bruta.

### 12. Protección contra bots — ❌ FALTA

- No hay CAPTCHA ni mecanismo anti-bot en ningún endpoint público
- No se encontró hcaptcha, reCAPTCHA, Cloudflare Turnstile
- Insuficiente contra bots de checkout (inventory hoarding) y credential stuffing

### 13. Parametrizar queries (SQL injection) — ✅ OK

- No hay `.raw()`, `cursor.execute()`, `RawSQL()` ni `.extra()` en `apps/`
- Todo acceso a DB via ORM de Django
- `bandit` configurado con checks de SQL injection activos

### 14. Validar inputs — ✅ OK

- `CheckoutSerializer` + `CustomerDataSerializer` + `ShippingAddressSerializer` con validación estricta
- Ciudad por `ChoiceField`, formato colombiano de teléfono y documento (`serializers.py:16-79`)
- `city_code` validado contra `CITY_CODES` whitelist (`views_api.py:367`)

### 15. Sanitizar contenido (XSS) — ✅ OK

- Django auto-escapa todo en templates (no se usa `mark_safe`)
- DRF serializa a JSON puro
- Único `dangerouslySetInnerHTML` es para Schema.org structured data (`app/producto/[slug]/page.tsx:482`) — patrón seguro
- No se encontró `innerHTML` directo con datos de usuario

### 16. Restringir archivos (uploads) — ⚠️ PARCIAL

Validación actual:

- Tamaño máximo: 5MB (`models.py:483`, `659`)
- Extensiones: `.jpg`, `.jpeg`, `.png`, `.webp` (`models.py:484`, `660`)

Problemas:

- Validación solo por extensión (`os.path.splitext`), no por magic bytes / MIME type
- `ImageField` con Pillow mitiga parcialmente
- Inconsistencia: `DATA_UPLOAD_MAX_MEMORY_SIZE` default (2.5MB) vs límite del modelo (5MB)

### 17. Devolver solo datos necesarios — ✅ OK

- Serializers públicos con `fields = [...]` explícito
- No se exponen `is_staff`, `is_superuser`, `password`
- Serializers de admin separados de los públicos
- API de catálogo filtra productos inactivos

### 18. Security headers — ⚠️ PARCIAL

Presentes:

- `XFrameOptionsMiddleware` con valor `DENY` (`settings.py:152`)
- `SecurityMiddleware` de Django (`settings.py:143`)

Faltan:

- `SECURE_HSTS_SECONDS` — no hay HSTS
- `Content-Security-Policy`
- `Referrer-Policy`
- `Permissions-Policy`
- CORS explícito (`django-cors-headers` no instalado)

### 19. Forzar HTTPS — ⚠️ PARCIAL

- `SECURE_PROXY_SSL_HEADER` configurado para Render (`settings.py:91`)
- `SECURE_SSL_REDIRECT` controlado por env var, default `False` (`settings.py:98`)
- Verificar que Render tenga "Force HTTPS" activo en el dashboard

### 20. Escanear dependencias — ⚠️ PARCIAL

- `bandit` configurado (SAST Python)
- Django 5.2.17, DRF 3.17.2, Pillow 12.3.0 — al día

Faltan:

- `pip-audit` para vulnerabilidades Python
- `npm audit` para vulnerabilidades JS
- Dependabot o Snyk no configurados
- No hay CI step de auditoría de dependencias

---

## Prioridades críticas

1. Rate limit en login/OTP (`views_auth.py`) — vulnerable a brute force
2. Security headers — HSTS, CSP, CORS
3. CAPTCHA en checkout — Cloudflare Turnstile
4. Encriptar `cedula` — compliance Ley 1581/2012
5. Escaneo de dependencias — `pip-audit` + `npm audit` en CI

---

*Auditoría generada por QA Intelligence · JARVIS · 2026-10-28*
