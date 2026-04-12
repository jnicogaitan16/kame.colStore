import {
  expect,
  type APIResponse,
  type Frame,
  type FrameLocator,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";

/**
 * Fixture sandbox Wompi — **solo Nequi** (`payments-nequi-sandbox.spec.ts`).
 * Rutas/stubs compartidos con el checkout real; el avance del widget es flujo Nequi únicamente.
 */

/** Documento donde vive la UI Wompi (página principal o iframe). */
type WompiDomScope = Frame | FrameLocator | Page;

/** Iframe del checkout: `Frame` concreto o `FrameLocator` (lazy). */
type WompiCheckoutBox = Frame | FrameLocator;

/**
 * Códigos reales de `apps/orders/constants.py` (no usar "BOG" legacy del mock).
 */
const CITY_PREFERENCE = [
  "BOGOTA_DC",
  "MEDELLIN",
  "CALI",
  "BARRANQUILLA",
  "BOG",
] as const;

type CatalogListRow = { slug?: string; sold_out?: boolean };
type ProductDetailJson = {
  id: number;
  name: string;
  slug: string;
  price: string | number;
  primary_card_url?: string | null;
  primary_image?: string | null;
  variants?: Array<{
    id: number;
    value?: string;
    color?: string;
    stock?: number;
    is_active?: boolean;
    image_url?: string | null;
  }>;
};

function formatPriceForCart(price: string | number): string {
  if (typeof price === "number") return price.toFixed(2);
  const n = parseFloat(String(price));
  return Number.isFinite(n) ? n.toFixed(2) : String(price);
}

/** Evita `SyntaxError` opaco si el servidor devuelve HTML (ngrok, 404 Next, proxy mal configurado). */
async function readJsonFromApiResponse(
  res: APIResponse,
  label: string
): Promise<unknown> {
  const text = await res.text();
  if (!res.ok()) {
    throw new Error(
      `E2E sandbox: ${label} → ${res.status()} ${text.slice(0, 600)}`
    );
  }
  const head = text.trimStart().slice(0, 12).toLowerCase();
  if (head.startsWith("<!doctype") || head.startsWith("<html")) {
    throw new Error(
      `E2E sandbox: ${label} devolvió HTML, no JSON. Si usás ngrok free, ` +
        `usá playwright.sandbox.config (header ngrok-skip-browser-warning) o otra URL. ` +
        `Prólogo: ${text.slice(0, 400)}`
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      `E2E sandbox: ${label}: cuerpo no es JSON válido: ${text.slice(0, 400)}`
    );
  }
}

/**
 * Arma el JSON de `kame-cart` desde la API real (variantes deben existir en la DB
 * donde corre Django; el fixture 881 de mock E2E no aplica en sandbox).
 *
 * - Sin env: primer producto del listado con `sold_out !== true`, luego PDP.
 * - `E2E_SANDBOX_PRODUCT_SLUG`: forzar slug (útil si el primero no tiene stock en pool).
 */
async function buildLiveSandboxCartJson(page: Page): Promise<string> {
  const slugOverride = process.env.E2E_SANDBOX_PRODUCT_SLUG?.trim();

  let slug: string | null = slugOverride || null;

  if (!slug) {
    const listRes = await page.request.get("/api/catalogo/?page_size=40");
    const listData = (await readJsonFromApiResponse(
      listRes,
      "GET /api/catalogo/"
    )) as { results?: CatalogListRow[] };
    const products = listData.results ?? [];
    const row = products.find((p) => p.slug && p.sold_out !== true);
    if (!row?.slug) {
      throw new Error(
        "E2E sandbox: no hay producto disponible en /api/catalogo/ (sold_out=false). " +
          "Carga catálogo/stock en la DB o define E2E_SANDBOX_PRODUCT_SLUG."
      );
    }
    slug = row.slug;
  }

  const detailRes = await page.request.get(
    `/api/products/${encodeURIComponent(slug)}/`
  );
  const product = (await readJsonFromApiResponse(
    detailRes,
    `GET /api/products/${slug}/`
  )) as ProductDetailJson;
  const variants = product.variants ?? [];
  const withStock = variants.find(
    (v) => v.is_active !== false && Number(v.stock) > 0
  );
  const v =
    withStock ??
    variants.find((x) => x.is_active !== false) ??
    variants[0];

  if (!v?.id) {
    throw new Error(
      `E2E sandbox: producto "${slug}" sin variantes. Usá otro E2E_SANDBOX_PRODUCT_SLUG.`
    );
  }

  const labelBits = [v.value, v.color]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  const variantLabel = labelBits.length ? labelBits.join(" / ") : "—";

  const imageUrl =
    (typeof v.image_url === "string" && v.image_url) ||
    (typeof product.primary_card_url === "string" && product.primary_card_url) ||
    (typeof product.primary_image === "string" && product.primary_image) ||
    null;

  const cartState = {
    state: {
      items: [
        {
          variantId: v.id,
          productId: product.id,
          productName: product.name,
          productSlug: product.slug,
          variantLabel,
          price: formatPriceForCart(product.price),
          quantity: 1,
          imageUrl,
        },
      ],
      stockWarningsByVariantId: {},
      stockHintsByVariantId: {},
      lastStockValidateRequestId: 0,
      stockValidateStatus: "idle" as const,
      lastStockValidateAt: 0,
    },
    version: 0,
  };

  return JSON.stringify(cartState);
}

/** `SANDBOX_BASE_URL` vacío → config usa localhost; explícito localhost/127 también. */
function isLocalSandboxBaseUrl(): boolean {
  const b = (process.env.SANDBOX_BASE_URL || "").trim().toLowerCase();
  return (
    b === "" ||
    b.includes("localhost") ||
    b.includes("127.0.0.1")
  );
}

/**
 * Abre checkout con carrito persistido en `kame-cart` (DB real vía API).
 *
 * - `addInitScript` + `goto(load)`.
 * - **Cualquier base remota** (Vercel, ngrok, staging): segundo paso `evaluate` + `reload(load)`
 *   para que Zustand `rehydrate()` lea el carrito (en CI el secret suele ser URL sin "ngrok").
 * - **ngrok free:** `setExtraHTTPHeaders` con bypass de la página de aviso.
 */
async function openCheckoutWithSandboxCart(page: Page): Promise<void> {
  const baseLower = (process.env.SANDBOX_BASE_URL || "").trim().toLowerCase();
  const isNgrok = baseLower.includes("ngrok");
  const isRemote = !isLocalSandboxBaseUrl();

  if (isNgrok) {
    await page.setExtraHTTPHeaders({
      "x-test-env": "playwright-wompi-sandbox",
      "ngrok-skip-browser-warning": "true",
    });
  }

  const raw = await buildLiveSandboxCartJson(page);

  await page.context().addInitScript(
    (cartJson: string) => {
      try {
        localStorage.setItem("kame-cart", cartJson);
      } catch {
        /* ignore */
      }
    },
    raw
  );

  await page.goto("/checkout", { waitUntil: "load" });

  if (isRemote) {
    await page.evaluate((cartJson: string) => {
      localStorage.setItem("kame-cart", cartJson);
    }, raw);
    await page.reload({ waitUntil: "load" });
  }

  await expect(page.locator("#full_name")).toBeVisible({ timeout: 45_000 });
  await page.locator("form").waitFor({ state: "visible", timeout: 20_000 });
}

/** Datos válidos para el formulario (alineados con checkout.spec). */
const SANDBOX_CHECKOUT_FORM = {
  fullName: "Test Sandbox E2E",
  phone: "3001234567",
  email: "sandbox-e2e@test.kame.col",
  cedula: "123456789",
  address: "Calle 100 # 15-20",
} as const;

/**
 * Rellena el checkout; ciudad según CITY_CHOICES del backend.
 */
async function fillSandboxCheckoutForm(page: Page): Promise<void> {
  await page.locator("#full_name").fill(SANDBOX_CHECKOUT_FORM.fullName);
  await page.locator("#phone").fill(SANDBOX_CHECKOUT_FORM.phone);
  await page.locator("#email").fill(SANDBOX_CHECKOUT_FORM.email);
  await page.locator("#cedula").fill(SANDBOX_CHECKOUT_FORM.cedula);
  await page.locator("#address").fill(SANDBOX_CHECKOUT_FORM.address);

  const citySelect = page.locator("#city_code");
  await citySelect.waitFor({ state: "visible", timeout: 15_000 });

  let selected = false;
  for (const code of CITY_PREFERENCE) {
    const opt = citySelect.locator(`option[value="${code}"]`);
    if ((await opt.count()) > 0) {
      await citySelect.selectOption(code);
      selected = true;
      break;
    }
  }
  if (!selected) {
    const opts = citySelect.locator('option[value]:not([value=""])');
    const n = await opts.count();
    for (let i = 0; i < n; i++) {
      const v = await opts.nth(i).getAttribute("value");
      if (v) {
        await citySelect.selectOption(v);
        break;
      }
    }
  }
}

/** Botón habilitado: stock-validate terminó y sin bloqueos. */
async function waitForSubmitReady(page: Page): Promise<void> {
  const submitBtn = page.getByRole("button", { name: /confirmar pedido/i });
  await submitBtn.waitFor({ state: "visible", timeout: 15_000 });
  await expect(submitBtn).toBeEnabled({ timeout: 45_000 });
}

async function submitCheckoutForm(page: Page): Promise<void> {
  await waitForSubmitReady(page);
  const submitBtn = page.getByRole("button", { name: /confirmar pedido/i });
  await submitBtn.click();
}

/** Respuesta del proxy Next → Django para crear la orden. */
function waitForCheckoutPostResponse(
  page: Page,
  opts?: { timeout?: number }
) {
  const timeout = opts?.timeout ?? 45_000;
  return page.waitForResponse(
    (r) => {
      if (r.request().method() !== "POST") return false;
      try {
        const path = new URL(r.url()).pathname.replace(/\/$/, "");
        return path.endsWith("/checkout");
      } catch {
        return r.url().includes("/checkout");
      }
    },
    { timeout }
  );
}

async function assertCheckoutCreated(res: {
  status: () => number;
  text: () => Promise<string>;
}): Promise<void> {
  const body = await res.text().catch(() => "");
  expect(
    res.status(),
    `checkout POST: status=${res.status()} body=${body.slice(0, 2500)}`
  ).toBe(201);
}

function wompiLoadingTimeoutMs(): number {
  const n = Number(process.env.E2E_WOMPI_LOADING_MS);
  return Number.isFinite(n) && n > 0 ? n : 20_000;
}

function wompiWidgetTimeoutMs(): number {
  const n = Number(process.env.E2E_WOMPI_WIDGET_MS);
  return Number.isFinite(n) && n > 0 ? n : 35_000;
}

/**
 * Pausa **después** de ver el copy de carga del waybox («Cargando…», «espera un momento») o, si no
 * aparece, igual da un respiro antes de buscar Nequi (remounts / red). Default **5000** ms;
 * `E2E_WOMPI_WIDGET_SETTLE_MS=0` lo desactiva.
 */
function wompiWidgetSettleAfterAttachMs(): number {
  const n = Number(process.env.E2E_WOMPI_WIDGET_SETTLE_MS);
  if (Number.isFinite(n) && n >= 0) return n;
  return 5000;
}

/**
 * Tras navegar dentro del iframe a **«Paga con Nequi»**, el bundle a veces tarda en hidratar
 * (`null.status` en consola si interactuamos antes). Una pausa **única** aquí evita que el bucle
 * principal (`pollMs` 250) martillee la vista como si se recargara la página.
 * `E2E_WOMPI_NEQUI_HYDRATE_MS=0` la desactiva.
 */
function wompiNequiWalletHydrateMs(): number {
  const n = Number(process.env.E2E_WOMPI_NEQUI_HYDRATE_MS);
  if (Number.isFinite(n) && n >= 0) return n;
  return 1_600;
}

/**
 * Cuando ya estamos en flujo Nequi / espera push pero `tryAdvance` aún no avanza, no usar `pollMs`
 * corto: menos vueltas, menos “Wait for timeout” en el trace. Default **1200** ms.
 * `E2E_WOMPI_NEQUI_IDLE_POLL_MS=400` (mínimo 250) para afinar.
 */
function wompiNequiIdlePollMs(): number {
  const n = Number(process.env.E2E_WOMPI_NEQUI_IDLE_POLL_MS);
  if (Number.isFinite(n) && n >= 250) return n;
  return 1_200;
}

/** Entre comprobaciones en `waitAfterNequiContinueSubmitted` (evita miles de waits ~120 ms en trace). */
function wompiPostContinueLoopSleepMs(): number {
  const n = Number(process.env.E2E_WOMPI_POST_CONTINUE_POLL_MS);
  if (Number.isFinite(n) && n >= 200) return n;
  return 900;
}

/** v1.js pide `GET …/merchants/undefined/checkout` en api-sandbox **y** en `wompijs.wompi.com`. */
const WOMPI_UNDEFINED_MERCHANT_CHECKOUT_JSON = JSON.stringify({
  data: {
    id: 1,
    publicKey: "pub_test_e2e_undefined_fallback",
    name: "E2E sandbox (stub undefined)",
    acceptedPaymentMethods: [
      "NEQUI",
      "CARD",
      "DAVIPLATA",
      "PSE",
      "BANCOLOMBIA_QR",
      "PCOL",
    ],
    acceptedCurrencies: ["COP"],
    fraudGroups: [],
    fraudJavascriptKey: null,
    presignedAcceptance: null,
    presignedPersonalDataAuth: null,
  },
});

const e2eWompiPubKeyInjected = new WeakSet<Page>();
const wompiMerchantsUndefinedCatchAllInstalled = new WeakSet<Page>();

/**
 * Inyecta la llave pública antes del bundle de Next: si el cliente quedó sin `NEXT_PUBLIC_*` en
 * build, v1.js usa `undefined` y el antifraud falla. Lee `E2E_WOMPI_PUBLIC_KEY` o
 * `NEXT_PUBLIC_WOMPI_PUBLIC_KEY` del proceso Node (`playwright.sandbox.config.ts` puede cargar
 * `frontend/.env.local`). Desactivar: `E2E_WOMPI_DISABLE_PUBKEY_INJECT=1`.
 */
async function ensureE2EWompiPublicKeyInject(page: Page): Promise<void> {
  if (process.env.E2E_WOMPI_DISABLE_PUBKEY_INJECT === "1") return;
  if (e2eWompiPubKeyInjected.has(page)) return;
  const k =
    process.env.E2E_WOMPI_PUBLIC_KEY?.trim() ||
    process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY?.trim() ||
    "";
  if (!k || k === "undefined" || k === "null") return;
  if (!/^pub_(test|prod)_/i.test(k)) return;

  await page.addInitScript((key: string) => {
    (globalThis as unknown as { __KAME_E2E_WOMPI_PUBLIC_KEY__: string }).__KAME_E2E_WOMPI_PUBLIC_KEY__ =
      key;
  }, k);
  e2eWompiPubKeyInjected.add(page);
}

/**
 * Última línea de defensa: `merchants/undefined` puede ir a checkout.wompi.co, api-sandbox u otro
 * host *.wompi*; Playwright aplica la ruta más reciente primero — registrar esto al final.
 * Desactivar: `E2E_WOMPI_DISABLE_UNDEFINED_MERCHANT_CATCHALL=1`.
 */
async function ensureWompiMerchantsUndefinedCatchAll(page: Page): Promise<void> {
  if (process.env.E2E_WOMPI_DISABLE_UNDEFINED_MERCHANT_CATCHALL === "1") return;
  if (wompiMerchantsUndefinedCatchAllInstalled.has(page)) return;

  const checkoutOrigin = "https://checkout.wompi.co";
  const jsonHeaders = {
    "Access-Control-Allow-Origin": checkoutOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json; charset=utf-8",
  } as const;

  await page.route(
    (url) => {
      try {
        const h = url.hostname.toLowerCase();
        if (!h.includes("wompi")) return false;
        const p = decodeURIComponent(url.pathname).toLowerCase();
        return p.includes("merchants/undefined");
      } catch {
        return false;
      }
    },
    async (route) => {
      const req = route.request();
      const method = req.method();
      const ul = req.url().toLowerCase();

      if (method === "OPTIONS") {
        const h = req.headers();
        const allowHeaders =
          h["access-control-request-headers"] ||
          "authorization,content-type,x-requested-with,accept,origin";
        await route.fulfill({
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": checkoutOrigin,
            "Access-Control-Allow-Methods":
              "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": allowHeaders,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "86400",
          },
        });
        return;
      }

      if (method === "GET") {
        if (ul.includes("/contact")) {
          await route.fulfill({
            status: 200,
            headers: jsonHeaders,
            body: JSON.stringify({ data: {} }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          headers: jsonHeaders,
          body: WOMPI_UNDEFINED_MERCHANT_CHECKOUT_JSON,
        });
        return;
      }

      await route.continue();
    }
  );
  wompiMerchantsUndefinedCatchAllInstalled.add(page);
}

const wompiCheckPcoCatchAllInstalled = new WeakSet<Page>();

/**
 * `GET …/merchants/{pub}/check_pco_blacklist` puede devolver **404 NOT_FOUND** si Wompi no tiene
 * esa entidad en sandbox; el widget igual lo intenta. Catch-all en cualquier host `*wompi*` (última
 * ruta registrada) para E2E. **Chrome manual sin Playwright:** el 404 es real → revisá llave y
 * comercio en el panel Wompi.
 * Desactivar: `E2E_WOMPI_DISABLE_CHECK_PCO_CATCHALL=1` o `E2E_WOMPI_DISABLE_GLOBAL_STUBS=1`.
 */
async function ensureWompiCheckPcoCatchAll(page: Page): Promise<void> {
  if (process.env.E2E_WOMPI_DISABLE_CHECK_PCO_CATCHALL === "1") return;
  if (process.env.E2E_WOMPI_DISABLE_GLOBAL_STUBS === "1") return;
  if (wompiCheckPcoCatchAllInstalled.has(page)) return;

  const checkoutOrigin = "https://checkout.wompi.co";
  const body = JSON.stringify({
    data: { in_blacklist: false, blacklisted: false },
    status: "ok",
  });
  const jsonHeaders = {
    "Access-Control-Allow-Origin": checkoutOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json; charset=utf-8",
  } as const;

  await page.route(
    (url) => {
      try {
        const h = url.hostname.toLowerCase();
        if (!h.includes("wompi")) return false;
        const href = url.href.toLowerCase();
        const path = decodeURIComponent(url.pathname).toLowerCase();
        return href.includes("check_pco_blacklist") || path.includes("check_pco_blacklist");
      } catch {
        return false;
      }
    },
    async (route) => {
      const req = route.request();
      if (req.method() === "OPTIONS") {
        const h = req.headers();
        const allowHeaders =
          h["access-control-request-headers"] ||
          "authorization,content-type,x-requested-with,accept,origin";
        await route.fulfill({
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": checkoutOrigin,
            "Access-Control-Allow-Methods":
              "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": allowHeaders,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Max-Age": "86400",
          },
        });
        return;
      }
      await route.fulfill({ status: 200, headers: jsonHeaders, body });
    }
  );
  wompiCheckPcoCatchAllInstalled.add(page);
}

const sandboxBrowserConsoleFilterInstalled = new WeakSet<Page>();

/**
 * En el documento principal (localhost) reduce ruido: mensaje de React DevTools y, por defecto,
 * líneas `VALIDATE …` del store. Desactivar filtro de VALIDATE: `E2E_PLAYWRIGHT_FILTER_VALIDATE_LOGS=0`.
 * Desactivar todo el hook: `E2E_WOMPI_DISABLE_BROWSER_CONSOLE_FILTER=1`.
 */
async function ensureSandboxBrowserConsoleFilter(page: Page): Promise<void> {
  if (process.env.E2E_WOMPI_DISABLE_BROWSER_CONSOLE_FILTER === "1") return;
  if (sandboxBrowserConsoleFilterInstalled.has(page)) return;
  sandboxBrowserConsoleFilterInstalled.add(page);

  const filterValidate =
    process.env.E2E_PLAYWRIGHT_FILTER_VALIDATE_LOGS !== "0";

  await page.addInitScript(
    (opts: { filterValidate: boolean }) => {
      const suppress = (args: unknown[]) => {
        const s = typeof args[0] === "string" ? args[0] : "";
        if (s.includes("Download the React DevTools")) return true;
        if (opts.filterValidate && s.includes("VALIDATE ")) return true;
        return false;
      };
      for (const name of ["log", "info", "debug"] as const) {
        const orig = console[name].bind(console);
        console[name] = (...args: unknown[]) => {
          if (suppress(args)) return;
          orig(...args);
        };
      }
    },
    { filterValidate }
  );
}

const sandboxCheckPcoStubInstalled = new WeakSet<Page>();

/**
 * Evita 404 en endpoints tipo `check_pco_blacklist` (Wompi / Puntos Colombia) en cualquier host.
 * Debe registrarse antes del handler amplio de `api-sandbox.wompi.co`.
 * En **Chrome sin Playwright**, un 404 `NOT_FOUND_ERROR` en esa URL suele indicar que Wompi sandbox
 * no tiene registrado el comercio para `pub_test_…` de `.env.local`.
 * Desactivar: `E2E_WOMPI_DISABLE_GLOBAL_STUBS=1`.
 */
async function ensureSandboxCheckPcoStub(page: Page): Promise<void> {
  if (process.env.E2E_WOMPI_DISABLE_GLOBAL_STUBS === "1") return;
  if (sandboxCheckPcoStubInstalled.has(page)) return;
  sandboxCheckPcoStubInstalled.add(page);

  await page.route(
    (url) => url.href.toLowerCase().includes("check_pco_blacklist"),
    async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "https://checkout.wompi.co",
          "Access-Control-Allow-Credentials": "true",
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          data: { in_blacklist: false, blacklisted: false },
          status: "ok",
        }),
      });
    }
  );
}

