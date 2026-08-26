import { test, expect } from "@playwright/test";

/**
 * E2E Tests: Discount system — validates discount display across storefront.
 *
 * These tests run against the REAL backend (not mock) because discount rules
 * live in the database. They require:
 * - Django backend running with active DiscountRule entries
 * - Next.js frontend running
 *
 * Discount rules expected (created via Django admin, valid until 2028):
 * - "E2E Test: 50% producto testing-agosto" → product scope, 50%
 * - "E2E Test: 10% departamento Mujer"      → department scope, 10%
 * - "E2E Test: 15% categoría T-shirts"      → category scope, 15%
 */

const DJANGO_API = process.env.DJANGO_API_BASE || "http://localhost:8000";

test.describe("Discount API validation", () => {
  test("product-level discount: 50% on testing-agosto", async ({ request }) => {
    const res = await request.get(`${DJANGO_API}/api/products/testing-agosto/`);
    expect(res.ok()).toBeTruthy();

    const product = await res.json();
    expect(product.price).toBeDefined();
    expect(product.discount).toBeTruthy();
    expect(product.discount.has_discount).toBe(true);

    const originalPrice = parseFloat(product.price);
    const discountPercentage = product.discount.discount_percentage;
    const discountPrice = product.discount.discount_price;
    const expectedPrice = Math.floor(originalPrice * (1 - discountPercentage / 100));

    expect(discountPercentage).toBe(50);
    expect(discountPrice).toBe(expectedPrice);
    expect(product.discount.compare_at_price).toBe(Math.floor(originalPrice));
    expect(product.discount.discount_label).toBe("-50%");
  });

  test("department-level discount: 10% on Mujer products", async ({ request }) => {
    const res = await request.get(`${DJANGO_API}/api/products/esqueleto-chica/`);
    expect(res.ok()).toBeTruthy();

    const product = await res.json();
    expect(product.discount).toBeTruthy();
    expect(product.discount.has_discount).toBe(true);

    const originalPrice = parseFloat(product.price);
    const discountPercentage = product.discount.discount_percentage;
    const discountPrice = product.discount.discount_price;
    const expectedPrice = Math.floor(originalPrice * (1 - discountPercentage / 100));

    expect(discountPercentage).toBe(10);
    expect(discountPrice).toBe(expectedPrice);
    expect(product.discount.compare_at_price).toBe(Math.floor(originalPrice));
  });

  test("product discount overrides category discount (priority)", async ({ request }) => {
    // testing-agosto is in category T-shirts (15%) but has product rule (50%)
    // Product scope should win
    const res = await request.get(`${DJANGO_API}/api/products/testing-agosto/`);
    expect(res.ok()).toBeTruthy();

    const product = await res.json();
    expect(product.discount.discount_percentage).toBe(50);
    // NOT 15% from category
  });
});
