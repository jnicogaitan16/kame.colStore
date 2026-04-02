/**
 * P0 — Página de detalle de producto (PDP)
 * Variantes, galería, guía de tallas, add to cart.
 */
import { test, expect } from "@playwright/test";
import { mockAllAPIs } from "./fixtures/api-mocks";
import { PRODUCT_DETAIL_MOCK } from "./fixtures/catalog-data";

const PDP_URL = "/producto/88";

test.describe("PDP — contenido", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto(PDP_URL);
  });

  test("muestra el nombre del producto", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /^88$/ })
    ).toBeVisible({ timeout: 5000 });
  });

  test("muestra el precio formateado", async ({ page }) => {
    await expect(
      page.getByText(/\$88\.888|\$88,888/)
    ).toBeVisible({ timeout: 5000 });
  });

  test("muestra la descripción del producto", async ({ page }) => {
    await expect(page.getByText(/algodón|oversize/i)).toBeVisible({ timeout: 5000 });
  });

  test("imagen principal es visible", async ({ page }) => {
    await expect(page.locator("img[alt], [data-testid='product-image']").first()).toBeVisible({
      timeout: 5000,
    });
  });
});

test.describe("PDP — variantes", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto(PDP_URL);
  });

  test("muestra opciones de talla", async ({ page }) => {
    await expect(page.getByRole("button", { name: "S", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "M", exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "L", exact: true }).first()).toBeVisible();
  });

  test("hay al menos una talla deshabilitada/marcada como no disponible", async ({ page }) => {
    const disabledSizes = page.locator(
      ".pdp-size-item[disabled], .pdp-size-item[aria-disabled='true'], .pdp-size-item.ui-selectable-control--disabled"
    );
    await expect(disabledSizes.first()).toBeVisible({ timeout: 5000 });
  });

  test("seleccionar talla habilita el CTA de agregar al carrito", async ({ page }) => {
    await page.getByRole("button", { name: "S", exact: true }).first().click();

    const colorBtn = page.getByRole("button", { name: /rojo/i }).first();
    if (await colorBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await colorBtn.click();
    }

    const addToCartBtn = page.getByRole("button", { name: /agregar al carrito|sin stock/i });
    await expect(addToCartBtn).toBeEnabled({ timeout: 3000 });
  });

  test("CTA muestra estado correcto según variante seleccionada", async ({ page }) => {
    const addToCartBtn = page.getByRole("button", { name: /agregar al carrito|sin stock/i });
    await expect(addToCartBtn).toBeVisible({ timeout: 3000 });
  });
});

test.describe("PDP — guía de tallas", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto(PDP_URL);
  });

  test("botón de guía de tallas es visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /guía de medidas/i })).toBeVisible();
  });

  test("guía de tallas se abre al hacer click", async ({ page }) => {
    await page.getByRole("button", { name: /guía de medidas/i }).click();

    await expect(page.getByRole("dialog", { name: /guía de medidas/i })).toBeVisible({
      timeout: 3000,
    });
  });

  test("guía de tallas se cierra con Escape", async ({ page }) => {
    await page.getByRole("button", { name: /guía de medidas/i }).click();

    const dialog = page.getByRole("dialog", { name: /guía de medidas/i });
    await expect(dialog).toBeVisible({ timeout: 3000 });

    await page.keyboard.press("Escape");

    await expect(dialog).toHaveClass(/opacity-0/);
  });
});

test.describe("PDP — producto agotado", () => {
  test.describe("PDP — producto agotado", () => {
    test("CTA muestra agotado cuando sold_out=true", async ({ page }) => {
      await mockAllAPIs(page);
      await page.goto("/producto/99");
  
      const soldOutBtn = page.getByRole("button", { name: /sin stock/i });
  
      await expect(soldOutBtn).toBeVisible({ timeout: 5000 });
      await expect(soldOutBtn).toBeDisabled();
  
      await expect(page.getByText(/^Agotado$/)).toBeVisible({ timeout: 5000 });
    });
  });
});

test.describe("PDP — mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("PDP carga correctamente en mobile", async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto(PDP_URL);

    await expect(
      page.getByRole("heading", { name: /^88$/ })
    ).toBeVisible({ timeout: 5000 });
  });
});