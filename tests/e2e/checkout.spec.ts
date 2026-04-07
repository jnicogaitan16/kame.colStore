/**
 * P0 — Checkout
 * Validación de formulario, cotización de envío, submit.
 */
import { test, expect } from "@playwright/test";
import {
  mockAllAPIs,
  mockCheckout,
  mockCheckoutError,
  mockShippingQuote,
  mockStockValidate,
  mockWompiSignature,
  mockWompiWidget,
} from "./fixtures/api-mocks";
import {
  STOCK_VALIDATE_WARNING_MOCK,
  TEST_CHECKOUT_CART_STATE,
  TEST_SHIPPING,
} from "./fixtures/catalog-data";

/** Carga el checkout con el carrito pre-cargado vía localStorage */
async function goToCheckoutWithCart(page: any) {
  await mockAllAPIs(page);

  await page.goto("/");
  await page.evaluate((cartState: string) => {
    localStorage.setItem("kame-cart", cartState);
  }, JSON.stringify(TEST_CHECKOUT_CART_STATE));

  await page.goto("/checkout");
  // Esperar a que el formulario esté visible (CartHydration es async)
  await page.waitForSelector("form", { timeout: 5000 }).catch(() => {});
}

const VALID_FORM = {
  fullName: "Ana García",
  phone: "3001234567",
  email: "ana@test.com",
  cedula: "123456789",
  address: "Calle 100 # 15-20 Apto 301",
  city: "BOG",
};

