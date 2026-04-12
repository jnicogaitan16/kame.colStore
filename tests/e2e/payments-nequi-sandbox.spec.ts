/**
 * Wompi sandbox — Nequi. Datos: WOMPI_SANDBOX.nequi
 *
 * Solo Nequi (sandbox):
 *   RUN_WOMPI_SANDBOX_E2E=1 npx playwright test e2e/payments-nequi-sandbox.spec.ts -c playwright.sandbox.config.ts
 *   npm run test:sandbox:nequi
 * Ver el flujo en el navegador (lento a propósito):
 *   npm run test:sandbox:nequi:headed
 */
import { test, expect } from "@playwright/test";
import { WOMPI_SANDBOX } from "./fixtures/wompi-sandbox";
import { isWompiSandboxE2EEnabled } from "./fixtures/wompi-sandbox-env";
import {
  runCheckoutUntilWompiMethodsVisible,
  wompiSelectPaymentMethod,
  wompiSandboxAdvanceThroughWidget,
  expectCheckoutResultUrl,
} from "./fixtures/payments-sandbox-helpers";

test.describe("Wompi sandbox — Nequi", () => {
  /**
   * Playwright UI / configs ajenos suelen usar ~60s por test: el widget Nequi + checkout supera eso.
   * Forzá acá el tope aunque no se pase `-c playwright.sandbox.config.ts`.
   */
  test.describe.configure({ timeout: 300_000 });

  test.beforeEach(() => {
    test.skip(
      !isWompiSandboxE2EEnabled(),
      "RUN_WOMPI_SANDBOX_E2E=1 y playwright.sandbox.config.ts"
    );
  });

  test("fixture teléfonos sandbox Nequi", () => {
    expect(WOMPI_SANDBOX.nequi.approved.phone).toMatch(/^\d+$/);
    expect(WOMPI_SANDBOX.nequi.declined.phone).toMatch(/^\d+$/);
    expect(WOMPI_SANDBOX.nequi.approved.expectedStatus).toBe("APPROVED");
  });

  test("Nequi aprobado → APPROVED", async ({ page }) => {
    await runCheckoutUntilWompiMethodsVisible(page);
    await wompiSelectPaymentMethod(page, "nequi");

    await wompiSandboxAdvanceThroughWidget(page, {
      nequiPhoneDigits: WOMPI_SANDBOX.nequi.approved.phone,
      timeoutMs: 120_000,
    });

    await expectCheckoutResultUrl(page, "APPROVED");
  });

  test("Nequi declinado → DECLINED", async ({ page }) => {
    await runCheckoutUntilWompiMethodsVisible(page);
    await wompiSelectPaymentMethod(page, "nequi");

    await wompiSandboxAdvanceThroughWidget(page, {
      nequiPhoneDigits: WOMPI_SANDBOX.nequi.declined.phone,
      timeoutMs: 120_000,
    });

    await expectCheckoutResultUrl(page, "DECLINED");
  });
});
