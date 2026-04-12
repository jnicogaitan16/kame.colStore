/**
 * E2E contra Wompi sandbox (Next + Django reales, llaves en .env).
 * No levanta mock-backend: arrancá backend y frontend antes de ejecutar.
 *
 * RUN_WOMPI_SANDBOX_E2E=1 npx playwright test -c playwright.sandbox.config.ts
 * Opcional: E2E_PLAYWRIGHT_SLOW_MO=350 (slowMo al lanzar el navegador, p. ej. con --headed).
 * Menos avisos WebGL en trace: E2E_PLAYWRIGHT_DISABLE_GPU=1 (args --disable-gpu).
 *
 * Con `next dev`, Fast Refresh puede remontar la página durante el test y dejar el iframe Wompi
 * vacío o en bucle; para CI o runs estables preferí `next build && next start`.
 *
 * En consola del trace pueden aparecer violaciones CSP de imágenes GTM (`/td`) dentro de
 * checkout.wompi.co (política de Wompi) y avisos WebGL «ReadPixels»: no indican fallo del test;
 * para menos ruido GPU: E2E_PLAYWRIGHT_DISABLE_GPU=1.
 */
import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Copia `NEXT_PUBLIC_WOMPI_PUBLIC_KEY` desde `frontend/.env.local` al proceso de Node si no está
 * definida (p. ej. al correr tests desde `tests/`). Así `addInitScript` puede inyectarla y evitar
 * `GET …/merchants/undefined` en v1.js. Desactivar: `E2E_SKIP_LOAD_FRONTEND_ENV=1`.
 */
function mergeFrontendWompiPublicKeyFromEnvLocal(): void {
  if (process.env.E2E_SKIP_LOAD_FRONTEND_ENV === "1") return;
  if (process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY) return;
  const envPath = path.join(__dirname, "..", "frontend", ".env.local");
  if (!fs.existsSync(envPath)) return;
  try {
    const text = fs.readFileSync(envPath, "utf8");
    for (let line of text.split("\n")) {
      line = line.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      if (key !== "NEXT_PUBLIC_WOMPI_PUBLIC_KEY") continue;
      let val = line.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (val) process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY = val;
      break;
    }
  } catch {
    /* ignorar lectura/parse */
  }
}

mergeFrontendWompiPublicKeyFromEnvLocal();

const slowMoRaw = process.env.E2E_PLAYWRIGHT_SLOW_MO;
const slowMoParsed = slowMoRaw ? Number(slowMoRaw) : NaN;
const slowMo =
  Number.isFinite(slowMoParsed) && slowMoParsed > 0 ? slowMoParsed : undefined;

const sandboxLaunchArgs =
  process.env.E2E_PLAYWRIGHT_DISABLE_GPU === "1" ? ["--disable-gpu"] : [];

const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/payments-nequi-sandbox.spec.ts",
  fullyParallel: false,
  forbidOnly: CI,
  retries: 0,
  workers: 1,
  /** Nequi sandbox puede superar 3 min (checkout + widget + 2 casos en serie). */
  timeout: 300_000,
  expect: { timeout: 20_000 },
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL: process.env.SANDBOX_BASE_URL || "http://localhost:3000",
    /** Alineado con el widget Wompi (ES); evita que Chrome traduzca labels y rompa los locators. */
    locale: "es-CO",
    /** `on-first-retry` + interrupción manual puede dejar ENOENT en artefactos; retain solo en fallo. */
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    extraHTTPHeaders: { "x-test-env": "playwright-wompi-sandbox" },
    launchOptions: {
      ...(slowMo != null ? { slowMo } : {}),
      ...(sandboxLaunchArgs.length > 0 ? { args: sandboxLaunchArgs } : {}),
    },
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
