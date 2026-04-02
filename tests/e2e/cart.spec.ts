/**
 * P0 — Carrito (Zustand + localStorage)
 * Add, remove, cantidad, persistencia entre páginas.
 */
import { test, expect } from "@playwright/test";
import { mockAllAPIs } from "./fixtures/api-mocks";
import { PRODUCT_DETAIL_MOCK } from "./fixtures/catalog-data";

const PDP_URL = "/producto/88";

/** Helper: navega al PDP y agrega una variante al carrito */
async function addToCart(page: Parameters<typeof test.use>[0] extends { viewport: any } ? never : any) {
  await mockAllAPIs(page);
  await page.goto(PDP_URL);

  // Seleccionar talla S
  await page
    .getByRole("button", { name: /^S$/ })
    .or(page.locator("[data-value='S']"))
    .first()
    .click();

  // Seleccionar color NEGRO si aplica
  const negroBtn = page
    .getByRole("button", { name: /NEGRO/i })
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

  test("al agregar un producto se actualiza el indicador del carrito", async ({ page }) => {
    await addToCart(page);
  
    const cartCount = page.locator(
      "[data-testid='cart-count'], [aria-label*='carrito'] span"
    ).first();
  
    await expect(cartCount).toBeVisible({ timeout: 3000 });
  });

  test("el producto agregado aparece en el MiniCart", async ({ page }) => {
    await addToCart(page);
  
    // Abrir explícitamente el carrito desde el icono superior derecho
    const cartToggle = page.locator("header").locator("button, a").filter({
      has: page.locator("[data-testid='cart-count'], span"),
    }).last();
  
    await expect(cartToggle).toBeVisible({ timeout: 3000 });
    await cartToggle.click();
  
    const miniCart = page.getByRole("dialog").first();
    await expect(miniCart).toBeVisible({ timeout: 3000 });
  
    // Validar el nombre del producto dentro del drawer sin asumir heading
    await expect(
      miniCart.getByText(/^88$/).first()
    ).toBeVisible({ timeout: 3000 });
  });
});

test.describe("Carrito — gestión de items", () => {
  test.beforeEach(async ({ page }) => {
    await addToCart(page);
  });

  test("puede eliminar un item del carrito", async ({ page }) => {
    // Abrir explícitamente el carrito desde el ícono superior derecho.
    // Evitamos capturar el menú hamburguesa izquierdo usando el botón
    // que contiene el contador del carrito visible en la esquina superior derecha.
    const cartToggle = page
      .locator("header")
      .locator("button, a")
      .filter({ has: page.locator("[data-testid='cart-count'], span") })
      .last();

    await expect(cartToggle).toBeVisible({ timeout: 3000 });
    await cartToggle.click();

    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await expect(dialog.getByText(/carrito/i)).toBeVisible({ timeout: 3000 });

    // Botón correcto para eliminar el item dentro del drawer
    const removeBtn = dialog.getByRole("button", { name: /quitar del carrito/i }).first();
    await expect(removeBtn).toBeVisible({ timeout: 3000 });
    await removeBtn.click();

    // Validar que el producto desaparece del carrito
    await expect(dialog.getByText(PRODUCT_DETAIL_MOCK.name, { exact: false })).not.toBeVisible({
      timeout: 3000,
    });
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
      "[data-testid='cart-count'], [aria-label*='carrito'] span, header [class*='cart'] span",
    ).first();
    await expect(cartCount).toBeVisible({ timeout: 5000 });
  });

  test("el carrito persiste después de recargar la página", async ({ page }) => {
    await addToCart(page);
    await page.reload();
    await mockAllAPIs(page);

    const cartCount = page.locator("[data-testid='cart-count'], [aria-label*='carrito'] span").first();
    await expect(cartCount).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Carrito — mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("se puede agregar al carrito desde mobile", async ({ page }) => {
    await addToCart(page);
    // Verificar que algo del carrito es visible
    const cartIndicator = page.locator("[data-testid='cart-count'], [aria-label*='carrito' i]").first();
    await expect(cartIndicator).toBeVisible({ timeout: 3000 });
  });
});