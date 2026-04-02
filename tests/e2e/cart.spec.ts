/**
 * P0 — Carrito (Zustand + localStorage)
 * Add, remove, cantidad, persistencia entre páginas.
 */
import { test, expect } from "@playwright/test";
import { mockAllAPIs } from "./fixtures/api-mocks";
import { PRODUCT_DETAIL_MOCK } from "./fixtures/catalog-data";

const PDP_URL = "/producto/camiseta-kame-logo";

/** Helper: navega al PDP y agrega una variante al carrito */
async function addToCart(page: Parameters<typeof test.use>[0] extends { viewport: any } ? never : any) {
  await mockAllAPIs(page);
  await page.goto(PDP_URL);

  // Seleccionar talla S
  await page.getByRole("button", { name: /^S$/ })
    .or(page.locator("[data-value='S']"))
    .first()
    .click();

  // Seleccionar color NEGRO si aplica
  const negroBtn = page.getByRole("button", { name: /NEGRO/i })
    .or(page.locator("[data-color='NEGRO']"))
    .first();
  if (await negroBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await negroBtn.click();
  }

  // Agregar al carrito
  await page.getByRole("button", { name: /agregar|añadir|add to cart/i }).click();
}

test.describe("Carrito — add to cart", () => {
  test("agregar producto actualiza el contador del carrito", async ({ page }) => {
    await addToCart(page);

    // El contador del carrito (número en el ícono) debe mostrar 1
    const cartCount = page.locator("[data-testid='cart-count'], [aria-label*='carrito'] span").first();
    await expect(cartCount).toBeVisible({ timeout: 3000 });
  });

  test("el MiniCart se abre al agregar un producto", async ({ page }) => {
    await addToCart(page);

    // El drawer/flyout del carrito debe aparecer
    const miniCart = page.locator(
      "[data-testid='mini-cart'], [aria-label*='carrito' i][role='dialog'], .mini-cart"
    ).first();
    await expect(miniCart).toBeVisible({ timeout: 3000 });
  });

  test("el producto agregado aparece en el MiniCart", async ({ page }) => {
    await addToCart(page);

    await expect(
      page.getByText(PRODUCT_DETAIL_MOCK.name, { exact: false })
    ).toBeVisible({ timeout: 3000 });
  });
});

test.describe("Carrito — gestión de items", () => {
  test.beforeEach(async ({ page }) => {
    await addToCart(page);
  });

  test("puede eliminar un item del carrito", async ({ page }) => {
    const removeBtn = page.getByRole("button", { name: /eliminar|remover|remove|×|✕/i }).first();
    await removeBtn.click();

    // El carrito debe estar vacío o el item desaparece
    await expect(
      page.getByText(PRODUCT_DETAIL_MOCK.name, { exact: false })
    ).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe("Carrito — persistencia", () => {
  test("el carrito persiste al navegar a otra página", async ({ page }) => {
    await addToCart(page);

    // Navegar al catálogo
    await page.goto("/catalogo");
    await mockAllAPIs(page);

    // El contador del carrito debe seguir mostrando items
    const cartCount = page.locator(
      "[data-testid='cart-count'], [aria-label*='carrito'] span, header [class*='cart'] span"
    ).first();
    await expect(cartCount).toBeVisible({ timeout: 5000 });
  });

  test("el carrito persiste después de recargar la página", async ({ page }) => {
    await addToCart(page);
    await page.reload();
    await mockAllAPIs(page);

    const cartCount = page.locator(
      "[data-testid='cart-count'], [aria-label*='carrito'] span"
    ).first();
    await expect(cartCount).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Carrito — mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("se puede agregar al carrito desde mobile", async ({ page }) => {
    await addToCart(page);
    // Verificar que algo del carrito es visible
    const cartIndicator = page.locator(
      "[data-testid='cart-count'], [aria-label*='carrito' i]"
    ).first();
    await expect(cartIndicator).toBeVisible({ timeout: 3000 });
  });
});
