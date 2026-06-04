/**
 * Log inmediato en CI tras "Running N tests" y fallo rápido si la API del sandbox no responde.
 */
function sandboxHeaders(): Record<string, string> {
  const h: Record<string, string> = { "x-test-env": "playwright-wompi-sandbox" };
  const base = (process.env.SANDBOX_BASE_URL || "").toLowerCase();
  if (base.includes("ngrok")) {
    h["ngrok-skip-browser-warning"] = "true";
  }
  return h;
}

export default async function globalSetup(): Promise<void> {
  const base = (process.env.SANDBOX_BASE_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  console.log(`[sandbox setup] SANDBOX_BASE_URL=${base}`);

  const paths = ["/api/health/", "/api/catalogo/?page_size=1"];
  for (const path of paths) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    try {
      const res = await fetch(`${base}${path}`, {
        headers: sandboxHeaders(),
        signal: ctrl.signal,
      });
      const head = (await res.text()).trimStart().slice(0, 24).toLowerCase();
      const looksHtml =
        head.startsWith("<!doctype") || head.startsWith("<html");
      console.log(
        `[sandbox setup] ${path} → ${res.status}${looksHtml ? " (HTML, no JSON)" : ""}`
      );
      if (!res.ok || looksHtml) {
        throw new Error(
          `Sandbox no listo: ${path} → ${res.status}. Revisá E2E_SANDBOX_BASE_URL y que Django/API estén arriba.`
        );
      }
    } finally {
      clearTimeout(timer);
    }
  }
}
