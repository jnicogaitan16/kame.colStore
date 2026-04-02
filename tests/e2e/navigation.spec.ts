/**
 * P1 — Navegación
 * Menú desktop/mobile, routing por departamento/categoría.
 */
import { test, expect } from "@playwright/test";
import { mockAllAPIs } from "./fixtures/api-mocks";
import { TEST_NAVIGATION } from "./fixtures/catalog-data";

test.describe("Navegación — header", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/");
  });

  test("header es visible", async ({ page }) => {
    // The site header has role="banner" — avoids strict mode with content <header> elements
    await expect(page.getByRole("banner")).toBeVisible();
  });

  test("logo navega al home", async ({ page }) => {
    await page.locator("header a[href='/']").first().click();
    await expect(page).toHaveURL("/");
  });

  test("botón de menú es visible", async ({ page }) => {
    // Desktop nav is hidden (showDesktopTabs=false); navigation via mobile menu button
    await expect(
      page.locator("[data-testid='mobile-menu-button'], [aria-label='Abrir menú']").first()
    ).toBeVisible({ timeout: 3000 });
  });
});

test.describe("Navegación — mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto("/");
  });

  test("menú mobile se abre con departamentos", async ({ page }) => {
    // Abre el menú hamburguesa
    const menuButton = page.getByRole("button", { name: /menú|menu|abrir/i }).first();
    await menuButton.click();

    // Drawer visible
    const mobileMenu = page.locator("[data-testid='mobile-menu'], [role='dialog']").first();
    await expect(mobileMenu).toBeVisible({ timeout: 3000 });

    // Primer nivel: departamentos (from TEST_NAVIGATION)
    await expect(mobileMenu.getByText(new RegExp(TEST_NAVIGATION.department1, "i"))).toBeVisible({ timeout: 3000 });
    await expect(mobileMenu.getByText(new RegExp(TEST_NAVIGATION.department2, "i"))).toBeVisible({ timeout: 3000 });

    // Accesorios puede existir según datos de dev/admin
    const accesorios = mobileMenu.getByText(/accesorios/i);
    if (await accesorios.count()) {
      await expect(accesorios).toBeVisible({ timeout: 3000 });
    }

    // Cierra con Escape
    await page.keyboard.press("Escape");
  });

  test("icono de carrito es visible en mobile", async ({ page }) => {
    const cartButton = page.getByRole("button", { name: /carrito|cart/i }).first();
    await expect(cartButton).toBeVisible();
  });
});

test.describe("Routing", () => {
  test("navegar a una categoría abre la página de categoría", async ({ page }) => {
    await mockAllAPIs(page);
    const categoryUrl = `/categoria/${TEST_NAVIGATION.firstCategorySlug}`;
    // Navigate directly to a category URL — tests routing without UI dependency
    await page.goto(categoryUrl);
    await expect(page).toHaveURL(new RegExp(`/categoria/${TEST_NAVIGATION.firstCategorySlug}`));
    // Page should load (not 404 or error)
    const res = await page.goto(categoryUrl);
    expect(res?.status()).toBe(200);
  });
});
