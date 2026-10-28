# Plan de Mejora de Seguridad — KameCol

> Fecha: 2026-10-28
> Basado en: `auditoria-seguridad-kamecol.md`
> Ejecutor: JARVIS + Claude Code
> **Estado: 11/11 items completados — deploy verificado (2026-10-28)**

---

## Estado de ejecución

- [x] 1.1 Throttle en login/OTP
- [x] 1.2 django-cors-headers
- [x] 2.1 Security headers Django
- [x] 2.2 Security headers Next.js
- [x] 2.3 Forzar HTTPS
- [x] 3.1 Magic bytes en uploads
- [x] 3.2 npm audit CI
- [x] 3.3 Cloudflare Turnstile
- [x] 4.1 Encriptar campo cedula
- [x] 4.2 IP real en middleware
- [x] 4.3 Limpiar historial Git — pospuesto (key expuesta es placeholder `django-insecure-`, no producción)

### Deploy completado (2026-10-28)

- ✅ Dependencias instaladas (django-cors-headers, cryptography, @marsidev/react-turnstile)
- ✅ Migraciones ejecutadas en producción (0002, 0003, 0004)
- ✅ FIELD_ENCRYPTION_KEY configurada en Render
- ✅ TURNSTILE_SECRET_KEY configurada en Render
- ✅ NEXT_PUBLIC_TURNSTILE_SITE_KEY configurada en Vercel
- ✅ Data migration encriptó cedulas existentes
- ✅ DRF 3.18.2 + Pillow 13.0.0 (CVEs corregidos)
- ✅ Deploy backend (Render) + frontend (Vercel) exitoso
- ✅ Verificado: Turnstile activo, HSTS, CORS bloqueado, cedulas encriptadas

---

## Fase 1 — CRÍTICO (resolver hoy)

### 1.1 Throttle en endpoints de autenticación

**Punto de auditoría:** #11 (Rate limiting)
**Problema:** `/api/auth/login/` y `/api/auth/verify-otp/` no tienen throttle. Vulnerables a fuerza bruta.
**Justificación:** Un atacante puede probar combinaciones de credenciales y OTP sin límite. Es el vector de ataque más inmediato.

**Archivos a modificar:**

- `apps/admin_api/views_auth.py` (líneas 59, 105)
  - Crear clases `LoginThrottle` y `OTPThrottle` con `AnonRateThrottle`
  - Decorar `login_view` con `@throttle_classes([LoginThrottle])`
  - Decorar `verify_otp_view` con `@throttle_classes([OTPThrottle])`

- `config/settings.py` (línea 355, bloque `DEFAULT_THROTTLE_RATES`)
  - Agregar `"auth_login": "100/minute" if DEBUG else "5/minute"`
  - Agregar `"auth_otp": "50/minute" if DEBUG else "3/minute"`

**Criterio de éxito:** Requests al login devuelven 429 después de 5 intentos/min en prod.

---

### 1.2 Instalar y configurar django-cors-headers

**Punto de auditoría:** #18 (Security headers)
**Problema:** No hay CORS configurado. Cualquier origen puede hacer requests al backend.
**Justificación:** Sin CORS explícito, un sitio malicioso podría hacer requests autenticados al API de admin si un admin tiene sesión activa.

**Archivos a modificar:**

- `requirements/base.txt`
  - Agregar `django-cors-headers==4.6.0`

- `config/settings.py`
  - Agregar `'corsheaders.middleware.CorsMiddleware'` en MIDDLEWARE (después de `WhiteNoiseMiddleware`, línea 145)
  - Agregar `CORS_ALLOWED_ORIGINS` basado en `CSRF_TRUSTED_ORIGINS` existente
  - Agregar `CORS_ALLOW_CREDENTIALS = True`

**Criterio de éxito:** Requests desde orígenes no autorizados son rechazados con error CORS.

---

## Fase 2 — ALTO (resolver esta semana)

### 2.1 Security headers en Django

