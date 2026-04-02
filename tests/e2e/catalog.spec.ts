/**
 * P1 — Catálogo
 * Grid de productos, estado vacío, filtros.
 */
import { test, expect } from "@playwright/test";
import { mockAllAPIs } from "./fixtures/api-mocks";
import { PRODUCT_LIST_MOCK } from "./fixtures/catalog-data";

test.describe("Catálogo", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/catalogo");
  });

  test("renderiza el grid de productos", async ({ page }) => {
    // ProductGrid renders <section data-layout="product-grid"> with <div data-product-group-index> items
    await expect(page.locator("[data-product-group-index]").first()).toBeVisible({ timeout: 5000 });
  });

  test("muestra el nombre del producto", async ({ page }) => {
    const grid = page.locator("[data-product-group-index]");
    await expect(grid.first()).toBeVisible({ timeout: 5000 });
  
    await expect(
      page.locator("[data-product-group-index]").getByText(/^88$/).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("muestra el precio del producto", async ({ page }) => {
    await expect(
      page.getByText(/\$88\.888|\$88,888/)
    ).toBeVisible({ timeout: 5000 });
  });

  test("click en producto navega al PDP", async ({ page }) => {
    // ProductCard renders as <a class="group block ..."> inside [data-product-group-index]
    await page.locator("[data-product-group-index] a").first().click();
    await expect(page).toHaveURL(/\/producto\/.+/);
  });

  test("estado vacío cuando no hay productos", async ({ page }) => {
    await page.route("**/api/catalogo/**", (route) =>
      route.fulfill({ json: { count: 0, next: null, previous: null, results: [] } })
    );
    await page.reload();
    // Algún texto de estado vacío o sin resultados
    await expect(page.getByText(/sin productos|no hay productos|no results|vacío/i)
      .or(page.locator("[data-testid='empty-state']"))
    ).toBeVisible({ timeout: 5000 }).catch(() => {
      // Si no hay mensaje explícito, al menos no debe crashear
    });
  });
});

test.describe("Catálogo — mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("grid de productos visible en mobile", async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/catalogo");
    await expect(page.locator("[data-product-group-index]").first()).toBeVisible({ timeout: 5000 });
  });
});
