import type { Page } from "@playwright/test";
import {
  NAVIGATION_MOCK,
  PRODUCT_LIST_MOCK,
  PRODUCT_DETAIL_MOCK,
  CITIES_MOCK,
  SHIPPING_QUOTE_BOG_MOCK,
  STOCK_VALIDATE_OK_MOCK,
  CHECKOUT_SUCCESS_MOCK,
} from "./catalog-data";

/**
 * Intercepta todas las llamadas a /api/* y las reemplaza con fixtures.
 * Next.js hace fetch server-side, pero también client-side (SWR, fetch en componentes).
 * Playwright intercepta ambas cuando Next.js usa el proxy interno /api/[...path].
 */
export async function mockAllAPIs(page: Page) {
  await mockNavigation(page);
  await mockProductList(page);
  await mockProductDetail(page);
  await mockCities(page);
  await mockShippingQuote(page);
  await mockStockValidate(page);
}

export async function mockNavigation(page: Page) {
  await page.route("**/api/navigation/**", (route) =>
    route.fulfill({ json: NAVIGATION_MOCK })
  );
}

export async function mockProductList(page: Page, overrides = {}) {
  await page.route("**/api/catalogo/**", (route) =>
    route.fulfill({ json: { ...PRODUCT_LIST_MOCK, ...overrides } })
  );
}

export async function mockProductDetail(page: Page, overrides = {}) {
  await page.route("**/api/products/*/", (route) =>
    route.fulfill({ json: { ...PRODUCT_DETAIL_MOCK, ...overrides } })
  );
}

export async function mockCities(page: Page) {
  await page.route("**/api/cities/**", (route) =>
    route.fulfill({ json: CITIES_MOCK })
  );
}

export async function mockShippingQuote(page: Page, overrides = {}) {
  await page.route("**/api/shipping-quote/**", (route) =>
    route.fulfill({ json: { ...SHIPPING_QUOTE_BOG_MOCK, ...overrides } })
  );
}

export async function mockStockValidate(page: Page, overrides = {}) {
  await page.route("**/api/stock-validate/**", (route) =>
    route.fulfill({ json: { ...STOCK_VALIDATE_OK_MOCK, ...overrides } })
  );
}

export async function mockCheckout(page: Page, overrides = {}) {
  await page.route("**/api/checkout/**", (route) =>
    route.fulfill({ status: 201, json: { ...CHECKOUT_SUCCESS_MOCK, ...overrides } })
  );
}

export async function mockCheckoutError(page: Page) {
  await page.route("**/api/checkout/**", (route) =>
    route.fulfill({
      status: 400,
      json: { ok: false, error: "Stock insuficiente para uno o más productos." },
    })
  );
}