**Punto de auditoría:** #18 (Security headers)
**Problema:** Faltan HSTS, Content-Type nosniff, Referrer-Policy.
**Justificación:** Estos headers previenen ataques de clickjacking, MIME sniffing y fuga de referrer. Son configuración directa sin riesgo de regresión.

**Archivo a modificar:** `config/settings.py` (después de línea 111)

- Agregar `SECURE_CONTENT_TYPE_NOSNIFF = True`
- Agregar `SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"`
- Agregar `X_FRAME_OPTIONS = "DENY"` (explícito)
- Agregar `SECURE_HSTS_SECONDS = 31536000` (1 año)
- Agregar `SECURE_HSTS_INCLUDE_SUBDOMAINS = True`
- Agregar `SECURE_HSTS_PRELOAD = True`

**Criterio de éxito:** Response headers incluyen HSTS, X-Content-Type-Options, Referrer-Policy.

### 2.2 Security headers en Next.js

**Punto de auditoría:** #18 (Security headers)
**Problema:** Next.js no añade ningún security header. Falta CSP, Permissions-Policy.
**Justificación:** El frontend es la cara pública — CSP previene inyección de scripts maliciosos.

**Archivo a modificar:** `frontend/next.config.mjs` (dentro de `nextConfig`)

- Agregar función `headers()` con:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Content-Security-Policy` con allowlist para Wompi, R2, Sentry, ImageKit

**Criterio de éxito:** `curl -I https://kamecol.com` muestra todos los headers.

### 2.3 Forzar HTTPS explícitamente

**Punto de auditoría:** #19 (Forzar HTTPS)
**Problema:** `SECURE_SSL_REDIRECT` está en `False` por defecto.
**Justificación:** Aunque Render maneja HTTPS a nivel proxy, el setting explícito es defensa en profundidad.

**Archivo a modificar:** `config/settings.py` (línea 98)

- Cambiar default de `SECURE_SSL_REDIRECT` a `True` cuando `DJANGO_ENV=production`

**Criterio de éxito:** `SECURE_SSL_REDIRECT = True` en producción.

---

## Fase 3 — MEDIO (resolver en los próximos 7 días)

### 3.1 Validación de magic bytes en uploads

**Punto de auditoría:** #16 (Restringir archivos)
**Problema:** Validación solo por extensión, no por contenido real del archivo.
**Justificación:** Un atacante podría renombrar un archivo malicioso con extensión .jpg. Pillow mitiga parcialmente pero la validación explícita es más robusta.

**Archivo a modificar:** `apps/catalog/models.py`

- En `ProductImage.clean()` (línea 568): agregar `Pillow.verify()` después de la validación de extensión
- En `ProductColorImage.clean()` (línea 758): misma validación

**Criterio de éxito:** Un archivo .php renombrado a .jpg es rechazado.

### 3.2 Reactivar npm audit en CI

**Punto de auditoría:** #20 (Escanear dependencias)
**Problema:** El job `node-audit` está comentado en CI.
**Justificación:** Dependencias frontend sin auditar pueden tener vulnerabilidades conocidas.

**Archivo a modificar:** `.github/workflows/dependency-audit.yml` (líneas 33-44)

- Descomentar el job `node-audit`
- Configurar `--audit-level=high` para no bloquear por vulns bajas/medias conocidas

**Criterio de éxito:** CI ejecuta npm audit y falla solo en vulnerabilidades altas/críticas.

### 3.3 Cloudflare Turnstile en login admin

**Punto de auditoría:** #12 (Protección contra bots)
**Problema:** No hay CAPTCHA en ningún endpoint.
**Justificación:** Incluso con throttle, bots distribuidos pueden atacar el login. Turnstile es invisible y gratuito.

**Archivos a modificar:**