const wompiSandboxApiCorsBypassInstalled = new WeakSet<Page>();

/**
 * Claves bajo `data` (y anidadas) que en sandbox suelen ser **objetos** con `.status`; si vienen
 * `null`, el bundle hace `null.status` → TypeError. No tocar claves que suelen ser escalares.
 */
const WOMPI_NULL_TO_EMPTY_OBJECT_KEYS = new Set(
  [
    "transaction",
    "payment_source",
    "payment_method",
    "payment_link",
    "redirect",
    "redirect_to",
    "customer",
    "payer",
    "buyer",
    "merchant",
    "order",
    "shipping_address",
    "billing_address",
    "three_ds",
    "threeds",
    "wallet",
    "nequi",
    "daviplata",
    "pse",
    "bancolombia_qr",
    "pcol",
    "card",
    "token",
    "authorization",
    "capture",
    "refund",
    "extra",
    "metadata",
    "details",
    "result",
    "error",
    "payment",
    "value",
  ].map((k) => k.toLowerCase())
);

function wompiCoerceNullNestedObjectsUnderData(node: unknown): void {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const item of node) wompiCoerceNullNestedObjectsUnderData(item);
    return;
  }
  if (typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  for (const key of Object.keys(o)) {
    const v = o[key];
    const lk = key.toLowerCase();
    if (v === null && WOMPI_NULL_TO_EMPTY_OBJECT_KEYS.has(lk)) {
      o[key] = {};
    }
    const next = o[key];
    if (next !== null && typeof next === "object") {
      wompiCoerceNullNestedObjectsUnderData(next);
    }
  }
}

/**
 * `checkout.wompi.co/bundle.js` accede a `.status` sobre objetos que a veces vienen `null` en JSON
 * real o intermedio → `TypeError`, UI inestable y E2E lleno de esperas. Solo tocamos forma mínima.
 */
function wompiSanitizeSandboxApiJsonPayload(raw: string): string {
  const t = raw.trim();
  if (t.length === 0 || (!t.startsWith("{") && !t.startsWith("["))) return raw;
  try {
    const parsed: unknown = JSON.parse(t);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return raw;
    const root = parsed as Record<string, unknown>;
    if (root.data === null) {
      root.data = {};
    }
    if (root.meta === null) {
      root.meta = {};
    }
    const data = root.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const d = data as Record<string, unknown>;
      if (d.transaction === null) {
        d.transaction = {
          id: "e2e_sanitized_null_txn",
          status: "PENDING",
          status_message: "e2e-sanitized",
        };
      }
      wompiCoerceNullNestedObjectsUnderData(d);
    } else if (Array.isArray(data)) {
      wompiCoerceNullNestedObjectsUnderData(data);
    }
    return JSON.stringify(root);
  } catch {
    return raw;
  }
}

async function wompiFulfillFetchedResponseWithCors(
  route: Route,
  response: Awaited<ReturnType<Route["fetch"]>>,
  checkoutOrigin: string
): Promise<void> {
  const status = response.status();
  const rawHeaders = response.headers();
  const merged: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawHeaders)) {
    const lk = k.toLowerCase();
    if (
      lk === "content-encoding" ||
      lk === "content-length" ||
      lk === "transfer-encoding"
    ) {
      continue;
    }
    if (typeof v === "string") merged[k] = v;
  }
  merged["Access-Control-Allow-Origin"] = checkoutOrigin;
  merged["Access-Control-Allow-Credentials"] = "true";

  const ct = (merged["content-type"] ?? merged["Content-Type"] ?? "").toLowerCase();
  if (ct.includes("application/json")) {
    const bodyText = wompiSanitizeSandboxApiJsonPayload(
      (await response.body()).toString("utf8")
    );
    await route.fulfill({
      status,
      headers: merged,
      body: bodyText,
    });
    return;
  }

  await route.fulfill({
    status,
    headers: merged,
    body: await response.body(),
  });
}

/**
 * Desde el iframe `checkout.wompi.co`, `fetch` a `api-sandbox.wompi.co` puede fallar el
 * preflight (sin `Access-Control-Allow-Origin`). Playwright intercepta la petición,
 * la completa con `route.fetch()` (sin CORS en Node) y devuelve la respuesta real con
 * cabeceras CORS para el origen del widget.
 *
 * Desactivar: `E2E_WOMPI_DISABLE_API_CORS_BYPASS=1`.
 */