test.describe("Checkout — carga", () => {
  test("la página de checkout carga correctamente", async ({ page }) => {
    await mockAllAPIs(page);
    const res = await page.goto("/checkout");
    expect(res?.status()).toBe(200);
  });

  test("muestra el formulario de checkout", async ({ page }) => {
    await goToCheckoutWithCart(page);
    await expect(page.locator("form")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Checkout — validación de formulario", () => {
  test.beforeEach(async ({ page }) => {
    await goToCheckoutWithCart(page);
  });

  test("submit sin datos muestra errores de validación", async ({ page }) => {
    await page.getByRole("button", { name: /pagar|confirmar|realizar pedido|submit/i }).click();

    // Debe mostrar al menos un error de campo requerido
    await expect(
      page.getByText(/requerido|obligatorio|required|este campo/i).first()
    ).toBeVisible({ timeout: 3000 });
  });

  test("email inválido muestra error", async ({ page }) => {
    const emailInput = page.locator("#email");

    await emailInput.fill("no-es-un-email");
    await page.getByRole("button", { name: /pagar|confirmar|realizar pedido|submit/i }).click();

    const isValid = await emailInput.evaluate(
      (el: HTMLInputElement) => el.checkValidity()
    );
    expect(isValid).toBe(false);

    const validationMessage = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage
    );
    expect(validationMessage.length).toBeGreaterThan(0);
    expect(validationMessage).toMatch(/@|email/i);
  });

  test("campo teléfono solo acepta dígitos", async ({ page }) => {
    const phoneInput = page.locator("#phone");
    await phoneInput.fill("abc123");
    await phoneInput.blur();
    // El valor debe ser solo dígitos o mostrar error
    const value = await phoneInput.inputValue();
    expect(value).toMatch(/^\d*$/);
  });
});

test.describe("Checkout — cotización de envío", () => {
  test.beforeEach(async ({ page }) => {
    await goToCheckoutWithCart(page);
  });

  test("seleccionar ciudad actualiza el costo de envío", async ({ page }) => {
    const citySelect = page.locator("#city_code");

    await citySelect.selectOption(VALID_FORM.city);

    // El shipping cost debe aparecer
    await expect(
      page.getByText(TEST_SHIPPING.amountPattern)
    ).toBeVisible({ timeout: 4000 });
  });

  test("muestra envío gratis cuando el subtotal supera $170.000", async ({ page }) => {
    await mockShippingQuote(page, { amount: 0, label: "Envío gratis" });

    const citySelect = page.locator("#city_code");
    await citySelect.selectOption(VALID_FORM.city);

    await expect(
      page.getByText(TEST_SHIPPING.freePattern)
    ).toBeVisible({ timeout: 4000 });
  });
});

test.describe("Checkout — submit", () => {
  test.beforeEach(async ({ page }) => {
    await goToCheckoutWithCart(page);
  });

  async function fillValidForm(page: any) {
    await page.locator("#full_name").fill(VALID_FORM.fullName);
    await page.locator("#phone").fill(VALID_FORM.phone);
    await page.locator("#email").fill(VALID_FORM.email);
    await page.locator("#cedula").fill(VALID_FORM.cedula);
    await page.locator("#address").fill(VALID_FORM.address);
    await page.locator("#city_code").selectOption(VALID_FORM.city);
  }

  test("submit válido crea la orden y redirige a resultado con APPROVED", async ({ page }) => {
    // Nuevo flujo: checkout → wompi-signature → widget → /checkout/resultado
    await mockCheckout(page);
    await mockWompiSignature(page);
    await mockWompiWidget(page, "APPROVED");

    await fillValidForm(page);

    const submitBtn = page.getByRole("button", { name: /confirmar pedido/i });
    await expect(submitBtn).toBeEnabled({ timeout: 6000 });

    // Registrar el listener ANTES del click para no perder la respuesta
    const checkoutResponsePromise = page.waitForResponse(
      (resp) => /\/api\/checkout/.test(resp.url()) && resp.status() === 201,
      { timeout: 8000 }
    );

    await submitBtn.click();
    await checkoutResponsePromise;

    // El widget stub llama al callback con APPROVED → router.push a /checkout/resultado
    await expect(page).toHaveURL(/checkout\/resultado.*ws=APPROVED/, { timeout: 15000 });
  });

  test("submit válido con pago DECLINED redirige a resultado con DECLINED", async ({ page }) => {
    await mockCheckout(page);
    await mockWompiSignature(page);
    await mockWompiWidget(page, "DECLINED");

    await fillValidForm(page);

    const submitBtn = page.getByRole("button", { name: /confirmar pedido/i });
    await expect(submitBtn).toBeEnabled({ timeout: 6000 });

    const checkoutResponsePromise = page.waitForResponse(
      (resp) => /\/api\/checkout/.test(resp.url()) && resp.status() === 201,
      { timeout: 8000 }
    );

    await submitBtn.click();
    await checkoutResponsePromise;

    await expect(page).toHaveURL(/checkout\/resultado.*ws=DECLINED/, { timeout: 15000 });
  });

  test("error de API muestra mensaje al usuario", async ({ page }) => {
    await mockCheckoutError(page);

    await fillValidForm(page);

    const submitBtn = page.getByRole("button", { name: /confirmar pedido/i });
    await expect(submitBtn).toBeEnabled({ timeout: 6000 });
    await submitBtn.click();

    await expect(
      page.getByText(/corrige los campos marcados|revisa los datos|stock insuficiente|error|no se pudo/i)
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Checkout — stock warnings", () => {
  test("advertencia de stock se muestra en el resumen", async ({ page }) => {
    // Warning mock must be registered AFTER mockAllAPIs so it takes precedence (Playwright LIFO routing)
    await mockAllAPIs(page);
    await mockStockValidate(page, STOCK_VALIDATE_WARNING_MOCK);

    await page.goto("/");
    await page.evaluate((cartState: string) => {
      localStorage.setItem("kame-cart", cartState);
    }, JSON.stringify(TEST_CHECKOUT_CART_STATE));

    await page.goto("/checkout");
    await page.waitForSelector("form", { timeout: 5000 }).catch(() => {});

    // Stock validate fires on checkout load — warning should appear in summary
    await expect(
      page.getByText(/últimas|stock|unidades/i)
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Checkout — mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("formulario es usable en mobile", async ({ page }) => {
    await goToCheckoutWithCart(page);
    await expect(page.locator("form")).toBeVisible();
    // El primer input debe ser interactuable
    await page.locator("form input").first().click();
    await expect(page.locator("form input").first()).toBeFocused();
  });
});
