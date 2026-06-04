/**
 * Preflight antes de los tests: API JSON + página /checkout del storefront Next.
 */
function sandboxHeaders(): Record<string, string> {
  const h: Record<string, string> = { "x-test-env": "playwright-wompi-sandbox" };
  const base = (process.env.SANDBOX_BASE_URL || "").toLowerCase();
  if (base.includes("ngrok")) {
    h["ngrok-skip-browser-warning"] = "true";
  }
  return h;
}

const CHECKOUT_MARKERS =
  /Checkout|Finaliza tu pedido|id="full_name"|id='full_name'/i;

export default async function globalSetup(): Promise<void> {
  const base = (process.env.SANDBOX_BASE_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  console.log(`[sandbox setup] SANDBOX_BASE_URL=${base}`);

  const apiPaths = ["/api/health/", "/api/catalogo/?page_size=1"];
  for (const path of apiPaths) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    try {
      const res = await fetch(`${base}${path}`, {
        headers: sandboxHeaders(),
        signal: ctrl.signal,
      });
      const text = await res.text();
      const head = text.trimStart().slice(0, 24).toLowerCase();
      const looksHtml =
        head.startsWith("<!doctype") || head.startsWith("<html");
      console.log(
        `[sandbox setup] ${path} → ${res.status}${looksHtml ? " (HTML, no JSON)" : ""}`
      );
      if (!res.ok || looksHtml) {
        throw new Error(
          `Sandbox API no listo: ${path} → ${res.status}. E2E_SANDBOX_BASE_URL debe ser el storefront Next (con proxy /api a Django).`
        );
      }
    } finally {
      clearTimeout(timer);
    }
  }

  const checkoutCtrl = new AbortController();
  const checkoutTimer = setTimeout(() => checkoutCtrl.abort(), 30_000);
  try {
    const checkoutRes = await fetch(`${base}/checkout`, {
      headers: sandboxHeaders(),
      signal: checkoutCtrl.signal,
    });
    const checkoutHtml = await checkoutRes.text();
    console.log(`[sandbox setup] GET /checkout → ${checkoutRes.status}`);
    if (!checkoutRes.ok || !CHECKOUT_MARKERS.test(checkoutHtml)) {
      throw new Error(
        `Sandbox storefront inválido: GET /checkout → ${checkoutRes.status}. ` +
          "No uses solo la URL de Django (ngrok :8000); usá Next/Vercel preview o ngrok al puerto 3000."
      );
    }
  } finally {
    clearTimeout(checkoutTimer);
  }
}
