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
} from "./fixtures/api-mocks";
import { SHIPPING_QUOTE_BOG_MOCK, STOCK_VALIDATE_WARNING_MOCK } from "./fixtures/catalog-data";

/** Carga el checkout con el carrito pre-cargado vía localStorage */
async function goToCheckoutWithCart(page: any) {
  await mockAllAPIs(page);

  // Inyectar item en el carrito (Zustand usa localStorage con key "cart-storage" o similar)
  await page.goto("/");
  await page.evaluate(() => {
    const cartItem = {
      state: {
        items: [
          {
            variantId: 101,
            productId: 1,
            name: "Camiseta Kame Logo",
            variantLabel: "S / NEGRO",
            price: 89000,
            qty: 1,
            imageUrl: null,
            slug: "camiseta-kame-logo",
          },
        ],
      },
      version: 0,
    };
    // Intentar los keys más comunes de Zustand persist
    for (const key of ["cart-storage", "kame-cart", "cart"]) {
      localStorage.setItem(key, JSON.stringify(cartItem));
    }
  });

  await page.goto("/checkout");
}

const VALID_FORM = {
  fullName: "Ana García",
  phone: "3001234567",
  email: "ana@test.com",
  cedula: "1234567890",
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
    await mockAllAPIs(page);
    await page.goto("/checkout");
    await expect(page.getByRole("form").or(page.locator("form"))).toBeVisible();
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
    const emailInput = page.getByLabel(/email|correo/i).or(page.locator("input[type='email']")).first();
    await emailInput.fill("no-es-un-email");
    await emailInput.blur();

    await expect(
      page.getByText(/email (inválido|no válido|invalid)|formato.*email/i)
    ).toBeVisible({ timeout: 3000 });
  });

  test("campo teléfono solo acepta dígitos", async ({ page }) => {
    const phoneInput = page.getByLabel(/teléfono|celular|phone/i)
      .or(page.locator("input[name*='phone' i], input[name*='telefono' i]"))
      .first();
    await phoneInput.fill("abc123");
    await phoneInput.blur();
    // El valor debe ser solo "123" o mostrar error
    const value = await phoneInput.inputValue();
    expect(value).toMatch(/^\d*$/);
  });
});

test.describe("Checkout — cotización de envío", () => {
  test.beforeEach(async ({ page }) => {
    await goToCheckoutWithCart(page);
  });

  test("seleccionar ciudad actualiza el costo de envío", async ({ page }) => {
    const citySelect = page.getByLabel(/ciudad/i)
      .or(page.locator("select[name*='city' i]"))
      .first();

    await citySelect.selectOption("BOG");

    // El shipping cost debe aparecer ($10.000)
    await expect(
      page.getByText(/\$10\.000|\$10,000|10000/)
    ).toBeVisible({ timeout: 4000 });
  });

  test("muestra envío gratis cuando el subtotal supera $170.000", async ({ page }) => {
    await mockShippingQuote(page, { shipping_cost: 0, total: 178000 });

    const citySelect = page.getByLabel(/ciudad/i)
      .or(page.locator("select[name*='city' i]"))
      .first();
    await citySelect.selectOption("BOG");

    await expect(
      page.getByText(/gratis|free|envío.*gratis/i)
    ).toBeVisible({ timeout: 4000 });
  });
});

test.describe("Checkout — submit", () => {
  test.beforeEach(async ({ page }) => {
    await goToCheckoutWithCart(page);
  });

  test("submit con datos válidos crea la orden correctamente", async ({ page }) => {
    await mockCheckout(page);

    // Llenar el formulario completo
    await page.getByLabel(/nombre/i).or(page.locator("input[name*='name' i]")).first().fill(VALID_FORM.fullName);
    await page.getByLabel(/teléfono|celular/i).or(page.locator("input[name*='phone' i]")).first().fill(VALID_FORM.phone);
    await page.getByLabel(/email|correo/i).or(page.locator("input[type='email']")).first().fill(VALID_FORM.email);
    await page.getByLabel(/cédula|documento/i).or(page.locator("input[name*='cedula' i]")).first().fill(VALID_FORM.cedula);
    await page.getByLabel(/dirección/i).or(page.locator("input[name*='address' i]")).first().fill(VALID_FORM.address);

    const citySelect = page.getByLabel(/ciudad/i).or(page.locator("select[name*='city' i]")).first();
    await citySelect.selectOption(VALID_FORM.city);

    await page.getByRole("button", { name: /pagar|confirmar|realizar pedido/i }).click();

    // Debe mostrar confirmación de orden
    await expect(
      page.getByText(/pedido (creado|confirmado|recibido)|order (created|confirmed)/i)
        .or(page.locator("[data-testid='order-success'], [class*='success']"))
    ).toBeVisible({ timeout: 8000 });
  });

  test("error de API muestra mensaje al usuario", async ({ page }) => {
    await mockCheckoutError(page);

    await page.getByLabel(/nombre/i).or(page.locator("input[name*='name' i]")).first().fill(VALID_FORM.fullName);
    await page.getByLabel(/teléfono|celular/i).or(page.locator("input[name*='phone' i]")).first().fill(VALID_FORM.phone);
    await page.getByLabel(/email|correo/i).or(page.locator("input[type='email']")).first().fill(VALID_FORM.email);
    await page.getByLabel(/cédula|documento/i).or(page.locator("input[name*='cedula' i]")).first().fill(VALID_FORM.cedula);
    await page.getByLabel(/dirección/i).or(page.locator("input[name*='address' i]")).first().fill(VALID_FORM.address);

    const citySelect = page.getByLabel(/ciudad/i).or(page.locator("select[name*='city' i]")).first();
    await citySelect.selectOption(VALID_FORM.city);

    await page.getByRole("button", { name: /pagar|confirmar|realizar pedido/i }).click();

    await expect(
      page.getByText(/stock insuficiente|error|no se pudo/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("advertencia de stock se muestra antes del submit", async ({ page }) => {
    await mockStockValidate(page, STOCK_VALIDATE_WARNING_MOCK);

    await page.getByRole("button", { name: /pagar|confirmar|realizar pedido/i }).click();

    await expect(
      page.getByText(/solo quedan|stock|unidades/i)
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