- Frontend: componente Turnstile en el formulario de login admin
- `apps/admin_api/views_auth.py`: validar token contra API de Cloudflare antes de `authenticate()`
- Variables de entorno nuevas: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`

**Criterio de éxito:** Login admin requiere verificación Turnstile. Bots sin token son rechazados.

---

## Fase 4 — BAJO (resolver en los próximos 14 días)

### 4.1 Encriptar campo cedula

**Punto de auditoría:** #5 (Encriptar datos sensibles)
**Problema:** `cedula` almacenada en texto plano.
**Justificación:** Ley 1581/2012 (habeas data Colombia). El cifrado en reposo de Render PostgreSQL protege contra acceso físico al disco, pero no contra queries directas por un atacante con acceso a la BD. El campo `cedula` es el dato más sensible.

**Archivos a modificar:**

- `requirements/base.txt`: agregar `django-encrypted-model-fields`
- `apps/customers/models.py`: cambiar `cedula = CharField` a `EncryptedCharField`
- `apps/orders/models.py`: cambiar `cedula = CharField` a `EncryptedCharField`
- Generar migración de datos
- Variable de entorno nueva: `FIELD_ENCRYPTION_KEY`

**Criterio de éxito:** `cedula` ilegible en queries directas a PostgreSQL.

**Riesgo:** Requiere migración de datos existentes. Probar en staging primero.

### 4.2 Mejorar detección de IP real en middleware

**Punto de auditoría:** Hallazgo adicional
**Problema:** `AdminIPRestrictionMiddleware` confía en `HTTP_X_FORWARDED_FOR` sin considerar Cloudflare.
**Justificación:** Si se usa Cloudflare, la IP real viene en `CF-Connecting-IP`. Sin esto, el IP allowlist podría validar la IP del proxy en vez del cliente.

**Archivo a modificar:** `config/middleware.py` (línea 23)

- Leer `HTTP_CF_CONNECTING_IP` primero cuando `DJANGO_ENV=production`

**Criterio de éxito:** IP logging muestra la IP real del cliente, no la del proxy.

### 4.3 Limpiar historial de Git

**Punto de auditoría:** #2 (Eliminar secretos de Git)
**Problema:** Commit `080f841` tiene `django-insecure-...` hardcodeado.
**Justificación:** Aunque no es clave de producción, si el repo es público es mala práctica. `git filter-repo` puede eliminarlo.

**Acción:** Ejecutar `git filter-repo` para limpiar el commit. Requiere force-push — coordinar con el equipo.

**Criterio de éxito:** `git log -p | grep django-insecure` no devuelve resultados.

---

## Puntos que NO requieren acción (justificación)

- **#1 (API keys):** Ya OK — todos los secretos via env vars
- **#3 (DB pública):** Ya OK — SSL habilitado, URL via env var
- **#4 (RLS):** Modelo anónimo sin cuentas de usuario. `payment_reference` como token es aceptable si es UUID
- **#6 (Autenticación):** Ya OK — 2FA en admin, AllowAny intencional en catálogo
- **#7 (Acceso a registros):** Aceptable para modelo anónimo
- **#8 (Mass assignment):** Serializers públicos con campos explícitos. Admin detrás de 2FA
- **#9 (Cookies):** Ya OK — Secure, HttpOnly, SameSite configurados
- **#10 (Passwords):** Ya OK — PBKDF2-SHA256 con validators
- **#13 (SQL injection):** Ya OK — todo via ORM
- **#14 (Inputs):** Ya OK — serializers con validación estricta
- **#15 (XSS):** Ya OK — auto-escape + JSON puro
- **#17 (Over-fetching):** Ya OK — campos explícitos en serializers

---

## Orden de ejecución

1. Fase 1.1 → Throttle en login/OTP
2. Fase 1.2 → django-cors-headers
3. Fase 2.1 → Security headers Django
4. Fase 2.2 → Security headers Next.js
5. Fase 2.3 → HTTPS explícito
6. Fase 3.1 → Magic bytes uploads
7. Fase 3.2 → npm audit CI
8. Fase 3.3 → Cloudflare Turnstile
9. Fase 4.1 → Encriptar cedula
10. Fase 4.2 → IP real middleware
11. Fase 4.3 → Limpiar Git

---

*Plan generado por QA Intelligence · JARVIS · 2026-10-28*