async function ensureWompiSandboxApiCorsBypass(page: Page): Promise<void> {
  if (process.env.E2E_WOMPI_DISABLE_API_CORS_BYPASS === "1") return;
  if (wompiSandboxApiCorsBypassInstalled.has(page)) return;
  wompiSandboxApiCorsBypassInstalled.add(page);

  const checkoutOrigin = "https://checkout.wompi.co";
  const corsJsonHeaders = {
    "Access-Control-Allow-Origin": checkoutOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json; charset=utf-8",
  };

  const wompiApiSandboxHandler = async (route: Route) => {
    const req = route.request();
    const urlLower = req.url().toLowerCase();
    const fullUrl = req.url();
    const isPubTestContext = /pub_test_/i.test(fullUrl);

    /**
     * Playwright aplica la ruta registrada **más reciente** primero: `api-sandbox/**` ganaba al
     * stub global de `check_pco_blacklist` y el fetch real devolvía 404. Acá se acorta siempre.
     */
    if (urlLower.includes("check_pco_blacklist")) {
      await route.fulfill({
        status: 200,
        headers: corsJsonHeaders,
        body: JSON.stringify({
          data: { in_blacklist: false, blacklisted: false },
          status: "ok",
        }),
      });
      return;
    }

    if (req.method() === "OPTIONS") {
      const h = req.headers();
      const allowHeaders =
        h["access-control-request-headers"] ||
        "authorization,content-type,x-requested-with,accept,origin";
      await route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": checkoutOrigin,
          "Access-Control-Allow-Methods":
            "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": allowHeaders,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Max-Age": "86400",
        },
      });
      return;
    }

    /**
     * Antifraud (v1.js) puede pedir comercio con clave literal `undefined` si el bundle no inyectó
     * `NEXT_PUBLIC_WOMPI_PUBLIC_KEY` (dev sin reiniciar, etc.). Sin esto el waybox queda en blanco.
     */
    if (req.method() === "GET" && urlLower.includes("/merchants/undefined")) {
      if (urlLower.includes("/checkout")) {
        await route.fulfill({
          status: 200,
          headers: corsJsonHeaders,
          body: WOMPI_UNDEFINED_MERCHANT_CHECKOUT_JSON,
        });
        return;
      }
      if (urlLower.includes("/contact")) {
        await route.fulfill({
          status: 200,
          headers: corsJsonHeaders,
          body: JSON.stringify({ data: {} }),
        });
        return;
      }
    }

    /**
     * No stubear siempre `POST /v1/widget`: el flujo Nequi/tarjeta necesita sesión real en sandbox.
     * Los 422 en creación de widget se corrigen más abajo tras `route.fetch()` (`badInit` + POST widget).
     *
     * **No** acortar aquí `GET …/merchants/pub_test…/checkout`: Wompi exige en el POST de transacción
     * los tokens `presignedAcceptance` / `presignedPersonalDataAuth` que solo vienen en la respuesta
     * real de api-sandbox; si devolvemos JSON mínimo con `null` → «Acceptance token is not present!».
     * Ese GET va a `route.fetch()` abajo; solo en 4xx se usa stub de rescate.
     */

    /**
     * No acortar `feature_flags` ni `checkout_intelligence` con JSON mínimo: `active: false` y
     * `merchants: []` dejan el waybox en gris aunque `GET …/merchants/pub_test/…/checkout` esté OK.
     * Dejamos `route.fetch()` y solo abajo se stubéa si Wompi devuelve 4xx/5xx.
     */

    if (
      isPubTestContext &&
      req.method() === "GET" &&
      urlLower.includes("/merchants/") &&
      urlLower.includes("/contact")
    ) {
      await route.fulfill({
        status: 200,
        headers: corsJsonHeaders,
        body: JSON.stringify({ data: {} }),
      });
      return;
    }

    try {
      const response = await route.fetch();
      const st = response.status();

      /**
       * Con `pub_test` inválido o comercio inexistente, Wompi devuelve 401/404 y el bundle asume
       * `data.*` → `null.status`. Formas mínimas inferidas de checkout.wompi.co/bundle.js (h_ / getSmartFlag).
       */
      if (
        (st === 401 || st === 404 || st === 422 || st === 500) &&
        urlLower.includes("checkout_intelligence")
      ) {
        await route.fulfill({
          status: 200,
          headers: corsJsonHeaders,
          body: JSON.stringify({
            data: { routingLogic: {}, merchants: [] },
          }),
        });
        return;
      }

      if (
        (st === 401 || st === 404 || st === 422) &&
        urlLower.includes("/feature_flags/") &&
        req.method() === "GET"
      ) {
        await route.fulfill({
          status: 200,
          headers: corsJsonHeaders,
          body: JSON.stringify({ data: { active: true } }),
        });
        return;
      }

      /**
       * `getMerchantByPublicKey` → GET `/merchants/{pub}/checkout` en 4xx: stub para que el iframe
       * no reviente al parsear; **sin** tokens firmados → Nequi no podrá completar el POST
       * (`Acceptance token is not present!`). La llave `pub_test` debe existir en Wompi sandbox.
       */
      if (
        (st === 401 || st === 404 || st === 422) &&
        urlLower.includes("/merchants/") &&
        urlLower.includes("/checkout") &&
        req.method() === "GET"
      ) {
        const pubM = req.url().match(/\/merchants\/(pub_[^/]+)\//i);
        const publicKey = pubM?.[1] ?? "pub_test_e2e_stub";
        await route.fulfill({
          status: 200,
          headers: corsJsonHeaders,
          body: JSON.stringify({
            data: {
              id: 1,
              publicKey,
              name: "E2E sandbox (stub 4xx rescue)",
              acceptedPaymentMethods: [
                "NEQUI",
                "CARD",
                "DAVIPLATA",
                "PSE",
                "BANCOLOMBIA_QR",
                "PCOL",
              ],
              acceptedCurrencies: ["COP"],
              fraudGroups: [],
              fraudJavascriptKey: null,
              presignedAcceptance: null,
              presignedPersonalDataAuth: null,
            },
          }),
        });
        return;
      }

      if (
        (st === 401 || st === 404 || st === 422) &&
        urlLower.includes("/merchants/") &&
        urlLower.includes("/contact") &&
        req.method() === "GET"
      ) {
        await route.fulfill({
          status: 200,
          headers: corsJsonHeaders,
          body: JSON.stringify({ data: {} }),
        });
        return;
      }

      const badInit = st === 401 || st === 404 || st === 422 || st === 500;

      let pathOnly = "";
      try {
        pathOnly = new URL(req.url()).pathname.replace(/\/$/, "").toLowerCase();
      } catch {
        pathOnly = urlLower;
      }

      /** POST /v1/widget — creación de sesión del iframe; 422 aquí dispara «Error during initialization». */
      if (
        badInit &&
        req.method() === "POST" &&
        (pathOnly === "/v1/widget" || pathOnly.endsWith("/widget")) &&
        !pathOnly.includes("/widget/trm") &&
        !pathOnly.includes("click")
      ) {
        await route.fulfill({
          status: 200,
          headers: corsJsonHeaders,
          body: JSON.stringify({
            data: {
              id: "00000000-0000-0000-0000-000000000001",
              value: { widgetParams: {} },
            },
          }),
        });
        return;
      }

      /** GET /v1/widget/{sid} — getWidgetParams espera data.value.widgetParams */
      if (
        badInit &&
        req.method() === "GET" &&
        /\/v1\/widget\/[^/?]+/.test(urlLower) &&
        !urlLower.includes("/widget/time")
      ) {
        await route.fulfill({
          status: 200,
          headers: corsJsonHeaders,
          body: JSON.stringify({
            data: { value: { widgetParams: {} } },
          }),
        });
        return;
      }

      /** GET /v1/widget/time — sesión / temporizador */
      if (badInit && req.method() === "GET" && urlLower.includes("/widget/time")) {
        await route.fulfill({
          status: 200,
          headers: corsJsonHeaders,
          body: JSON.stringify({ data: 86_400_000 }),
        });
        return;
      }

      /**
       * Cualquier otro GET 4xx/500 de init (evita 422 sueltos y null.status). No tocar transacciones
       * ni tokens Nequi/tarjeta (flujo de pago real).
       */
      if (
        badInit &&
        req.method() === "GET" &&
        !urlLower.includes("/transactions/") &&
        !urlLower.includes("/tokens/")
      ) {
        await route.fulfill({
          status: 200,
          headers: corsJsonHeaders,
          body: JSON.stringify({ data: {} }),
        });
        return;
      }

      await wompiFulfillFetchedResponseWithCors(route, response, checkoutOrigin);
    } catch {
      await route.continue();
    }
  };

  await page.route("https://api-sandbox.wompi.co/**", wompiApiSandboxHandler);
  await page.route("https://api.wompi.co/**", wompiApiSandboxHandler);
}

const wompiJsSandboxStubInstalled = new WeakSet<Page>();

/**
 * `wompijs.wompi.com`: CORS vía `route.fetch()` + respuesta real. Excepción: `GET …/merchants/undefined/…`
 * va a este host (no solo a api-sandbox); hay que devolver el mismo JSON que en `ensureWompiSandboxApiCorsBypass`.
 * Desactivar: `E2E_WOMPI_DISABLE_WOMPJS_STUB=1`.
 */
async function ensureWompiJsSandboxStub(page: Page): Promise<void> {
  if (process.env.E2E_WOMPI_DISABLE_WOMPJS_STUB === "1") return;
  if (wompiJsSandboxStubInstalled.has(page)) return;
  wompiJsSandboxStubInstalled.add(page);

  const checkoutOrigin = "https://checkout.wompi.co";
  const wompiJsJsonHeaders = {
    "Access-Control-Allow-Origin": checkoutOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json; charset=utf-8",
  } as const;

  await page.route("https://wompijs.wompi.com/**", async (route) => {
    const req = route.request();
    const ul = req.url().toLowerCase();

    if (req.method() === "OPTIONS") {
      const h = req.headers();
      const allowHeaders =
        h["access-control-request-headers"] ||
        "authorization,content-type,x-requested-with,accept,origin";
      await route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": checkoutOrigin,
          "Access-Control-Allow-Methods":
            "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": allowHeaders,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Max-Age": "86400",
        },
      });
      return;
    }

    if (req.method() === "GET" && ul.includes("/merchants/undefined")) {
      if (ul.includes("/checkout")) {
        await route.fulfill({
          status: 200,
          headers: wompiJsJsonHeaders,
          body: WOMPI_UNDEFINED_MERCHANT_CHECKOUT_JSON,
        });
        return;
      }
      if (ul.includes("/contact")) {
        await route.fulfill({
          status: 200,
          headers: wompiJsJsonHeaders,
          body: JSON.stringify({ data: {} }),
        });
        return;
      }
    }

    try {
      const res = await route.fetch();
      await wompiFulfillFetchedResponseWithCors(route, res, checkoutOrigin);
    } catch {
      await route.continue();
    }
  });
}

const sandboxNoiseReductionInstalled = new WeakSet<Page>();

const META_PIXEL_FB_STUB = [
  "(function(){",
  "var w=window;",
  "w.fbq=w.fbq||function(){(w.fbq.q=w.fbq.q||[]).push(arguments)};",
  "w._fbq=w.fbq;",
  "})();",
].join("");

/**
 * Meta/Facebook + píxeles GTM/GA (rutas concretas).
 * No interceptar `gtm.js` ni el bundle principal de GTM: en el pasado rompía el widget (`net::ERR_FAILED`).
 *
 * Nota CSP: si el iframe Wompi bloquea la URL antes de red (`img-src` sin `/td`), el navegador
 * igual puede registrar la violación en consola; es ruido del sandbox Wompi, no del checkout kame.
 */
function isThirdPartyNoiseUrl(url: URL): boolean {
  const h = url.hostname;
  const ps = url.pathname + url.search;
  const path = url.pathname;

  if (
    h.includes("googletagmanager.com") &&
    (path.startsWith("/td") || path.startsWith("/a"))
  ) {
    return true;
  }
  if (h.includes("google-analytics.com") && /\/(g\/)?collect\b/.test(path)) {
    return true;
  }

  return (
    h.includes("facebook.net") ||
    (h.endsWith("facebook.com") &&
      (ps.includes("/tr") || ps.includes("fbevents")))
  );
}

/**
 * Sustituye scripts de tracking por stubs (no usar `abort`: Wompi a veces asume cuerpo/estado
 * y termina en `Cannot read properties of null (reading 'status')` en bundle.js).
 * Desactivar: `E2E_WOMPI_DISABLE_NOISE_REDUCTION=1`.
 */
async function fulfillThirdPartyNoise(route: Route): Promise<void> {
  const req = route.request();
  const urlStr = req.url();
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    await route.continue();
    return;
  }

  const path = url.pathname;
  if (
    url.hostname.includes("googletagmanager.com") &&
    (path.startsWith("/td") || path.startsWith("/a"))
  ) {
    await route.fulfill({ status: 204 });
    return;
  }
  if (
    url.hostname.includes("google-analytics.com") &&
    /\/(g\/)?collect\b/.test(path)
  ) {
    await route.fulfill({ status: 204 });
    return;
  }

  const rt = req.resourceType();
  if (
    rt === "image" ||
    /\.(gif|jpe?g|png|webp|ico)(\?|$)/i.test(url.pathname + url.search)
  ) {
    await route.fulfill({ status: 204 });
    return;
  }

  if (urlStr.includes("fbevents.js") || /fbevents/i.test(url.pathname)) {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: META_PIXEL_FB_STUB,
    });
    return;
  }

  await route.fulfill({
    status: 200,
    contentType: "application/javascript; charset=utf-8",
    body: "// e2e sandbox stub\n",
  });
}

/**
 * Stubs suaves para píxeles **Meta/Facebook** y beacons **GTM `/td`·`/a` + GA collect** (sin `gtm.js`).
 * Desactivar: `E2E_WOMPI_DISABLE_NOISE_REDUCTION=1`.
 */
async function ensureSandboxE2ENoiseReduction(page: Page): Promise<void> {
  if (process.env.E2E_WOMPI_DISABLE_NOISE_REDUCTION === "1") return;
  if (sandboxNoiseReductionInstalled.has(page)) return;
  sandboxNoiseReductionInstalled.add(page);

  await page.route(isThirdPartyNoiseUrl, fulfillThirdPartyNoise);
}

async function checkoutPasarelaErrorVisible(page: Page): Promise<boolean> {
  return page
    .getByText(/error al abrir el pago|no pudimos abrir la pasarela/i)
    .first()
    .isVisible()
    .catch(() => false);
}

/**
 * El widget Wompi pinta en iframes (cross-origin): getByText en `page` no lo ve.
 * Detectamos iframe wompi.co o el mismo copy dentro de cualquier frame.
 */
async function wompiUiDetected(page: Page): Promise<boolean> {
  /**
   * NO basta con un iframe con src *.wompi* vacío o en carga: eso hacía pasar
   * waitForWompiWidgetShell antes de pintar métodos y fallaba wompiSelectPaymentMethod.
   */
  const textHints =
    /modo de pruebas|cómo quieres pagar|cuánto vas a pagar|pago a\s|¿cuánto vas a pagar|billeteras digitales/i;
  const textEn = /test mode|how (do )?you want to pay|digital wallets/i;
  const methodHints = /\bnequi\b|daviplata|davi\s*plata|tarjeta.*débito|débito o crédito|\bPSE\b/i;

  for (const frame of page.frames()) {
    try {
      if (await frame.getByText(textHints).first().isVisible({ timeout: 60 }).catch(() => false)) {
        return true;
      }
      if (await frame.getByText(textEn).first().isVisible({ timeout: 60 }).catch(() => false)) {
        return true;
      }
      if (await frame.getByText(methodHints).first().isVisible({ timeout: 60 }).catch(() => false)) {
        return true;
      }
    } catch {
      /* frame cerrado / cross-origin transitorio */
    }
  }

  return false;
}

/**
 * Tras 201: pantalla "Cargando pasarela…" y luego widget (iframe o texto en frames).
 * Antes se esperaba 45s+90s solo en el DOM principal → lento y siempre fallaba.
 */
async function waitForWompiWidgetShell(page: Page): Promise<void> {
  const tLoad = wompiLoadingTimeoutMs();
  const tWidget = wompiWidgetTimeoutMs();
  const loading = page
    .getByText(/cargando pasarela|pasarela de pago|widget de wompi/i)
    .first();
  const loadDeadline = Date.now() + tLoad;

  while (Date.now() < loadDeadline) {
    if (await checkoutPasarelaErrorVisible(page)) {
      throw new Error(
        "Wompi: la app mostró «Error al abrir el pago» (firma, NEXT_PUBLIC_WOMPI_PUBLIC_KEY o GET wompi-signature)."
      );
    }
    if (await loading.isVisible().catch(() => false)) {
      break;
    }
    await page.waitForTimeout(200);
  }

  if (!(await loading.isVisible().catch(() => false))) {
    throw new Error(
      `No apareció «Cargando pasarela…» en ${tLoad}ms. ¿Checkout 201 y red a Django/Next OK?`
    );
  }

  const widgetDeadline = Date.now() + tWidget;
  while (Date.now() < widgetDeadline) {
    if (await checkoutPasarelaErrorVisible(page)) {
      throw new Error(
        "Wompi: error al abrir la pasarela mientras se cargaba el widget."
      );
    }
    if (await wompiUiDetected(page)) {
      return;
    }
    await page.waitForTimeout(250);
  }

  throw new Error(
    `Timeout ${tWidget}ms: no hubo iframe *.wompi* ni textos del widget en ningún frame. ` +
      "Subí E2E_WOMPI_WIDGET_MS si tu red es lenta; revisá bloqueadores y consola."
  );
}

