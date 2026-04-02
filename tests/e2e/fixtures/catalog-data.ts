/**
 * Fixtures realistas basados en la estructura real de la API de kame.col.
 * Deben reflejar el shape que devuelven los serializers de Django.
 */

// ─── Single source of truth — test product constants ─────────────────────────

/** Primary test product (jean_size schema, 3 variants S/M/L, L = no stock). */
export const TEST_PRODUCT = {
  id: 88,
  name: "88",
  slug: "88",
  pdpUrl: "/producto/88",
  price: "88888.00",
  pricePattern: /\$88\.888|\$88,888/,
  namePattern: /^88$/,
  descriptionPattern: /algodón|oversize/i,
};

/** Sold-out product (no_variant schema, stock_total 0, auto-shows "Agotado"). */
export const TEST_PRODUCT_SOLD_OUT = {
  id: 99,
  slug: "99",
  pdpUrl: "/producto/99",
} as const;

/**
 * Cart item shape for checkout tests.
 * variantId must match STOCK_VALIDATE_WARNING_MOCK.warningsByVariantId key.
 */
export const TEST_CHECKOUT_CART_ITEM = {
  variantId: 881,
  productId: 88,
  productName: "88",
  productSlug: "88",
  variantLabel: "S",
  price: "88888.00",
  quantity: 1,
  imageUrl: "https://kamecol.com/media/products/p88.jpg",
} as const;

/** Zustand persist payload for checkout localStorage injection. */
export const TEST_CHECKOUT_CART_STATE = {
  state: {
    items: [
      {
        variantId: TEST_CHECKOUT_CART_ITEM.variantId,
        productId: TEST_CHECKOUT_CART_ITEM.productId,
        productName: TEST_CHECKOUT_CART_ITEM.productName,
        productSlug: TEST_CHECKOUT_CART_ITEM.productSlug,
        variantLabel: TEST_CHECKOUT_CART_ITEM.variantLabel,
        price: TEST_CHECKOUT_CART_ITEM.price,
        quantity: TEST_CHECKOUT_CART_ITEM.quantity,
        imageUrl: TEST_CHECKOUT_CART_ITEM.imageUrl,
      },
    ],
    stockWarningsByVariantId: {},
    stockHintsByVariantId: {},
    lastStockValidateRequestId: null,
    stockValidateStatus: "idle",
  },
  version: 0,
};

/** Navigation departments present in the mobile menu. */
export const TEST_NAVIGATION = {
  department1: "Mujer",
  department2: "Hombre",
  firstCategorySlug: "camisetas",
} as const;

/** Shipping quote amounts for test assertions. */
export const TEST_SHIPPING = {
  amount: 10000,
  amountPattern: /\$10\.000|\$10,000/,
  freePattern: /gratis|free/i,
};

// ─── API mock fixtures ────────────────────────────────────────────────────────

export const NAVIGATION_MOCK = {
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

export const PRODUCT_LIST_MOCK = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      id: 88,
      name: "88",
      slug: "88",
      price: "88888.00",
      primary_card_url: "https://kamecol.com/media/products/p88.jpg",
      primary_thumb_url: "https://kamecol.com/media/products/p88-thumb.jpg",
      primary_image: "https://kamecol.com/media/products/p88.jpg",
      category: { id: 1, name: "Camisetas", slug: "camisetas", variant_schema: "jean_size" },
      sold_out: false,
    },
  ],
};

export const PRODUCT_DETAIL_MOCK = {
  id: 88,
  name: "88",
  slug: "88",
  price: "88888.00",
  description: "Camiseta 100% algodón con diseño exclusivo. Corte oversize.",
  primary_image: "https://kamecol.com/media/products/p88.jpg",
  primary_thumb_url: "https://kamecol.com/media/products/p88-thumb.jpg",
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

export const CITIES_MOCK = {
  cities: [
    { code: "BOG", label: "Bogotá D.C." },
    { code: "MED", label: "Medellín" },
    { code: "CAL", label: "Cali" },
    { code: "BAQ", label: "Barranquilla" },
  ],
};

export const SHIPPING_QUOTE_BOG_MOCK = {
  amount: 10000,
  label: "Envío estándar",
};

export const SHIPPING_QUOTE_FREE_MOCK = {
  amount: 0,
  label: "Envío gratis",
};

export const STOCK_VALIDATE_OK_MOCK = {
  ok: true,
  warningsByVariantId: {},
  hintsByVariantId: {},
};

export const STOCK_VALIDATE_WARNING_MOCK = {
  ok: false,
  warningsByVariantId: {
    "881": { status: "low_stock", requested: 1, available: 3, message: "Últimas unidades disponibles" },
  },
  hintsByVariantId: {},
};

export const CHECKOUT_SUCCESS_MOCK = {
  ok: true,
  order_id: 999,
  order_number: "ORD-999",
  total: "99000.00",
};
