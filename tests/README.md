# E2E con Playwright

Todo el detalle de tests, mocks y datos sandbox vive aquí para no inflar el README raíz.

## Requisitos

- Node.js 18+
- Browsers: `npm ci` en esta carpeta y `npx playwright install chromium`

## Comandos

```bash
cd tests

# UI interactiva
npx playwright test --ui

# Como en CI (headless)
CI=true npx playwright test

# Un archivo
npx playwright test e2e/checkout.spec.ts

# Reporte HTML
npx playwright test && npx playwright show-report
```

**Nota:** Ejecutar siempre desde `tests/` (aquí están `package.json` y `playwright.config.ts`). El `webServer` levanta el mock en `:3001` y Next en `:3000` con `DJANGO_API_BASE` apuntando al mock. Si reutilizas tu propio `next dev`, en `frontend/` usa `DJANGO_API_BASE=http://localhost:3001`.

El spec **`payments-nequi-sandbox.spec.ts`** **no** corre con el config por defecto (`testIgnore` en `playwright.config.ts` incluye el patrón sandbox); usa **`playwright.sandbox.config.ts`** (ver § E2E Wompi sandbox).

## Cobertura actual por spec

| Spec | Enfoque |
|------|---------|
| `e2e/smoke.spec.ts` | Home, `/health`, catálogo, PDP fixture 88, checkout, legal, 404 |
| `e2e/catalog.spec.ts` | Grid, precio, PDP, vacío, mobile |
| `e2e/product.spec.ts` | PDP, variantes, guía tallas, agotado (slug 99), mobile |
| `e2e/cart.spec.ts` | Carrito, mini cart, persistencia, mobile |
| `e2e/navigation.spec.ts` | Header, logo, menú mobile (`fixme` en un caso), categoría |
| `e2e/checkout.spec.ts` | Formulario, envío, submit, **stub** widget Wompi APPROVED/DECLINED, errores API, stock warning, mobile |
| `e2e/payments-nequi-sandbox.spec.ts` | Wompi **sandbox real** Nequi (local o CI con secret; ver § E2E Wompi sandbox) |

El checkout en CI sigue usando **stub** del widget (`e2e/fixtures/api-mocks.ts`). No hay E2E de correos transaccionales.

## E2E Wompi sandbox (opt-in)

**Alcance:** no hay E2E sandbox automatizado para *todos* los métodos de pago. Solo **`payments-nequi-sandbox.spec.ts`** ejerce el widget Wompi **real** (sandbox) con **Nequi**, en variantes **aprobada y declinada**, para validar la integración extremo a extremo. En CI estándar, el checkout sigue usando **stub** (`checkout.spec.ts`). Otros métodos: datos de prueba en `WOMPI_SANDBOX` sin spec Playwright dedicado por ahora — ver **`TECH_DEBT_AND_ROADMAP.md`** §6.

**Datos de prueba no secretos:** `e2e/fixtures/wompi-sandbox.ts` (`WOMPI_SANDBOX`: Nequi en uso por el spec; también tarjeta, PSE, Daviplata, QR, Puntos para referencia futura).

**Llaves:** en `.env` del backend y `frontend/.env.local` (`NEXT_PUBLIC_WOMPI_PUBLIC_KEY`, etc.), como en desarrollo normal. No commitear secretos.

**Config:** `playwright.sandbox.config.ts` — **no** levanta `mock-backend.mjs`. Tenés que arrancar **Django + Next** apuntando al API real (mismo criterio que probás a mano en local/staging).

**Flag obligatorio:**

```bash
export RUN_WOMPI_SANDBOX_E2E=1
# opcional: URL del storefront si no es localhost:3000
# export SANDBOX_BASE_URL=https://tu-preview.vercel.app

cd tests
npx playwright test -c playwright.sandbox.config.ts
```

O en un solo comando:

```bash
cd tests && RUN_WOMPI_SANDBOX_E2E=1 npx playwright test -c playwright.sandbox.config.ts
```

**Carrito:** `payments-sandbox-helpers` arma `localStorage` `kame-cart` desde `/api/catalogo/` y el PDP (`E2E_SANDBOX_PRODUCT_SLUG` opcional si el primero del listado no tiene stock).

**Sandbox activo:**

| Archivo | Estado |
|---------|--------|
| `payments-nequi-sandbox.spec.ts` | Checkout real → widget Wompi → Nequi (teléfonos sandbox) → `/checkout/resultado` (`APPROVED` / `DECLINED`). |

### CI (GitHub Actions)

En **`.github/workflows/e2e.yml`** el workflow se dispara solo con **`pull_request` hacia `main`** o **`workflow_dispatch`** (no con `push`), para **una sola corrida** por actualización de PR; el merge a `main` no vuelve a ejecutar este archivo. El job **`Playwright E2E`** usa mock + Next local (sin Wompi real). El job **`Playwright Wompi Nequi (sandbox)`** (`needs: e2e`) corre en ese mismo run si existe el secret de URL; si no, se omite (no falla el workflow).

| Secret (repo) | Obligatorio | Uso |
|---------------|-------------|-----|
| `E2E_SANDBOX_BASE_URL` | Sí, para que el job exista | Debe ser **Repository secret** (pestaña *Secrets*), no *Variable*. Valor: solo la URL HTTPS del storefront. Sin este secret el sandbox **se omite** (no falla el workflow). |
| `E2E_SANDBOX_WOMPI_PUBLIC_KEY` | No | `pub_test_…` para `addInitScript` en Playwright si el build del sitio no expone `NEXT_PUBLIC_WOMPI_PUBLIC_KEY` al entorno del runner. |

Los PR desde **forks** no reciben secrets; en **push** al mismo repo el secret del repo sí aplica.

## Variables opcionales `.env.test`

Podés crear `tests/.env.test` (no commitear) si cargás secretos adicionales con dotenv en el futuro. Hoy las llaves Wompi salen del entorno del proceso (backend/frontend ya configurados).

## Datos de prueba Wompi

Convención en repo: **`WOMPI_SANDBOX`** en código + [docs.wompi.co](https://docs.wompi.co). **No pegues claves de producción en el repo.**

## Más contexto

- Auditoría, riesgos y roadmap E2E (pagos/correos): `TECH_DEBT_AND_ROADMAP.md`