/** Checkout → 201 → modal / lista de métodos Wompi. */
export async function runCheckoutUntilWompiMethodsVisible(
  page: Page
): Promise<void> {
  await ensureE2EWompiPublicKeyInject(page);
  await ensureSandboxBrowserConsoleFilter(page);
  await ensureSandboxCheckPcoStub(page);
  await ensureWompiJsSandboxStub(page);
  await ensureWompiSandboxApiCorsBypass(page);
  await ensureSandboxE2ENoiseReduction(page);
  await ensureWompiMerchantsUndefinedCatchAll(page);
  await ensureWompiCheckPcoCatchAll(page);
  await openCheckoutWithSandboxCart(page);
  await fillSandboxCheckoutForm(page);

  const checkoutWait = waitForCheckoutPostResponse(page);
  await submitCheckoutForm(page);
  const res = await checkoutWait;
  await assertCheckoutCreated(res);

  await waitForWompiWidgetShell(page);
}

const NEQUI_PAYMENT_METHOD_RE = /\bnequi\b/i;

function wompiNequiMethodLocator(box: WompiCheckoutBox) {
  const re = NEQUI_PAYMENT_METHOD_RE;
  return box
    .locator('a[name="payment_nequi"], [name="payment_nequi"]')
    .or(box.getByRole("button", { name: re }))
    .or(box.getByRole("link", { name: re }))
    .or(box.locator('a:has-text("Nequi"), button:has-text("Nequi")'))
    .first();
}

/** Vista billetera Nequi (cabecera; EN si el navegador tradujo la página). */
const WOMPI_NEQUI_WALLET_HEADER_RE = /paga con nequi|pay with nequi/i;

/**
 * Segundo T&C Nequi: Wompi alterna textos («Acepto la autorización…» vs «Autorizo el tratamiento de mis datos»).
 * Si el regex no coincide con el nombre accesible, `ensure` y `expect` quedan en bucle sin marcar el control.
 */
const WOMPI_NEQUI_PERSONAL_DATA_CHECKBOX_NAME_RE =
  /acepto la autorización para la administración de datos personales|y conozco la pol[ií]tica|conozco la pol[ií]tica para el tratamiento|acepto(\s+la)?\s+autorizaci[oó]n|acepto.*datos\s+personales|autorizo(?:\s+el)?\s+tratamiento|tratamiento\s+de\s+(mis\s+)?datos|administraci[oó]n\s+de\s+datos(\s+personales)?|pol[ií]tica.*tratamiento.*datos|tratamiento\s+de\s+datos/i;

/**
 * Campo oficial Wompi Nequi (sandbox): suele ser `<input id="mobilePhone" name="mobilePhone" …>`;
 * en versiones recientes a veces falta `name` o solo coincide uno de los dos atributos.
 */
function wompiNequiMobilePhoneInputs(scope: Frame | FrameLocator): Locator {
  return scope.locator(
    'input#mobilePhone[name="mobilePhone"], input#mobilePhone, input[name="mobilePhone"]'
  );
}

function wompiCheckoutBoxIsFrame(box: WompiCheckoutBox): box is Frame {
  const b = box as Frame;
  return typeof b.evaluate === "function" && typeof b.childFrames === "function";
}

type WompiNequiPhoneFrameStats = { total: number; visible: number };

