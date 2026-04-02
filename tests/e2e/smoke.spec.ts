/**
 * P0 — Smoke tests
 * Validan que la app levanta y las rutas principales responden.
 * Son los primeros en correr. Si fallan, el resto no tiene sentido.
 */
import { test, expect } from "@playwright/test";
import { mockAllAPIs } from "./fixtures/api-mocks";

test.describe("Smoke", () => {
  test("homepage responde 200", async ({ page }) => {
    await mockAllAPIs(page);
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
  });

  test("/health responde 200", async ({ page }) => {
    const response = await page.goto("/health");
    expect(response?.status()).toBe(200);
  });

  test("catálogo responde 200", async ({ page }) => {
    await mockAllAPIs(page);
    const response = await page.goto("/catalogo");
    expect(response?.status()).toBe(200);
  });

  test("página de producto responde 200", async ({ page }) => {
    await mockAllAPIs(page);
    const response = await page.goto("/producto/camiseta-kame-logo");
    expect(response?.status()).toBe(200);
  });

  test("checkout responde 200", async ({ page }) => {
    await mockAllAPIs(page);
    const response = await page.goto("/checkout");
    expect(response?.status()).toBe(200);
  });

  test("página legal responde 200", async ({ page }) => {
    const response = await page.goto("/legal/politica-de-privacidad");
    expect(response?.status()).toBe(200);
  });

  test("ruta inexistente devuelve 404", async ({ page }) => {
    const response = await page.goto("/ruta-que-no-existe-xyzabc");
    expect(response?.status()).toBe(404);
  });
});
