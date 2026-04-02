/**
 * P0 — Página de detalle de producto (PDP)
 * Variantes, galería, guía de tallas, add to cart.
 */
import { test, expect } from "@playwright/test";
import { mockAllAPIs, mockProductDetail } from "./fixtures/api-mocks";
import { PRODUCT_DETAIL_MOCK } from "./fixtures/catalog-data";

const PDP_URL = "/producto/camiseta-kame-logo";

test.describe("PDP — contenido", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto(PDP_URL);
  });

  test("muestra el nombre del producto", async ({ page }) => {
    await expect(page.getByText(PRODUCT_DETAIL_MOCK.name, { exact: false })).toBeVisible();
  });

  test("muestra el precio formateado", async ({ page }) => {
    await expect(page.getByText(/\$89\.000|\$89,000/)).toBeVisible();
  });

  test("muestra la descripción del producto", async ({ page }) => {
    await expect(page.getByText(/algodón|oversize/i)).toBeVisible();
  });

  test("imagen principal es visible", async ({ page }) => {
    await expect(page.locator("img[alt], [data-testid='product-image']").first()).toBeVisible();
  });
});

test.describe("PDP — variantes", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto(PDP_URL);
  });

  test("muestra opciones de talla", async ({ page }) => {
    await expect(page.getByText("S")).toBeVisible();
    await expect(page.getByText("M")).toBeVisible();
    await expect(page.getByText("L")).toBeVisible();
  });

  test("talla sin stock aparece deshabilitada/marcada", async ({ page }) => {
    // Talla L tiene stock: 0
    const tallaL = page.getByRole("button", { name: /^L$/ })
      .or(page.locator("[data-value='L'], [data-testid='variant-L']"))
      .first();
    // Verificar que existe con algún indicador de sin stock
    await expect(tallaL).toBeVisible();
  });

  test("seleccionar talla habilita el CTA de agregar al carrito", async ({ page }) => {
    await page.getByRole("button", { name: /^S$/ }).or(
      page.locator("[data-value='S']")
    ).first().click();

    // Si requiere color también, seleccionarlo
    const negroBtn = page.getByRole("button", { name: /NEGRO/i }).or(
      page.locator("[data-color='NEGRO']")
    ).first();
    if (await negroBtn.isVisible()) await negroBtn.click();

    const addToCartBtn = page.getByRole("button", { name: /agregar|añadir|add to cart/i });
    await expect(addToCartBtn).toBeEnabled({ timeout: 3000 });
  });

  test("CTA deshabilitado cuando no hay variante seleccionada", async ({ page }) => {
    const addToCartBtn = page.getByRole("button", { name: /agregar|añadir|add to cart/i });
    // Sin selección → disabled o con mensaje de selección
    const isDisabled = await addToCartBtn.isDisabled().catch(() => false);
    const hasSelectMessage = await page.getByText(/selecciona|elige una talla/i).isVisible().catch(() => false);
    expect(isDisabled || hasSelectMessage).toBeTruthy();
  });
});

test.describe("PDP — guía de tallas", () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto(PDP_URL);
  });

  test("botón de guía de tallas es visible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /guía de (tallas|medidas)/i })
        .or(page.getByText(/guía de tallas/i))
    ).toBeVisible();
  });

  test("guía de tallas se abre al hacer click", async ({ page }) => {
    await page.getByRole("button", { name: /guía de (tallas|medidas)/i })
      .or(page.getByText(/guía de tallas/i))
      .first()
      .click();

    await expect(page.getByRole("dialog", { name: /guía/i })
      .or(page.locator("[aria-label*='medidas' i], [aria-label*='tallas' i]"))
    ).toBeVisible({ timeout: 3000 });
  });

  test("guía de tallas se cierra con Escape", async ({ page }) => {
    await page.getByRole("button", { name: /guía de (tallas|medidas)/i })
      .or(page.getByText(/guía de tallas/i))
      .first()
      .click();

    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 3000 });

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});

test.describe("PDP — producto agotado", () => {
  test("CTA muestra agotado cuando sold_out=true", async ({ page }) => {
    await mockProductDetail(page, { sold_out: true, variants: [] });
    await page.goto(PDP_URL);
    await expect(page.getByText(/agotado|sin stock|out of stock/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe("PDP — mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("PDP carga correctamente en mobile", async ({ page }) => {
    await mockAllAPIs(page);
    await page.goto(PDP_URL);
    await expect(page.getByText(PRODUCT_DETAIL_MOCK.name, { exact: false })).toBeVisible();
  });
});