/** Cuenta candidatos Nequi en el documento del frame (incl. shadow roots). */
async function wompiNequiPhoneStatsInFrameDocument(
  frame: Frame
): Promise<WompiNequiPhoneFrameStats> {
  return frame.evaluate(() => {
    const g = globalThis as unknown as Record<string, unknown>;
    const doc = g.document as {
      querySelectorAll: (s: string) => Iterable<{ shadowRoot?: unknown }>;
    };

    type PhoneEl = {
      tagName?: string;
      getAttribute?: (a: string) => string | null;
      value: string;
      getBoundingClientRect: () => { width: number; height: number };
      checkVisibility?: (o?: unknown) => boolean;
    };

    const seen = new Set<unknown>();
    const matches: PhoneEl[] = [];

    const isNequiPhoneInput = (el: PhoneEl) => {
      if ((el.tagName ?? "").toUpperCase() !== "INPUT") return false;
      const type = (el.getAttribute?.("type") ?? "").toLowerCase();
      if (type === "hidden" || type === "checkbox" || type === "radio") return false;
      const id = el.getAttribute?.("id");
      const name = el.getAttribute?.("name");
      return id === "mobilePhone" || name === "mobilePhone";
    };

    function walk(root: { querySelectorAll: (s: string) => Iterable<{ shadowRoot?: unknown }> }) {
      for (const el of root.querySelectorAll("input")) {
        const node = el as PhoneEl;
        if (!isNequiPhoneInput(node)) continue;
        if (seen.has(el)) continue;
        seen.add(el);
        matches.push(node);
      }
      for (const el of root.querySelectorAll("*")) {
        const sr = (el as { shadowRoot?: unknown }).shadowRoot as typeof root | undefined;
        if (sr) walk(sr);
      }
    }
    walk(doc);

    const isShown = (el: PhoneEl) => {
      try {
        if (typeof el.checkVisibility === "function") {
          return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
        }
      } catch {
        /* ignore */
      }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    const visible = matches.filter(isShown).length;
    return { total: matches.length, visible };
  });
}

/**
 * Escribe el sandbox Nequi directamente en el DOM del frame (React/Wompi a veces no recibe `fill()` del locator).
 * Código ejecutado en el navegador (`tests/tsconfig` sin lib DOM → tipos mínimos).
 */
async function wompiFillNequiPhoneViaFrameDom(frame: Frame, digits: string): Promise<boolean> {
  return frame.evaluate((d: string) => {
    const g = globalThis as unknown as Record<string, unknown>;
    const doc = g.document as {
      querySelectorAll: (s: string) => Iterable<{ shadowRoot?: unknown }>;
    };

    type Inp = {
      tagName?: string;
      getAttribute?: (a: string) => string | null;
      focus: () => void;
      removeAttribute: (a: string) => void;
      dispatchEvent: (e: unknown) => void;
      value: string;
      getBoundingClientRect: () => { width: number; height: number };
      checkVisibility?: (o?: unknown) => boolean;
    };

    const seen = new Set<unknown>();
    const matches: Inp[] = [];

    const isNequiPhoneInput = (el: Inp) => {
      if ((el.tagName ?? "").toUpperCase() !== "INPUT") return false;
      const type = (el.getAttribute?.("type") ?? "").toLowerCase();
      if (type === "hidden" || type === "checkbox" || type === "radio") return false;
      const id = el.getAttribute?.("id");
      const name = el.getAttribute?.("name");
      return id === "mobilePhone" || name === "mobilePhone";
    };

    function walk(root: { querySelectorAll: (s: string) => Iterable<{ shadowRoot?: unknown }> }) {
      for (const el of root.querySelectorAll("input")) {
        const node = el as Inp;
        if (!isNequiPhoneInput(node)) continue;
        if (seen.has(el)) continue;
        seen.add(el);
        matches.push(node);
      }
      for (const el of root.querySelectorAll("*")) {
        const sr = (el as { shadowRoot?: unknown }).shadowRoot as typeof root | undefined;
        if (sr) walk(sr);
      }
    }
    walk(doc);
    if (matches.length === 0) return false;

    const norm = (s: string) => (s ?? "").replace(/\D/g, "");
    const want = norm(d);
    if (!want) return false;

    const isShown = (el: Inp) => {
      try {
        if (typeof el.checkVisibility === "function") {
          return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
        }
      } catch {
        /* ignore */
      }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };

    const win = g as { HTMLInputElement?: { prototype: object } };
    const proto = win.HTMLInputElement?.prototype;
    const desc = proto ? Object.getOwnPropertyDescriptor(proto, "value") : undefined;
    const setNative = (el: Inp, v: string) => {
      (desc?.set as ((this: unknown, val: string) => void) | undefined)?.call(el, v);
    };

    const Ev = g.Event as new (t: string, o?: object) => unknown;
    const tryPasteFill = (target: Inp) => {
      target.focus();
      target.removeAttribute("readonly");
      setNative(target, d);
      target.dispatchEvent(new Ev("input", { bubbles: true }));
      target.dispatchEvent(new Ev("change", { bubbles: true }));
      try {
        const Ie = g.InputEvent as new (t: string, o?: object) => unknown;
        target.dispatchEvent(new Ie("input", { bubbles: true, data: d, inputType: "insertFromPaste" }));
      } catch {
        /* sin InputEvent */
      }
    };

    const tryCharFill = (target: Inp) => {
      target.focus();
      target.removeAttribute("readonly");
      setNative(target, "");
      target.dispatchEvent(new Ev("input", { bubbles: true }));
      const IeCtor = g.InputEvent as (new (t: string, o?: object) => unknown) | undefined;
      let acc = "";
      for (const ch of d) {
        acc += ch;
        setNative(target, acc);
        if (IeCtor) {
          try {
            target.dispatchEvent(new IeCtor("input", { bubbles: true, data: ch, inputType: "insertText" }));
          } catch {
            target.dispatchEvent(new Ev("input", { bubbles: true }));
          }
        } else {
          target.dispatchEvent(new Ev("input", { bubbles: true }));
        }
      }
      target.dispatchEvent(new Ev("change", { bubbles: true }));
    };

    const ordered = [...matches].sort((a, b) => {
      const sa = isShown(a) ? 1 : 0;
      const sb = isShown(b) ? 1 : 0;
      return sb - sa;
    });

    for (const target of ordered) {
      tryPasteFill(target);
      if (norm(target.value) === want) return true;
      tryCharFill(target);
      if (norm(target.value) === want) return true;
    }
    return false;
  }, digits);
}

async function wompiNequiMobileValueMatchesInFrame(frame: Frame, digits: string): Promise<boolean> {
  return frame.evaluate((expected: string) => {
    const doc = (globalThis as unknown as { document: { querySelectorAll: (s: string) => Iterable<{ shadowRoot?: unknown }> } })
      .document;

    type Inp = {
      tagName?: string;
      getAttribute?: (a: string) => string | null;
      value: string;
      getBoundingClientRect: () => { width: number; height: number };
      checkVisibility?: (o?: unknown) => boolean;
    };

    const seen = new Set<unknown>();
    const matches: Inp[] = [];

    const isNequiPhoneInput = (el: Inp) => {
      if ((el.tagName ?? "").toUpperCase() !== "INPUT") return false;
      const type = (el.getAttribute?.("type") ?? "").toLowerCase();
      if (type === "hidden" || type === "checkbox" || type === "radio") return false;
      const id = el.getAttribute?.("id");
      const name = el.getAttribute?.("name");
      return id === "mobilePhone" || name === "mobilePhone";
    };

    function walk(root: { querySelectorAll: (s: string) => Iterable<{ shadowRoot?: unknown }> }) {
      for (const el of root.querySelectorAll("input")) {
        const node = el as Inp;
        if (!isNequiPhoneInput(node)) continue;
        if (seen.has(el)) continue;
        seen.add(el);
        matches.push(node);
      }
      for (const el of root.querySelectorAll("*")) {
        const sr = (el as { shadowRoot?: unknown }).shadowRoot as typeof root | undefined;
        if (sr) walk(sr);
      }
    }
    walk(doc);

    const norm = (s: string) => (s ?? "").replace(/\D/g, "");
    const want = norm(expected);
    return matches.some((el) => norm(el.value) === want);
  }, digits);
}

/**
 * Solo el input de **cuenta Nequi** (vista «Paga con Nequi»).
 * En «Ingresa tus datos» el celular del checkout no usa este id en el iframe Wompi.
 */
function wompiNequiAccountPhoneLocator(scope: Frame | FrameLocator) {
  const labelSnippet =
    /número celular de tu cuenta nequi|número celular.*cuenta.*nequi|cell(?:ular)?\s+(phone\s+)?number.*nequi|nequi\s+(account|wallet)|your\s+nequi/i;
  const labelThenInput = scope
    .getByText(labelSnippet)
    .locator("xpath=following::input[not(@type='hidden')][1]");
  return scope
    .getByRole("textbox", {
      name: /número celular de tu cuenta nequi|celular.*cuenta.*nequi|cuenta nequi/i,
    })
    .or(
      scope.getByRole("textbox", {
        name: /cell(?:ular)?\s+number.*nequi|phone.*nequi|nequi.*(account|number)/i,
      })
    )
    .or(labelThenInput)
    .or(wompiNequiMobilePhoneInputs(scope))
    .or(
      scope.getByLabel(
        /número celular de tu cuenta nequi|cuenta\s+nequi|celular.*cuenta\s+nequi|cell(?:ular)?\s+number.*nequi/i
      )
    )
    .or(scope.getByRole("textbox", { name: /nequi/i }))
    .or(scope.getByPlaceholder(/nequi|cuenta.*nequi|celular.*cuenta.*nequi|billetera.*nequi/i))
    .first();
}

/**
 * Respaldo: en la vista «Paga con Nequi» suele haber un solo `tel` / numérico visible.
 * Solo usar si ya vimos la cabecera Nequi (no mezclar con «Ingresa tus datos»).
 */
function wompiNequiPhoneInputFallback(scope: Frame | FrameLocator): Locator {
  return scope
    .locator(
      'input[type="tel"], input[inputmode="numeric"], input[inputmode="tel"], input[autocomplete="tel"]'
    )
    .first();
}

/**
 * Resuelve `input#mobilePhone[name="mobilePhone"]` (widget Wompi). Si hay clones, prioriza el visible;
 * si ninguno pasa `isVisible` pero está en DOM, devuelve el último para `fill({ force: true })`.
 */
async function resolveWompiNequiMobilePhoneInput(
  page: Page,
  box: WompiCheckoutBox,
  budgetMs: number
): Promise<Locator | null> {
  const all = wompiNequiMobilePhoneInputs(box);
  const deadline = Date.now() + Math.max(1_000, budgetMs);
  try {
    await all.first().waitFor({ state: "attached", timeout: Math.min(15_000, budgetMs) });
  } catch {
    return null;
  }

  const n = await all.count();
  if (n < 1) return null;

  while (Date.now() < deadline) {
    for (let i = 0; i < n; i++) {
      const loc = all.nth(i);
      if (await loc.isVisible({ timeout: 450 }).catch(() => false)) {
        return loc;
      }
    }
    await page.waitForTimeout(200).catch(() => {});
  }

  return all.nth(Math.max(0, n - 1));
}

/**
 * Wompi deja a veces varios `#mobilePhone` en el DOM (solo uno visible): `.first()` apuntaba al oculto.
 */
async function wompiFirstVisiblePhoneLocatorAmong(
  page: Page,
  base: Locator,
  until: number
): Promise<Locator | null> {
  const n = await base.count().catch(() => 0);
  if (n < 1) return null;
  while (Date.now() < until) {
    for (let i = 0; i < n; i++) {
      const loc = base.nth(i);
      const slice = Math.min(900, Math.max(140, until - Date.now()));
      if (slice < 80) return null;
      if (await loc.isVisible({ timeout: slice }).catch(() => false)) {
        return loc;
      }
    }
    await page.waitForTimeout(200).catch(() => {});
  }
  return null;
}

/**
 * Fallback si Wompi cambia el markup: otros locators + barrido de `tel` visibles.
 */
async function pickVisibleNequiWalletPhoneField(
  page: Page,
  box: WompiCheckoutBox,
  budgetMs: number
): Promise<Locator | null> {
  const end = Date.now() + Math.max(800, budgetMs);

  const slice = () => Math.min(1_200, Math.max(120, end - Date.now()));

  const tryFirstVisible = async (loc: Locator): Promise<Locator | null> => {
    const first = loc.first();
    if (await first.isVisible({ timeout: slice() }).catch(() => false)) return first;
    return null;
  };

  const hitUnion = await wompiFirstVisiblePhoneLocatorAmong(page, wompiNequiMobilePhoneInputs(box), end);
  if (hitUnion) return hitUnion;

  const byId = await wompiFirstVisiblePhoneLocatorAmong(page, box.locator("#mobilePhone"), end);
  if (byId) return byId;

  const byName = await wompiFirstVisiblePhoneLocatorAmong(
    page,
    box.locator('input[name="mobilePhone"]'),
    end
  );
  if (byName) return byName;

  const candidates: Locator[] = [
    box.getByRole("textbox", {
      name: /número celular de tu cuenta nequi|celular.*cuenta.*nequi|cuenta nequi/i,
    }),
    box.getByRole("textbox", {
      name: /cell(?:ular)?\s+number.*nequi|phone.*nequi|nequi.*(account|number)/i,
    }),
    box.getByLabel(/número celular de tu cuenta nequi|cuenta\s+nequi|celular.*cuenta\s+nequi/i),
    box.getByText(/número celular de tu cuenta nequi|número celular.*cuenta.*nequi/i).locator(
      "xpath=following::input[not(@type='hidden')][1]"
    ),
  ];

  for (const c of candidates) {
    if (Date.now() >= end) break;
    const hit = await tryFirstVisible(c);
    if (hit) return hit;
  }

  const multi = box.locator(
    'input[type="tel"], input[inputmode="numeric"], input[inputmode="tel"], input[autocomplete="tel"]'
  );
  const n = await multi.count().catch(() => 0);
  for (let i = 0; i < n && Date.now() < end; i++) {
    const nth = multi.nth(i);
    const t = slice();
    if (t < 80) break;
    if (await nth.isVisible({ timeout: t }).catch(() => false)) {
      const typ = (await nth.getAttribute("type").catch(() => "")) || "";
      if (typ === "checkbox" || typ === "radio" || typ === "hidden") continue;
      return nth;
    }
  }

  return null;
}

/**
 * Wompi expone el campo Nequi como `role=textbox` con nombre accesible estable; a veces no hay `#mobilePhone`
 * en el DOM o el `FrameLocator` no coincide — este camino va primero en el flujo Nequi.
 */
async function tryFillWompiNequiPhoneViaAccessibleTextbox(
  box: WompiCheckoutBox,
  page: Page,
  digits: string,
  budgetMs: number
): Promise<boolean> {
  const nameRe =
    /número celular de tu cuenta nequi|celular.*cuenta.*nequi|ingresa el n[uú]mero de tu celular|cell(?:ular)?\s+number.*nequi|your\s+nequi|phone.*nequi/i;
  const tb = box.getByRole("textbox", { name: nameRe }).first();
  const end = Date.now() + Math.max(1_200, budgetMs);
  while (Date.now() < end) {
    if (wompiPageShowsCheckoutResultado(page)) return true;
    if (await tb.isVisible({ timeout: 650 }).catch(() => false)) {
      await tb.scrollIntoViewIfNeeded().catch(() => {});
      await tb.click({ force: true, timeout: 5_000 }).catch(() => {});
      await tb.fill(digits, { force: true, timeout: 12_000 }).catch(() => {});
      let v = (await tb.inputValue().catch(() => "")).replace(/\D/g, "");
      if (v === digits) return true;
      await tb.press("ControlOrMeta+a").catch(() => {});
      await tb.press("Backspace").catch(() => {});
      await tb.pressSequentially(digits, { delay: 45 }).catch(() => {});
      v = (await tb.inputValue().catch(() => "")).replace(/\D/g, "");
      return v === digits;
    }
    await page.waitForTimeout(220).catch(() => {});
  }
  return false;
}

/**
 * Solo **«Paga con Nequi»** (cuenta Nequi). No llamar en «Ingresa tus datos» (teléfono del checkout kame).
 */
async function wompiFillNequiPhoneDigits(field: Locator, digits: string): Promise<void> {
  const tag = await field.evaluate((e) => (e as { tagName?: string }).tagName ?? "").catch(() => "");
  let target: Locator = field;
  if (tag !== "INPUT") {
    const inner = field.locator("input").first();
    if ((await inner.count()) > 0) target = inner;
  }

  await target.scrollIntoViewIfNeeded().catch(() => {});
  await target.click({ force: true, timeout: 5000 }).catch(() => {});
  await target.fill(digits, { timeout: 12_000, force: true });
  let v = (await target.inputValue().catch(() => "")).replace(/\D/g, "");
  if (v !== digits) {
    await target.press("ControlOrMeta+a").catch(() => {});
    await target.pressSequentially(digits, { delay: 35 });
    v = (await target.inputValue().catch(() => "")).replace(/\D/g, "");
  }
  if (v !== digits) {
    await target.evaluate((el: unknown, d: string) => {
      const input = el as { dispatchEvent: (e: Event) => boolean };
      const w = globalThis as unknown as {
        HTMLInputElement?: { prototype: object };
      };
      const proto = w.HTMLInputElement?.prototype;
      if (proto) {
        const desc = Object.getOwnPropertyDescriptor(proto, "value");
        (desc?.set as ((this: unknown, v: string) => void) | undefined)?.call(input, d);
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, digits);
  }
}

/**
 * Paso **«Ingresa tus datos»**: email, nombre, **celular del checkout kame** (ej. 300…), cédula.
 * Ese teléfono **no** se toca; el sandbox Nequi (399…) va solo en la vista siguiente **«Paga con Nequi»**.
 * Aquí únicamente: clic en **«Continuar con tu pago»** (`tryClickWompiNequiContinue`).
 */
const WOMPI_PAYER_DATA_STEP_RE =
  /ingresa tus datos|completa tus datos|enter your (details|information)/i;

async function wompiPayerDataStepVisible(box: WompiCheckoutBox): Promise<boolean> {
  /** Cabecera Nequi: no es el paso solo «datos pagador». */
  if (await box.getByText(WOMPI_NEQUI_WALLET_HEADER_RE).first().isVisible({ timeout: 400 }).catch(() => false)) {
    return false;
  }
  const title = await box
    .getByText(WOMPI_PAYER_DATA_STEP_RE)
    .first()
    .isVisible({ timeout: 900 })
    .catch(() => false);
  if (!title) return false;
  /**
   * Wompi deja a veces un `#mobilePhone` oculto en el DOM; `.first().isVisible` daba false y
   * `!false` → creíamos estar en «datos pagador» en la vista Nequi → bucle sin rellenar.
   */
  const phoneEls = box.locator('#mobilePhone, input[name="mobilePhone"]');
  const n = await phoneEls.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    if (await phoneEls.nth(i).isVisible({ timeout: 250 }).catch(() => false)) {
      return false;
    }
  }
  return true;
}

/** Contenido típico cuando el waybox ya muestra métodos (no solo iframe vacío / “Cargando…”). */
const WOMPI_METHODS_SHELL_RE =
  /cómo quieres pagar|cuánto vas a pagar|modo de pruebas|billeteras digitales|test mode|how (do )?you want to pay|digital wallets/i;

/**
 * Scopes del widget. Si hay `iframe` dentro de `.waybox-iframe`, el checkout suele vivir en el **inner**;
 * el outer a menudo es solo contenedor. No filtrar por “inner vacío” en el primer tick: al cargar, un
 * probe en falso dejaba cache `[outer]` para siempre y el Nequi quedaba invisible (teléfono / T&C).
 * `tryAdvanceWompiWayboxIframe` prueba cada scope hasta que uno avanza.
 */
async function wompiCheckoutScopes(page: Page): Promise<FrameLocator[]> {
  if ((await page.locator("iframe.waybox-iframe").count()) === 0) return [];
  const outer = page.frameLocator("iframe.waybox-iframe").first();
  /** Todos los iframes hijos del waybox (Wompi a veces mete más de uno; `.first()` apuntaba al equivocado). */
  const nested = await page.locator("iframe.waybox-iframe").locator("iframe").count();
  if (nested > 0) {
    const scopes: FrameLocator[] = [];
    for (let i = 0; i < nested; i++) {
      scopes.push(outer.frameLocator(`iframe >> nth=${i}`));
    }
    scopes.push(outer);
    return scopes;
  }
  return [outer];
}

function wompiMsUntil(deadline: number): number {
  return Math.max(0, deadline - Date.now());
}

/**
 * Si Next ya navegó a resultado, hay que **salir de inmediato** de bucles largos (`waitUntil` T&C,
 * recorrido de frames, etc.); si no, el test puede quemar el timeout global aunque la UI ya muestre APPROVED.
 */
function wompiPageShowsCheckoutResultado(page: Page): boolean {
  try {
    return /\/checkout\/resultado\b/i.test(page.url());
  } catch {
    return false;
  }
}

/**
 * No pausa en cuanto existe el iframe: espera el estado «Cargando… / espera un momento» del waybox
 * y **ahí** aplica `E2E_WOMPI_WIDGET_SETTLE_MS` (p. ej. 5s) para dar tiempo a la pasarela. Si ya
 * hay lista de métodos, no espera en vano.
 */
async function waitAfterWompiWayboxLoadingSettle(
  page: Page,
  box: WompiCheckoutBox,
  deadline: number
): Promise<void> {
  const settleMs = wompiWidgetSettleAfterAttachMs();
  if (settleMs <= 0) return;

  const loadingRe =
    /cargando|espera\s+un\s+momento|espera un momento|momento por favor|please wait/i;
  const pollUntil = Math.min(deadline - 400, Date.now() + 28_000);

  let sawLoading = false;
  while (Date.now() < pollUntil && wompiMsUntil(deadline) > settleMs + 800) {
    if (
      await box
        .getByText(WOMPI_METHODS_SHELL_RE)
        .first()
        .isVisible({ timeout: 200 })
        .catch(() => false)
    ) {
      return;
    }
    if (await box.getByText(loadingRe).first().isVisible({ timeout: 200 }).catch(() => false)) {
      sawLoading = true;
      break;
    }
    await page.waitForTimeout(250);
  }

  const pause = Math.min(settleMs, Math.max(0, wompiMsUntil(deadline) - 400));
  if (pause <= 0) return;

  if (sawLoading) {
    await page.waitForTimeout(pause);
    return;
  }
  /** Sin ver el copy de carga (muy rápido o otro layout): un respiro único antes de Nequi. */
  await page.waitForTimeout(pause);
}

/**
 * Hace click en la fila/botón del método dentro del waybox (iframe principal) con esperas tipo
 * usuario; solo si falla, recorre el resto de frames con intervalo amplio (menos ruido en el trace).
 */
export async function wompiSelectPaymentMethod(
  page: Page,
  _method: "nequi",
  opts?: { timeoutMs?: number }
): Promise<void> {
  const timeout = opts?.timeoutMs ?? 90_000;
  const deadline = Date.now() + timeout;

  const wayboxIframe = page.locator("iframe.waybox-iframe").first();
  await wayboxIframe.waitFor({
    state: "visible",
    timeout: Math.max(1_000, wompiMsUntil(deadline)),
  });

  const scopes = await wompiCheckoutScopes(page);
  if (scopes.length === 0) {
    throw new Error("Wompi: no hay iframe .waybox-iframe.");
  }
  await waitAfterWompiWayboxLoadingSettle(page, scopes[0], deadline);

  const shellTimeout = Math.max(8_000, wompiMsUntil(deadline));
  for (const box of scopes) {
    try {
      await expect(box.getByText(WOMPI_METHODS_SHELL_RE).first()).toBeVisible({
        timeout: shellTimeout,
      });

      const payNequi = wompiNequiMethodLocator(box);
      await expect(payNequi).toBeVisible({
        timeout: Math.max(5_000, wompiMsUntil(deadline)),
      });
      await payNequi.click();
      return;
    } catch {
      /* siguiente scope (anidado vs outer) */
    }
  }

  const pollMs = 350;

  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      try {
        const payNequi = frame
          .locator('a[name="payment_nequi"], [name="payment_nequi"]')
          .or(frame.getByRole("button", { name: NEQUI_PAYMENT_METHOD_RE }))
          .or(frame.getByRole("link", { name: NEQUI_PAYMENT_METHOD_RE }))
          .or(frame.locator('a:has-text("Nequi"), button:has-text("Nequi")'))
          .first();
        if (await payNequi.isVisible({ timeout: 200 }).catch(() => false)) {
          await payNequi.click();
          return;
        }
      } catch {
        /* siguiente frame */
      }
    }
    await page.waitForTimeout(pollMs);
  }

  throw new Error(
    `No se pudo seleccionar Nequi en ${timeout}ms. ` +
      "Esperá a que el modal muestre «¿Cómo quieres pagar?» y Nequi. " +
      "El 404 de check_pco_blacklist en Chrome manual no bloquea la UI; en E2E va stubeado. " +
      "Probá --headed, subí E2E_WOMPI_WIDGET_MS o E2E_WOMPI_WIDGET_SETTLE_MS."
  );
}


/** Nombre accesible del botón de cierre del widget Wompi (sandbox): «Finalizar mi proceso». */
const WOMPI_FINALIZAR_PROCESO_RE = /finalizar\s+mi\s+proceso/i;

