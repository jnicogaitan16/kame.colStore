# E2E con Playwright

Todo el detalle de tests, mocks y (futuros) datos sandbox vive aquí para no inflar el README raíz.

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

## Cobertura actual por spec

| Spec | Enfoque |
|------|---------|
| `e2e/smoke.spec.ts` | Home, `/health`, catálogo, PDP fixture 88, checkout, legal, 404 |
| `e2e/catalog.spec.ts` | Grid, precio, PDP, vacío, mobile |
| `e2e/product.spec.ts` | PDP, variantes, guía tallas, agotado (slug 99), mobile |
| `e2e/cart.spec.ts` | Carrito, mini cart, persistencia, mobile |
| `e2e/navigation.spec.ts` | Header, logo, menú mobile (`fixme` en un caso), categoría |
| `e2e/checkout.spec.ts` | Formulario, envío, submit, **stub** widget Wompi APPROVED/DECLINED, errores API, stock warning, mobile |

Hoy el checkout E2E **no** usa tarjetas sandbox reales ni Nequi/Daviplata; el widget se sustituye en `e2e/fixtures/api-mocks.ts`. No hay E2E de correos transaccionales.

## Variables de entorno para tests contra sandbox real (futuro)

Crear `tests/.env.test` (no commitear secretos):

```env
# Wompi sandbox — valores de tu cuenta de pruebas
WOMPI_PUBLIC_KEY_TEST=pub_test_...
WOMPI_INTEGRITY_SECRET_TEST=...
WOMPI_EVENTS_SECRET_TEST=...
TEST_CARD_APPROVED=...
TEST_CARD_DECLINED=...
TEST_NEQUI_NUMBER=...
TEST_DAVIPLATA_NUMBER=...
RESEND_API_KEY_TEST=...
```

Cargarlas en el proceso que ejecute Playwright cuando escribas specs contra el sandbox. Plan y brechas: **`TECH_DEBT_AND_ROADMAP.md`** (raíz), sección 6.

## Datos de prueba Wompi

La fuente de verdad es [docs.wompi.co](https://docs.wompi.co) (sandbox, tarjetas de prueba, Nequi/Daviplata). **No pegues claves de producción en el repo.**

## Más contexto

- Auditoría, riesgos y roadmap E2E (pagos/correos): `TECH_DEBT_AND_ROADMAP.md`
