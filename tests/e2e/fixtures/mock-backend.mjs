/**
 * Minimal mock Django backend for Playwright E2E tests.
 * Serves fixture data so Next.js server-side fetches work without a real backend.
 * Started automatically by playwright.config.ts via webServer[].
 *
 * Run: node tests/e2e/fixtures/mock-backend.mjs
 */

import { createServer } from "http";

const PORT = process.env.MOCK_BACKEND_PORT || 3001;

// ─── Fixtures ────────────────────────────────────────────────────────────────

const NAVIGATION = {
  departments: [
    {
      id: 1,
      name: "Mujer",
      slug: "mujer",
      sort_order: 1,
      categories: [
        { id: 1, name: "Camisetas", slug: "camisetas", sort_order: 1 },
        { id: 2, name: "Hoodies", slug: "hoodies", sort_order: 2 },
      ],
    },
    {
      id: 2,
      name: "Hombre",
      slug: "hombre",
      sort_order: 2,
      categories: [
        { id: 3, name: "Camisetas", slug: "camisetas-hombre", sort_order: 1 },
      ],
    },
  ],
};

// Product 88 — jean_size schema (size only, no color) used by product.spec.ts + cart.spec.ts
// Defined before PRODUCT_LIST so it can be referenced directly.
const PRODUCT_88 = {
  id: 88,
  name: "88",
  slug: "88",
  price: "88888.00",
  description: "Camiseta 100% algodón con diseño exclusivo. Corte oversize.",
  primary_image: "https://kamecol.com/media/products/p88.jpg",
  primary_thumb_url: "https://kamecol.com/media/products/p88-thumb.jpg",
  primary_card_url: "https://kamecol.com/media/products/p88.jpg",
  category: {
    id: 1,
    name: "Camisetas",
    slug: "camisetas",
    variant_schema: "jean_size",
    size_guide: {
      title: "Guía de tallas",
      columns: ["Talla", "Pecho (cm)", "Largo (cm)"],
      rows: [
        { size: "S", values: [88, 68] },
        { size: "M", values: [92, 70] },
        { size: "L", values: [96, 72] },
      ],
    },
  },
  variants: [
    { id: 881, value: "S", color: "", is_active: true, stock: 5, price: "88888.00" },
    { id: 882, value: "M", color: "", is_active: true, stock: 3, price: "88888.00" },
    { id: 883, value: "L", color: "", is_active: true, stock: 0, price: "88888.00" },
  ],
  sold_out: false,
};

const PRODUCT_LIST = {
  count: 1,
  next: null,
  previous: null,
  results: [PRODUCT_88],
};

// Generic product detail fallback — served for any slug not matched by a specific fixture.
const PRODUCT_DETAIL = {
  id: 1,
  name: "Camiseta Kame Logo",
  slug: "camiseta-kame-logo",
  price: "89000.00",
  description: "Camiseta 100% algodón con logo bordado. Corte oversize.",
  primary_image: null,
  primary_thumb_url: null,
  category: {
    id: 1,
    name: "Camisetas",
    slug: "camisetas",
    variant_schema: "size_color",
    size_guide: {
      title: "Guía de tallas",
      columns: ["Talla", "Pecho (cm)", "Largo (cm)"],
      rows: [
        { size: "S", values: [88, 68] },
        { size: "M", values: [92, 70] },
        { size: "L", values: [96, 72] },
        { size: "XL", values: [100, 74] },
      ],
    },
  },
  variants: [
    { id: 101, value: "S", color: "NEGRO", is_active: true, stock: 5, price: "89000.00" },
    { id: 102, value: "M", color: "NEGRO", is_active: true, stock: 3, price: "89000.00" },
    { id: 103, value: "L", color: "NEGRO", is_active: true, stock: 0, price: "89000.00" },
    { id: 104, value: "S", color: "BLANCO", is_active: true, stock: 2, price: "89000.00" },
  ],
  sold_out: false,
};

const CITIES = {
  cities: [
    { code: "BOG", label: "Bogotá D.C." },
    { code: "MED", label: "Medellín" },
    { code: "CAL", label: "Cali" },
    { code: "BAQ", label: "Barranquilla" },
  ],
};

const SHIPPING_QUOTE = { amount: 10000, label: "Envío estándar" };

// Product 99 — no_variant schema with stock_total:0, shows "Agotado" text automatically
const PRODUCT_99_SOLD_OUT = {
  id: 99,
  name: "Producto Agotado",
  slug: "99",
  price: "89000.00",
  description: "Producto de prueba agotado.",
  primary_image: null,
  primary_thumb_url: null,
  stock_total: 0,
  category: {
    id: 1,
    name: "Camisetas",
    slug: "camisetas",
    variant_schema: "no_variant",
    size_guide: null,
  },
  variants: [
    { id: 991, value: "", color: "", is_active: false, stock: 0, price: "89000.00" },
  ],
  sold_out: true,
};

const STOCK_VALIDATE_OK = { ok: true, warningsByVariantId: {}, hintsByVariantId: {} };

const CHECKOUT_SUCCESS = { ok: true, order_id: 999, order_number: "ORD-999", total: "99000.00" };

const EMPTY_LIST = { count: 0, next: null, previous: null, results: [] };

const HOMEPAGE_BANNERS = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      id: 1,
      title: "Nueva colección",
      subtitle: "Descubre lo nuevo de Kame.Col",
      image: null,
      cta_label: "Ver catálogo",
      cta_url: "/catalogo",
      show_text: true,
      sort_order: 1,
      is_active: true,
    },
  ],
};

// ─── Router ──────────────────────────────────────────────────────────────────

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

const server = createServer(async (req, res) => {
  // Strip query string and trailing slash for matching
  const pathname = (req.url || "/").split("?")[0].replace(/\/$/, "") || "/";
  const method = req.method || "GET";

  // OPTIONS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "*" });
    res.end();
    return;
  }

  // Navigation
  if (pathname === "/api/navigation") return json(res, NAVIGATION);

  // Product list / catalog
  if (pathname === "/api/catalogo" || pathname === "/api/products") return json(res, PRODUCT_LIST);

  // Homepage endpoints
  if (pathname === "/api/homepage-banners") return json(res, HOMEPAGE_BANNERS);
  if (
    pathname === "/api/homepage-promos" ||
    pathname === "/api/homepage-story" ||
    pathname === "/api/homepage-marquee-products"
  ) {
    return json(res, EMPTY_LIST);
  }

  // Product detail: specific fixtures must come before generic regex
  if (pathname === `/api/products/${PRODUCT_88.id}`) return json(res, PRODUCT_88);
  if (pathname === `/api/products/${PRODUCT_99_SOLD_OUT.id}`) return json(res, PRODUCT_99_SOLD_OUT);

  // Product detail: /api/products/:slug (generic fallback)
  if (/^\/api\/products\/[^/]+$/.test(pathname)) return json(res, PRODUCT_DETAIL);

  // Cities
  if (pathname === "/api/cities") return json(res, CITIES);

  // Shipping quote
  if (pathname === "/api/shipping-quote") return json(res, SHIPPING_QUOTE);

  // Stock validate
  if (pathname === "/api/stock-validate") return json(res, STOCK_VALIDATE_OK);

  // Checkout
  if (pathname === "/api/checkout") return json(res, CHECKOUT_SUCCESS, 201);

  // Health check (used by Playwright to detect when server is ready)
  if (pathname === "/health" || pathname === "") return json(res, { ok: true });

  // Fallback 404
  json(res, { detail: "Not found." }, 404);
});

server.listen(PORT, () => {
  console.log(`[mock-backend] listening on http://localhost:${PORT}`);
});