/**
 * Resultado final Nequi en el waybox: ya no aplican «Continuar con tu pago» / «Pagar»;
 * hay que pulsar «Finalizar mi proceso» para que Next navegue a /checkout/resultado.
 */
const WOMPI_TERMINAL_OUTCOME_RE =
  /transacci[oó]n\s+(declinada|aprobada|rechazada)|declinada\s*\(|rechazada\s+en\s+sandbox|aprobada\s+en\s+sandbox|mensaje\s+del\s+procesador|procesador:\s*transacci[oó]n/i;

async function wompiTerminalPaymentOutcomeVisible(
  scope: WompiDomScope
): Promise<boolean> {
  return scope
    .getByText(WOMPI_TERMINAL_OUTCOME_RE)
    .first()
    .isVisible({ timeout: 800 })
    .catch(() => false);
}

/**
 * Clic en «Finalizar mi proceso»: rol + respaldo DOM (`button.button-main`, clase estable en Wompi).
 * Probe amplio: en pantalla declinada/aprobada el botón puede tardar o el nombre accesible variar.
 */
async function tryClickWompiFinalizarMiProceso(scope: WompiDomScope): Promise<boolean> {
  const probeMs = 4500;
  const byExact = scope.getByRole("button", { name: WOMPI_FINALIZAR_PROCESO_RE });
  const byLoose = scope.getByRole("button", { name: /finalizar/i });
  const byLink = scope.getByRole("link", { name: WOMPI_FINALIZAR_PROCESO_RE });
  const byText = scope
    .getByText(WOMPI_FINALIZAR_PROCESO_RE)
    .locator("xpath=ancestor::button[1] | ancestor::a[1]")
    .first();

  const tryClickVisible = async (loc: Locator) => {
    if (!(await loc.isVisible({ timeout: probeMs }).catch(() => false))) return false;
    try {
      await loc.click({ force: true });
      return true;
    } catch {
      return false;
    }
  };

  for (const loc of [byExact.first(), byLoose.first(), byLink.first()]) {
    if (await tryClickVisible(loc)) return true;
  }
  if (await tryClickVisible(byText)) return true;

  const byClass = scope
    .locator("button.button-main, a.button-main")
    .filter({ hasText: /finalizar(\s+mi\s+)?proceso/i });
  if (await tryClickVisible(byClass.first())) return true;

  const anyMainFinalizar = scope
    .locator("button.button-main")
    .filter({ hasText: /^finalizar\b/i });
  if (await tryClickVisible(anyMainFinalizar.first())) return true;

  return false;
}

/**
 * Vista Nequi sandbox: opción «Usar el mismo número ya diligenciado…» reutiliza el celular del
 * checkout Kame (`SANDBOX_CHECKOUT_FORM.phone`, ej. 300…). Ese número **no** es válido en Nequi
 * sandbox → «Invalid Number in Sandbox». Los E2E deben desmarcar y rellenar `399…` (WOMPI_SANDBOX).
 */
async function uncheckWompiNequiUseSameCheckoutPhoneIfPresent(
  scope: Frame | FrameLocator,
  page: Page
): Promise<void> {
  const sameNumberRe =
    /usar el mismo|mismo n[uú]mero|ya diligenciado|notificaci[oó]n push.*mismo|same (phone|number|details)|use the same/i;

  const candidates: Locator[] = [
    scope.getByRole("checkbox", { name: sameNumberRe }).first(),
    scope
      .locator("label")
      .filter({ hasText: sameNumberRe })
      .locator('input[type="checkbox"]')
      .first(),
  ];

  for (const cb of candidates) {
    if (!(await cb.isVisible({ timeout: 700 }).catch(() => false))) continue;
    if (!(await cb.isChecked().catch(() => false))) return;

    await cb.scrollIntoViewIfNeeded().catch(() => {});
    await cb.setChecked(false, { force: true }).catch(() => {});
    if (await cb.isChecked().catch(() => false)) {
      await scope.getByText(sameNumberRe).first().click({ force: true }).catch(() => {});
    }
    await page.waitForTimeout(250).catch(() => {});
    return;
  }
}

/** `element.click()` en el nodo resuelto (útil cuando React no recibe `check()` del locator). */
async function wompiNequiCheckboxClickDom(loc: Locator): Promise<void> {
  await loc.evaluate((el: unknown) => {
    const n = el as { click?: () => void };
    if (typeof n.click === "function") n.click();
  });
}

/**
 * Evita `locator.check()`: en el waybox tarjeta Wompi a veces **cuelga** esperando accionabilidad.
 * Fuerza `checked` + eventos; el clic en `label` sigue siendo la vía principal.
 */
async function wompiSetCheckboxCheckedDispatch(loc: Locator, on: boolean): Promise<void> {
  await loc.evaluate(
    (el, want) => {
      const input = el as { type?: string; checked: boolean; dispatchEvent: (e: Event) => boolean };
      if (!input || input.type !== "checkbox") return;
      if (input.checked !== want) {
        input.checked = want;
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    on
  );
}

/**
 * Marca T&C Nequi en el iframe Wompi. `check({ force })` a veces no dispara el estado React;
 * mismo criterio que el método de pago: id, label, rol checkbox y texto del label.
 */
async function ensureWompiNequiContractCheckboxes(
  scope: Frame | FrameLocator,
  page: Page
): Promise<void> {
  /** Probes cortos: visMs alto × cada vuelta de `waitUntilNequiContractsChecked` multiplicaba el trace (miles de acciones). */
  const visMs = 900;
  const tryTick = async (opts: {
    id: string;
    roleNames: RegExp[];
    labelHasText: RegExp[];
    /** Clic en copy visible cuando no hay `label[for]` ni ARIA estable. */
    textClickRe?: RegExp;
  }) => {
    const { id, roleNames, labelHasText, textClickRe } = opts;
    /** Priorizar checkbox **visible** por rol; `#id` a veces apunta a un clon oculto y `isChecked` nunca pasa. */
    let roleCb: Locator | null = null;
    for (const re of roleNames) {
      const cand = scope.getByRole("checkbox", { name: re }).first();
      if (await cand.isVisible({ timeout: 400 }).catch(() => false)) {
        roleCb = cand;
        break;
      }
    }

    const hiddenById = scope.locator(`#${id}`);
    const inp = roleCb ?? hiddenById.first();

    const isDone = async () => {
      if (roleCb && (await roleCb.isChecked().catch(() => false))) return true;
      return hiddenById.first().isChecked().catch(() => false);
    };

    if (await isDone()) return;

    /**
     * Vista **tarjeta**: copy largo «…administración de datos personales y conozco la política…»;
     * el `label` visible a veces no enlaza bien con `getByRole` + `check()` (se queda colgado en trace).
     */
    if (id === "acceptancePersonal") {
      const longLbl = scope
        .locator("label")
        .filter({
          hasText:
            /conozco la pol[ií]tica para el tratamiento|administraci[oó]n de datos personales y conozco/i,
        })
        .first();
      if (await longLbl.isVisible({ timeout: 550 }).catch(() => false)) {
        await longLbl.scrollIntoViewIfNeeded().catch(() => {});
        await longLbl.click({ force: true, timeout: 2_000 }).catch(() => {});
        const inner = longLbl.locator('input[type="checkbox"]').first();
        await inner.click({ force: true, timeout: 1_500 }).catch(() => {});
        await wompiNequiCheckboxClickDom(inner).catch(() => {});
        await wompiSetCheckboxCheckedDispatch(inner, true).catch(() => {});
        if (await isDone()) return;
      }
    }

    if (roleCb) {
      await roleCb.scrollIntoViewIfNeeded().catch(() => {});
      await roleCb.click({ force: true, timeout: 2500 }).catch(() => {});
      await wompiNequiCheckboxClickDom(roleCb).catch(() => {});
      if (await roleCb.isChecked().catch(() => false)) return;
      await wompiSetCheckboxCheckedDispatch(roleCb, true).catch(() => {});
      if (await roleCb.isChecked().catch(() => false)) return;
      await roleCb.focus().catch(() => {});
      await roleCb.press("Space").catch(() => {});
      if (await roleCb.isChecked().catch(() => false)) return;
    }

    if (textClickRe) {
      const t = scope.getByText(textClickRe).first();
      if (await t.isVisible({ timeout: 600 }).catch(() => false)) {
        await t.scrollIntoViewIfNeeded().catch(() => {});
        await t.click({ force: true }).catch(() => {});
        if (await isDone()) return;
      }
    }

    if (await inp.isVisible({ timeout: visMs }).catch(() => false)) {
      await inp.scrollIntoViewIfNeeded().catch(() => {});
      await inp.click({ force: true, timeout: 2_000 }).catch(() => {});
      await wompiSetCheckboxCheckedDispatch(inp, true).catch(() => {});
      if (await isDone()) return;
      await wompiNequiCheckboxClickDom(inp).catch(() => {});
      if (await isDone()) return;
      await inp.focus().catch(() => {});
      await inp.press("Space").catch(() => {});
      if (await isDone()) return;
    }

    await scope
      .locator(`label[for="${id}"]`)
      .first()
      .scrollIntoViewIfNeeded()
      .catch(() => {});
    await scope
      .locator(`label[for="${id}"]`)
      .first()
      .click({ force: true })
      .catch(() => {});
    if (await isDone()) return;

    for (const re of roleNames) {
      const cb = scope.getByRole("checkbox", { name: re }).first();
      if (await cb.isVisible({ timeout: visMs }).catch(() => false)) {
        await cb.scrollIntoViewIfNeeded().catch(() => {});
        await cb.click({ force: true }).catch(() => {});
        await wompiNequiCheckboxClickDom(cb).catch(() => {});
        await cb.focus().catch(() => {});
        await cb.press("Space").catch(() => {});
        if (await cb.isChecked().catch(() => false)) return;
      }
    }

    for (const re of labelHasText) {
      const lbl = scope.locator("label").filter({ hasText: re }).first();
      if (await lbl.isVisible({ timeout: visMs }).catch(() => false)) {
        await lbl.scrollIntoViewIfNeeded().catch(() => {});
        await lbl.click({ force: true }).catch(() => {});
        const inner = lbl.locator('input[type="checkbox"]').first();
        await inner.click({ force: true }).catch(() => {});
        await wompiNequiCheckboxClickDom(inner).catch(() => {});
        if (await isDone()) return;
      }
    }

    const wrap = scope
      .locator(
        "label.acceptance-checkbox-wrapper, label[class*='acceptance-checkbox'], div[class*='acceptance-checkbox']"
      )
      .filter({ has: scope.locator(`#${id}`) })
      .first();
    if (await wrap.isVisible({ timeout: 700 }).catch(() => false)) {
      await wrap.scrollIntoViewIfNeeded().catch(() => {});
      await wrap.click({ force: true }).catch(() => {});
    }
  };

  await tryTick({
    id: "acceptance",
    roleNames: [/acepto el reglamento/i, /reglamento/i],
    labelHasText: [/acepto el reglamento/i, /reglamento/i],
    textClickRe: /acepto(\s+el)?\s+reglamento/i,
  });
  await tryTick({
    id: "acceptancePersonal",
    roleNames: [
      /autorizo(?:\s+el)?\s+tratamiento/i,
      /tratamiento\s+de\s+mis\s+datos/i,
      WOMPI_NEQUI_PERSONAL_DATA_CHECKBOX_NAME_RE,
    ],
    labelHasText: [
      /autorizo/i,
      /tratamiento\s+de\s+mis\s+datos/i,
      /datos personales/i,
      /autorización/i,
      /administración de datos personales/i,
      /pol[ií]tica.*tratamiento.*datos/i,
    ],
    textClickRe:
      /conozco la pol[ií]tica|autorizo|acepto.*autorizaci[oó]n|datos personales|tratamiento\s+de\s+mis\s+datos|administraci[oó]n de datos|tratamiento de datos/i,
  });
}

/**
 * Hasta que **ambos** contratos Nequi estén marcados (vista `#mobilePhone`).
 * Usa `expect().toBeChecked` para no pulsar «Continuar» antes de que React habilite el botón.
 * @returns false si se agota el tiempo o ya no estamos en el paso Nequi.
 */
async function waitUntilNequiContractsChecked(
  scope: Frame | FrameLocator,
  page: Page,
  untilMs: number
): Promise<boolean> {
  const end = Date.now() + untilMs;
  // Locators para verificar que seguimos en el paso del teléfono Nequi.
  // Usa wompiNequiAccountPhoneLocator (incluye getByRole textbox) porque Wompi puede
  // no tener id="mobilePhone" / name="mobilePhone" en su versión actual del widget.
  const onNequiPhoneStepLocator = wompiNequiAccountPhoneLocator(scope);
  /**
   * Solo `getByRole`: `.or(#acceptance)` hacía que `.first()` resolviera el input oculto del DOM
   * y `isChecked`/`toBeChecked` no reflejaran el checkbox visible (bucle largo en el trace).
   */
  const cbAcceptance = scope
    .getByRole("checkbox", { name: /acepto el reglamento/i })
    .first();
  const cbPersonal = scope
    .getByRole("checkbox", { name: WOMPI_NEQUI_PERSONAL_DATA_CHECKBOX_NAME_RE })
    .first();

  /** Evitar `ensure` en cada vuelta; no usar `expect(..., { timeout: 3500 })` por iteración (miles de acciones en trace). */
  let lastEnsureAt = 0;
  const ensureCooldownMs = 750;

  while (Date.now() < end) {
    if (wompiPageShowsCheckoutResultado(page)) return true;
    const onNequiPhoneStep =
      (await onNequiPhoneStepLocator.isVisible({ timeout: 400 }).catch(() => false)) ||
      ((await scope
        .getByText(WOMPI_NEQUI_WALLET_HEADER_RE)
        .first()
        .isVisible({ timeout: 300 })
        .catch(() => false)) &&
        (await wompiNequiPhoneInputFallback(scope)
          .isVisible({ timeout: 300 })
          .catch(() => false)));
    if (!onNequiPhoneStep) {
      return false;
    }

    const acceptChecked = await cbAcceptance.isChecked().catch(() => false);
    const personalChecked = await cbPersonal.isChecked().catch(() => false);
    const now = Date.now();
    if (lastEnsureAt === 0) {
      await ensureWompiNequiContractCheckboxes(scope, page);
      lastEnsureAt = now;
    } else if (
      (!acceptChecked || !personalChecked) &&
      now - lastEnsureAt >= ensureCooldownMs
    ) {
      await ensureWompiNequiContractCheckboxes(scope, page);
      lastEnsureAt = now;
    }

    if (acceptChecked && personalChecked) {
      const a = await cbAcceptance.isChecked().catch(() => false);
      const p = await cbPersonal.isChecked().catch(() => false);
      if (a && p) {
        return true;
      }
    }

    try {
      await page.waitForTimeout(520);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Wompi muestra «Espera» en el mismo botón principal hasta que valide T&C; hay que esperar
 * `enabled`, no solo visible (timeouts cortos fallaban igual que en la lista de métodos).
 */
async function tryClickWompiNequiContinue(
  scope: WompiDomScope,
  deadline: number
): Promise<boolean> {
  if (await wompiTerminalPaymentOutcomeVisible(scope)) {
    return false;
  }

  const remaining = () => Math.max(0, deadline - Date.now());
  /** El bucle exterior repite cada ~350ms: no acumular 25s × varios botones por tick. */
  const tVisible = () => Math.min(4_000, Math.max(600, remaining()));
  /** Evitar ~12s × N candidatos cuando el botón está visible pero deshabilitado (falta tel / T&C Nequi). */
  const tEnabled = () => Math.min(3_500, Math.max(800, remaining()));

  const candidates = [
    scope
      .getByRole("button", {
        name: /continuar con (tu|el) pago|continue with your payment/i,
      })
      .first(),
    /** Wompi a veces muestra «Pagar con $…» cuando el monto está listo. */
    scope.getByRole("button", { name: /pagar\s+con/i }).first(),
    scope.getByRole("button", { name: /\bpagar\b/i }).first(),
    scope.getByRole("button", { name: /siguiente|confirmar pago/i }).first(),
    scope
      .locator("button.submit-button.button-main")
      .filter({ hasText: /continuar|pagar|siguiente|confirmar/i })
      .first(),
    scope.locator("button.submit-button.button-main").first(),
  ];

  for (const btn of candidates) {
    try {
      await btn.waitFor({ state: "visible", timeout: tVisible() });
      if (!(await btn.isEnabled().catch(() => false))) {
        continue;
      }
      await expect(btn).toBeEnabled({ timeout: tEnabled() });
      await btn.click();
      return true;
    } catch {
      /* siguiente locator */
    }
  }
  return false;
}

async function wompiNequiPushOrWaitingUi(scope: Frame | FrameLocator): Promise<boolean> {
  /**
   * Vista «esperando acción en el celular» (sandbox Nequi). El input `#mobilePhone` y el copy de
   * ayuda «notificación push» **coexisten** en el paso de captura **y** tras pulsar Continuar, así
   * que **no** basta con ocultar el textbox: mientras siga visible el checkbox de reglamento del
   * formulario billetera, seguimos en captura; si ya no hay T&C de wallet pero hay copy de push /
   * espera en contexto Nequi, es la pantalla de espera.
   */
  const walletReglamento = scope
    .getByRole("checkbox", { name: /acepto el reglamento/i })
    .first();
  if (await walletReglamento.isVisible({ timeout: 220 }).catch(() => false)) {
    return false;
  }

  const pushOrApproveCopy = await scope
    .getByText(
      /notificaci[oó]n\s+push|push\s+notification|recibir[aá]s|confirma\s+en\s+tu|aprob[aá]\s+en\s+la\s+app/i
    )
    .first()
    .isVisible({ timeout: 400 })
    .catch(() => false);
  if (pushOrApproveCopy) return true;

  const nequiShell =
    (await scope.getByText(WOMPI_NEQUI_WALLET_HEADER_RE).first().isVisible({ timeout: 200 }).catch(() => false)) ||
    (await wompiNequiMobilePhoneInputs(scope).first().isVisible({ timeout: 200 }).catch(() => false));
  if (!nequiShell) return false;

  return scope
    .getByText(/\bespera\b|procesando|validando/i)
    .first()
    .isVisible({ timeout: 350 })
    .catch(() => false);
}

/**
 * Tras `tryClickWompiNequiContinue` en billetera Nequi: el widget suele dejar de mostrar los T&C del
 * formulario y mostrar solo el mensaje de push; antes caíamos en un bucle de `waitForTimeout(500)`
 * porque el teléfono seguía en DOM y `wompiNequiPushOrWaitingUi` devolvía false.
 */
async function wompiNequiPostContinueWaitSettled(scope: Frame | FrameLocator): Promise<boolean> {
  const formGone = !(await scope
    .getByRole("checkbox", { name: /acepto el reglamento/i })
    .first()
    .isVisible({ timeout: 200 })
    .catch(() => false));
  if (!formGone) return false;
  return scope
    .getByText(/notificaci[oó]n\s+push|push\s+notification|recibir[aá]s|confirma\s+en/i)
    .first()
    .isVisible({ timeout: 400 })
    .catch(() => false);
}

/** Iframe (anidado o no) donde está el paso actual del checkout Wompi. */
async function pickPrimaryWompiScope(
  page: Page,
  scopes: FrameLocator[]
): Promise<WompiCheckoutBox | null> {
  if (!scopes.length) return null;
  for (const box of scopes) {
    if (await wompiTerminalPaymentOutcomeVisible(box)) return box;
    if (await wompiNequiAccountPhoneLocator(box).isVisible({ timeout: 400 }).catch(() => false)) {
      return box;
    }
    if (await wompiNequiPushOrWaitingUi(box)) return box;
    if (
      await box
        .getByRole("button", { name: /continuar con (tu|el) pago/i })
        .first()
        .isVisible({ timeout: 400 })
        .catch(() => false)
    ) {
      return box;
    }
    if (
      await box
        .getByText(WOMPI_PAYER_DATA_STEP_RE)
        .first()
        .isVisible({ timeout: 500 })
        .catch(() => false)
    ) {
      return box;
    }
    if (await wompiNequiMethodLocator(box).isVisible({ timeout: 400 }).catch(() => false)) {
      return box;
    }
  }
  for (const box of scopes) {
    if (
      await box
        .getByText(
          /paga con nequi|pay with nequi|número celular de tu cuenta nequi/i
        )
        .first()
        .isVisible({ timeout: 450 })
        .catch(() => false)
    ) {
      return box;
    }
  }
  /** Sin señales: preferir outer (el inner suele ser tracking o vacío). */
  return scopes[scopes.length - 1];
}

/** Botón principal en envío (spinner / aria-busy): no es el mismo caso que deshabilitado por T&C. */
async function wompiNequiContinueButtonSubmitting(
  scope: Frame | FrameLocator
): Promise<boolean> {
  const btn = scope
    .getByRole("button", {
      name: /continuar con (tu|el) pago|continue with your payment/i,
    })
    .first();
  return btn
    .evaluate((el: unknown) => {
      const node = el as {
        disabled?: boolean;
        className?: string;
        getAttribute?: (n: string) => string | null;
        querySelector?: (s: string) => unknown;
      };
      if (!node?.disabled) return false;
      const cls = typeof node.className === "string" ? node.className : "";
      const ga = node.getAttribute?.bind(node) ?? (() => null);
      return (
        ga("aria-busy") === "true" ||
        !!node.querySelector?.("svg") ||
        /\bloading\b|\bspinner\b|is-?loading/i.test(cls)
      );
    })
    .catch(() => false);
}

/**
 * Vista real «Paga con Nequi» (cabecera, `#mobilePhone` visible o textbox accesible).
 * `wompiNequiMobilePhoneInputs(box).count() > 0` **no** basta: clones ocultos en iframes de tracking
 * hacían entrar a `tryAdvanceOneWompiScope` en documentos equivocados y quemar ~15s por intento.
 */
async function wompiNequiWalletViableForAdvance(box: WompiCheckoutBox): Promise<boolean> {
  if (
    await box
      .getByText(WOMPI_NEQUI_WALLET_HEADER_RE)
      .first()
      .isVisible({ timeout: 450 })
      .catch(() => false)
  ) {
    return true;
  }
  const phoneInputs = wompiNequiMobilePhoneInputs(box);
  const n = Math.min(await phoneInputs.count().catch(() => 0), 10);
  for (let i = 0; i < n; i++) {
    if (await phoneInputs.nth(i).isVisible({ timeout: 200 }).catch(() => false)) {
      return true;
    }
  }
  const textboxNameRe =
    /número celular de tu cuenta nequi|celular.*cuenta.*nequi|ingresa el n[uú]mero de tu celular|cell(?:ular)?\s+number.*nequi|your\s+nequi|phone.*nequi/i;
  return box
    .getByRole("textbox", { name: textboxNameRe })
    .first()
    .isVisible({ timeout: 400 })
    .catch(() => false);
}

/**
 * Tras clic en «Continuar con tu pago» en Nequi: esperar push / resultado / finalizar sin re-clicar.
 *
 * @returns `false` si seguimos en el formulario billetera (T&C visibles): el clic no cambió vista y
 *   no debe tratarse como avance — evita miles de `waitForTimeout(~120ms)` en trace.
 * @returns `true` si vimos cola de espera / resultado / finalizar o agotamos el tiempo de absorción.
 */
async function waitAfterNequiContinueSubmitted(
  page: Page,
  scope: Frame | FrameLocator,
  flowDeadline: number
): Promise<boolean> {
  const walletFormOpen =
    (await scope
      .getByRole("checkbox", { name: /acepto el reglamento/i })
      .first()
      .isVisible({ timeout: 280 })
      .catch(() => false)) ||
    (await scope
      .getByRole("checkbox", { name: WOMPI_NEQUI_PERSONAL_DATA_CHECKBOX_NAME_RE })
      .first()
      .isVisible({ timeout: 220 })
      .catch(() => false));
  if (walletFormOpen) {
    return false;
  }

  const end = Math.min(Date.now() + 75_000, flowDeadline);
  const phone = wompiNequiAccountPhoneLocator(scope);
  const sleepMs = wompiPostContinueLoopSleepMs();

  while (Date.now() < end) {
    if (wompiPageShowsCheckoutResultado(page)) {
      return true;
    }
    if (await tryClickWompiFinalizarMiProceso(scope)) {
      return true;
    }
    if (await wompiNequiPushOrWaitingUi(scope)) {
      return true;
    }
    if (await wompiNequiPostContinueWaitSettled(scope)) {
      return true;
    }
    if (await wompiTerminalPaymentOutcomeVisible(scope)) {
      return true;
    }
    if (
      await scope
        .getByText(
          /transacci[oó]n\s+(aprobada|rechazada|declinada)|pago\s+(aprobado|rechazado|declinado)|aprobamos|rechazamos|operaci[oó]n\s+exitosa/i
        )
        .first()
        .isVisible({ timeout: 400 })
        .catch(() => false)
    ) {
      return true;
    }
    if (!(await phone.isVisible({ timeout: 350 }).catch(() => false))) {
      return true;
    }
    try {
      await page.waitForTimeout(sleepMs);
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Un solo frame (inner u outer): Nequi → datos pagador → tel + T&C → continuar → finalizar.
 * Espera corta por `#mobilePhone`: el bucle exterior reintenta en otro scope si este es contenedor vacío.
 */
async function tryAdvanceOneWompiScope(
  page: Page,
  box: WompiCheckoutBox,
  digits: string,
  flowDeadline: number
): Promise<boolean> {
  if (wompiPageShowsCheckoutResultado(page)) return true;
  if (await tryClickWompiFinalizarMiProceso(box)) {
    return true;
  }
  if (await wompiTerminalPaymentOutcomeVisible(box)) {
    if (await tryClickWompiFinalizarMiProceso(box)) {
      return true;
    }
    return false;
  }

  if (await wompiNequiPushOrWaitingUi(box)) {
    return false;
  }

  if (await wompiPayerDataStepVisible(box)) {
    /** Sin fill: los campos vienen del checkout; solo avanzar al paso Nequi cuenta. */
    if (await tryClickWompiNequiContinue(box, flowDeadline)) {
      if (!(await waitAfterNequiContinueSubmitted(page, box, flowDeadline))) return false;
      return true;
    }
    return false;
  }

  /**
   * Vista billetera Nequi: señales **visibles** (no solo nodos `#mobilePhone` ocultos en el DOM).
   */
  if (await wompiNequiWalletViableForAdvance(box)) {
    if (await wompiTerminalPaymentOutcomeVisible(box)) {
      if (await tryClickWompiFinalizarMiProceso(box)) {
        return true;
      }
      return false;
    }

    await uncheckWompiNequiUseSameCheckoutPhoneIfPresent(box, page);

    const phoneBudget = Math.min(15_000, Math.max(2_500, flowDeadline - Date.now()));

    let digitsOk = await tryFillWompiNequiPhoneViaAccessibleTextbox(box, page, digits, phoneBudget);

    if (!digitsOk && wompiCheckoutBoxIsFrame(box)) {
      const filled = await wompiFillNequiPhoneViaFrameDom(box, digits).catch(() => false);
      digitsOk = filled && (await wompiNequiMobileValueMatchesInFrame(box, digits));
    }

    if (!digitsOk) {
      let activePhoneField =
        (await resolveWompiNequiMobilePhoneInput(page, box, phoneBudget)) ??
        (await pickVisibleNequiWalletPhoneField(page, box, Math.min(8_000, phoneBudget)));
      if (!activePhoneField) {
        return false;
      }

      await activePhoneField
        .waitFor({ state: "attached", timeout: Math.min(5_000, Math.max(400, flowDeadline - Date.now())) })
        .catch(() => {});

      await wompiFillNequiPhoneDigits(activePhoneField, digits);
      const phoneRead =
        (await activePhoneField
          .evaluate((e) => (e as { tagName?: string }).tagName === "INPUT")
          .catch(() => false))
          ? activePhoneField
          : activePhoneField.locator("input").first();
      digitsOk =
        (await phoneRead.inputValue().catch(() => "")).replace(/\D/g, "") === digits;
    }

    if (!digitsOk) {
      return false;
    }

    const contractBudget = Math.min(45_000, Math.max(3000, flowDeadline - Date.now()));
    const termsOk = await waitUntilNequiContractsChecked(box, page, contractBudget);
    if (wompiPageShowsCheckoutResultado(page)) return true;
    if (!termsOk) {
      return false;
    }
    try {
      await page.waitForTimeout(120);
    } catch {
      return false;
    }

    if (await wompiNequiContinueButtonSubmitting(box)) {
      await waitAfterNequiContinueSubmitted(page, box, flowDeadline);
      return false;
    }

    const clicked = await tryClickWompiNequiContinue(box, flowDeadline);
    if (clicked) {
      if (!(await waitAfterNequiContinueSubmitted(page, box, flowDeadline))) return false;
      return true;
    }
    return false;
  }

  const phoneField = wompiNequiAccountPhoneLocator(box);
  const phoneWait = Math.min(2_800, Math.max(600, flowDeadline - Date.now()));
  const phoneVisible = await phoneField
    .waitFor({ state: "visible", timeout: phoneWait })
    .then(() => true)
    .catch(() => false);

  let activePhoneField: Locator = phoneField;
  if (phoneVisible) {
    const onNequiCuentaStep =
      (await box.getByText(WOMPI_NEQUI_WALLET_HEADER_RE).first().isVisible({ timeout: 400 }).catch(() => false)) ||
      (await box
        .locator('#mobilePhone, input[name="mobilePhone"]')
        .first()
        .isVisible({ timeout: 400 })
        .catch(() => false));
    if (!onNequiCuentaStep) {
      if (await wompiPayerDataStepVisible(box)) {
        if (await tryClickWompiNequiContinue(box, flowDeadline)) {
          if (!(await waitAfterNequiContinueSubmitted(page, box, flowDeadline))) return false;
          return true;
        }
      }
      return false;
    }

    if (await wompiTerminalPaymentOutcomeVisible(box)) {
      if (await tryClickWompiFinalizarMiProceso(box)) {
        return true;
      }
      return false;
    }

    await uncheckWompiNequiUseSameCheckoutPhoneIfPresent(box, page);
    await activePhoneField
      .waitFor({ state: "visible", timeout: Math.min(5_000, Math.max(800, flowDeadline - Date.now())) })
      .catch(() => {});
    await wompiFillNequiPhoneDigits(activePhoneField, digits);
    const phoneRead =
      (await activePhoneField
        .evaluate((e) => (e as { tagName?: string }).tagName === "INPUT")
        .catch(() => false))
        ? activePhoneField
        : activePhoneField.locator("input").first();
    const digitsOk =
      (await phoneRead.inputValue().catch(() => "")).replace(/\D/g, "") === digits;

    const contractBudget = Math.min(45_000, Math.max(3000, flowDeadline - Date.now()));
    const termsOk = await waitUntilNequiContractsChecked(box, page, contractBudget);
    if (wompiPageShowsCheckoutResultado(page)) return true;
    if (!termsOk) {
      return false;
    }
    try {
      await page.waitForTimeout(350);
    } catch {
      return false;
    }

    if (digitsOk && (await wompiNequiContinueButtonSubmitting(box))) {
      await waitAfterNequiContinueSubmitted(page, box, flowDeadline);
      return false;
    }

    const clicked = await tryClickWompiNequiContinue(box, flowDeadline);
    if (clicked) {
      if (!(await waitAfterNequiContinueSubmitted(page, box, flowDeadline))) return false;
      return true;
    }
    return false;
  }

  if (await wompiNequiPushOrWaitingUi(box)) {
    return false;
  }

  /** Respaldo: mismo botón en «Ingresa tus datos» u otras vistas — solo clic, sin tocar inputs. */
  const continuarDatos = box.getByRole("button", {
    name: /continuar con (tu|el) pago|continue with your payment/i,
  });
  if (await continuarDatos.isVisible({ timeout: 900 }).catch(() => false)) {
    if (await tryClickWompiNequiContinue(box, flowDeadline)) {
      if (!(await waitAfterNequiContinueSubmitted(page, box, flowDeadline))) return false;
      return true;
    }
  }

  const payNequi = wompiNequiMethodLocator(box);
  if (await payNequi.isVisible({ timeout: 800 }).catch(() => false)) {
    await payNequi.click();
    return true;
  }

  return false;
}

/**
 * Flujo en el waybox: prueba **cada** scope (inner + outer si hay anidación) hasta que uno avance.
 * Si `FrameLocator` no apunta al documento donde Wompi pintó la UI (iframes anidados / orden distinto),
 * se recorre `page.frames()` en orígenes `*.wompi.co` como respaldo (misma lógica que `tryAdvanceOneWompiScope`).
 */
async function tryAdvanceWompiWayboxIframe(
  page: Page,
  digits: string,
  flowDeadline: number,
  scopes: FrameLocator[]
): Promise<boolean> {
  if (wompiPageShowsCheckoutResultado(page)) return true;
  /**
   * PRIMERO: `Frame` reales con input Nequi en DOM (incl. shadow). Orden: más inputs **visibles** y host Wompi,
   * para no ejecutar el flujo contra un iframe con clones ocultos antes que el documento del widget.
   */
  const rankedFrames: {
    frame: Frame;
    score: number;
    stats: WompiNequiPhoneFrameStats;
    wompiHost: boolean;
  }[] = [];
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    try {
      const stats = await wompiNequiPhoneStatsInFrameDocument(frame);
      if (stats.total < 1) continue;
      let url = "";
      try {
        url = frame.url();
      } catch {
        url = "";
      }
      const wompiHost = /wompi\.co|wompi\.com/i.test(url);
      const hostBoost = wompiHost ? 10_000 : 0;
      const score = hostBoost + stats.visible * 1_000 + stats.total;
      rankedFrames.push({ frame, score, stats, wompiHost });
    } catch {
      /* detached */
    }
  }
  rankedFrames.sort((a, b) => b.score - a.score);
  const rankedTop = rankedFrames.slice(0, 8);
  for (const { frame, stats, wompiHost } of rankedTop) {
    if (wompiPageShowsCheckoutResultado(page)) return true;
    /** Tracking / ads: a veces clonan `#mobilePhone` oculto; no gastar `tryAdvance` si no hay input visible y el origen no es Wompi. */
    if (stats.visible < 1 && !wompiHost) continue;
    try {
      if (await tryAdvanceOneWompiScope(page, frame, digits, flowDeadline)) {
        return true;
      }
    } catch {
      /* detached */
    }
  }

  if (wompiPageShowsCheckoutResultado(page)) return true;
  for (const box of scopes) {
    if (wompiPageShowsCheckoutResultado(page)) return true;
    if (await tryAdvanceOneWompiScope(page, box, digits, flowDeadline)) {
      return true;
    }
  }

  for (const frame of page.frames()) {
    if (wompiPageShowsCheckoutResultado(page)) return true;
    if (frame === page.mainFrame()) continue;

    let url = "";
    try {
      url = frame.url();
    } catch {
      continue;
    }
    const wompiHost = /wompi\.co|wompi\.com/i.test(url);

    try {
      const nequiHeaderVisible = await frame
        .getByText(WOMPI_NEQUI_WALLET_HEADER_RE)
        .first()
        .isVisible({ timeout: 400 })
        .catch(() => false);
      if (!wompiHost && !nequiHeaderVisible) continue;

      const shell =
        (await frame
          .getByText(WOMPI_METHODS_SHELL_RE)
          .first()
          .isVisible({ timeout: 400 })
          .catch(() => false)) ||
        nequiHeaderVisible ||
        (await frame
          .getByText(/número celular de tu cuenta nequi/i)
          .first()
          .isVisible({ timeout: 400 })
          .catch(() => false));
      if (!shell) continue;

      if (await tryAdvanceOneWompiScope(page, frame, digits, flowDeadline)) {
        return true;
      }
    } catch {
      /* frame cerrado / detached */
    }
  }

  return false;
}

export type WompiSandboxAdvanceThroughWidgetOpts = {
  nequiPhoneDigits: string;
  timeoutMs?: number;
};

/**
 * Avanza el widget Wompi (Nequi) hasta que Next navegue a /checkout/resultado.
 * «Ingresa tus datos» → tel sandbox + T&C → push/resultado → **«Finalizar mi proceso»**.
 */
export async function wompiSandboxAdvanceThroughWidget(
  page: Page,
  opts: WompiSandboxAdvanceThroughWidgetOpts
): Promise<void> {
  const digits = opts.nequiPhoneDigits.replace(/\D/g, "");
  const deadline = Date.now() + (opts.timeoutMs ?? 90_000);
  /** Mismo intervalo que `waitAfterWompiWayboxLoadingSettle` al sondear carga del waybox. */
  const pollMs = 250;
  /** Ticks sin acción con waybox vacío / roto (no confundir con «Espera» Nequi: ahí sí hay UI). */
  let staleWayboxTicks = 0;
  const staleLimit = Math.ceil(45_000 / pollMs);
  /** No re-contar `iframe.waybox-iframe iframe` en cada tick (ruido en trace y costo). */
  let wayboxScopesCache: FrameLocator[] | null = null;
  /** Mientras no hay waybox, sondear cada vuelta; una vez visible, `count()` cada 8 ticks. */
  let wayboxPresenceCounter = 0;
  let lastWayboxPresent = false;
  /**
   * Una vez en «Paga con Nequi», aplicar la misma pausa post-carga que en `wompiSelectPaymentMethod`
   * (`waitAfterWompiWayboxLoadingSettle` / `E2E_WOMPI_WIDGET_SETTLE_MS`) para que el textbox hidrate.
   */
  let nequiWalletSettleApplied = false;

  while (Date.now() < deadline) {
    if (wompiPageShowsCheckoutResultado(page)) {
      return;
    }

    if (await tryClickWompiFinalizarMiProceso(page)) {
      await page.waitForTimeout(120).catch(() => {});
      continue;
    }

    wayboxPresenceCounter += 1;
    if (!lastWayboxPresent || wayboxPresenceCounter % 8 === 1) {
      lastWayboxPresent = (await page.locator("iframe.waybox-iframe").count()) > 0;
    }
    const hasWaybox = lastWayboxPresent;

    if (!hasWaybox) {
      wayboxScopesCache = null;
      nequiWalletSettleApplied = false;
    } else if (!wayboxScopesCache?.length || wayboxPresenceCounter % 6 === 1) {
      if (wompiPageShowsCheckoutResultado(page)) return;
      /** Recalcular scopes: el DOM del waybox cambia (inner navigation) y `FrameLocator` viejo no ve `#mobilePhone`. */
      wayboxScopesCache = await wompiCheckoutScopes(page);
    }
    const scopes = wayboxScopesCache ?? [];

    if (hasWaybox && scopes.length > 0 && !nequiWalletSettleApplied) {
      const primaryForSettle = await pickPrimaryWompiScope(page, scopes);
      if (primaryForSettle) {
        const onNequiWallet =
          (await primaryForSettle
            .getByText(WOMPI_NEQUI_WALLET_HEADER_RE)
            .first()
            .isVisible({ timeout: 500 })
            .catch(() => false)) ||
          (await primaryForSettle
            .getByText(/número celular de tu cuenta nequi/i)
            .first()
            .isVisible({ timeout: 400 })
            .catch(() => false));
        if (onNequiWallet && wompiMsUntil(deadline) > 800) {
          await waitAfterWompiWayboxLoadingSettle(page, primaryForSettle, deadline);
          const hydrate = wompiNequiWalletHydrateMs();
          if (
            hydrate > 0 &&
            wompiMsUntil(deadline) > hydrate + 500 &&
            !wompiPageShowsCheckoutResultado(page)
          ) {
            await page.waitForTimeout(hydrate).catch(() => {});
          }
          nequiWalletSettleApplied = true;
        }
      }
    }

    const wayboxActed = await tryAdvanceWompiWayboxIframe(
      page,
      digits,
      deadline,
      scopes
    );
    if (wompiPageShowsCheckoutResultado(page)) {
      return;
    }

    let slowNequiTailPoll = false;
    if (hasWaybox && !wayboxActed) {
      const boxFl =
        scopes.length > 0 ? await pickPrimaryWompiScope(page, scopes) : null;
      const midNequiOrWait = boxFl
        ? (await wompiNequiAccountPhoneLocator(boxFl)
            .isVisible({ timeout: 400 })
            .catch(() => false)) ||
          (await wompiNequiPhoneInputFallback(boxFl)
            .isVisible({ timeout: 200 })
            .catch(() => false)) ||
          (await boxFl
            .getByText(WOMPI_NEQUI_WALLET_HEADER_RE)
            .first()
            .isVisible({ timeout: 400 })
            .catch(() => false)) ||
          (await boxFl
            .getByRole("button", {
              name: /continuar con (tu|el) pago|continue with your payment|pagar\s+con/i,
            })
            .first()
            .isVisible({ timeout: 400 })
            .catch(() => false)) ||
          (await boxFl
            .getByText(/espera|notificación\s+push|push\s+notification/i)
            .first()
            .isVisible()
            .catch(() => false)) ||
          (await wompiNequiContinueButtonSubmitting(boxFl)) ||
          (await wompiTerminalPaymentOutcomeVisible(boxFl))
        : false;
      const nequiWalletShell =
        !!boxFl && (midNequiOrWait || (await wompiNequiWalletViableForAdvance(boxFl)));
      if (nequiWalletShell) {
        staleWayboxTicks = 0;
        slowNequiTailPoll = true;
      } else {
        staleWayboxTicks += 1;
        if (staleWayboxTicks > staleLimit) {
          throw new Error(
            "Wompi: el iframe waybox no avanza (~45s sin UI usable; suele ser CORS / widget en blanco). " +
              "Revisá consola: Failed to fetch hacia api-sandbox.wompi.co. " +
              "`ensureWompiSandboxApiCorsBypass` se aplica en runCheckoutUntilWompiMethodsVisible; " +
              "desactivar con E2E_WOMPI_DISABLE_API_CORS_BYPASS=1 solo para depurar."
          );
        }
      }
    } else {
      staleWayboxTicks = 0;
    }

    const tailSleepMs = slowNequiTailPoll ? wompiNequiIdlePollMs() : pollMs;
    try {
      await page.waitForTimeout(tailSleepMs);
    } catch {
      if (wompiPageShowsCheckoutResultado(page)) return;
      throw new Error(
        "Wompi: el navegador se cerró durante el avance del widget (timeout global del test). " +
          "Si la UI ya había llegado a /checkout/resultado, las salidas tempranas deberían evitar esto."
      );
    }
  }

  throw new Error(
    `Timeout ${opts.timeoutMs ?? 90_000}ms: no se llegó a /checkout/resultado (¿falta pulsar «Finalizar mi proceso» en el widget?).`
  );
}

export async function expectCheckoutResultUrl(
  page: Page,
  ws: "APPROVED" | "DECLINED" | "PENDING"
): Promise<void> {
  const extra = Number(process.env.E2E_CHECKOUT_RESULT_MS);
  const defaultMs =
    process.env.RUN_WOMPI_SANDBOX_E2E === "1" ? 55_000 : 30_000;
  const timeout =
    Number.isFinite(extra) && extra > 0 ? extra : defaultMs;
  await expect(page).toHaveURL(
    new RegExp(`/checkout/resultado[?#].*(?:ws|st)=${ws}\\b`, "i"),
    { timeout }
  );
}
