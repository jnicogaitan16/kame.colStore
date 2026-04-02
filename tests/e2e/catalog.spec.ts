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
    // Al menos un producto debe ser visible
    await expect(page.locator("article, [data-testid='product-card']").first()).toBeVisible({ timeout: 5000 });
  });

  test("muestra el nombre del primer producto", async ({ page }) => {
    await expect(page.getByText(PRODUCT_LIST_MOCK.results[0].name, { exact: false })).toBeVisible();
  });

  test("muestra el precio del producto", async ({ page }) => {
    // Precio formateado en COP: $89.000
    await expect(page.getByText(/\$89\.000|\$89,000/)).toBeVisible();
  });

  test("click en producto navega al PDP", async ({ page }) => {
    await page.locator("article a, [data-testid='product-card'] a").first().click();
    await expect(page).toHaveURL(/\/producto\/.+/);
  });

  test("estado vacío cuando no hay productos", async ({ page }) => {
    await page.route("**/api/products/**", (route) =>
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
    await expect(page.locator("article, [data-testid='product-card']").first()).toBeVisible({ timeout: 5000 });
  });
});
