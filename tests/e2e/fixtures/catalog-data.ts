/**
 * Fixtures realistas basados en la estructura real de la API de kame.col.
 * Deben reflejar el shape que devuelven los serializers de Django.
 */

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
  count: 2,
  next: null,
  previous: null,
  results: [
    {
      id: 1,
      name: "88",
      slug: "88",
      price: "89000.00",
      primary_card_url: "https://kamecol.com/media/products/camiseta-logo-thumb.jpg",
      primary_thumb_url: "https://kamecol.com/media/products/camiseta-logo-thumb.jpg",
      primary_image: "https://kamecol.com/media/products/camiseta-logo.jpg",
      category: { id: 1, name: "Camisetas", slug: "camisetas", variant_schema: "size_color" },
      sold_out: false,
    },
    {
      id: 2,
      name: "Hoodie Oversize",
      slug: "hoodie-oversize",
      price: "149000.00",
      primary_card_url: "https://kamecol.com/media/products/hoodie-thumb.jpg",
      primary_thumb_url: "https://kamecol.com/media/products/hoodie-thumb.jpg",
      primary_image: "https://kamecol.com/media/products/hoodie.jpg",
      category: { id: 2, name: "Hoodies", slug: "hoodies", variant_schema: "size_color" },
      sold_out: false,
    },
  ],
};

export const PRODUCT_DETAIL_MOCK = {
  id: 1,
  name: "88",
  slug: "88",
  price: "89000.00",
  description: "Camiseta 100% algodón con logo bordado. Corte oversize.",
  primary_image: "https://kamecol.com/media/products/camiseta-logo.jpg",
  primary_thumb_url: "https://kamecol.com/media/products/camiseta-logo-thumb.jpg",
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
    {
      id: 101,
      value: "S",
      color: "NEGRO",
      is_active: true,
      stock: 5,
      price: "89000.00",
    },
    {
      id: 102,
      value: "M",
      color: "NEGRO",
      is_active: true,
      stock: 3,
      price: "89000.00",
    },
    {
      id: 103,
      value: "L",
      color: "NEGRO",
      is_active: true,
      stock: 0,
      price: "89000.00",
    },
    {
      id: 104,
      value: "S",
      color: "BLANCO",
      is_active: true,
      stock: 2,
      price: "89000.00",
    },
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
    "101": { status: "low_stock", requested: 1, available: 3, message: "Últimas unidades disponibles" },
  },
  hintsByVariantId: {},
};

export const CHECKOUT_SUCCESS_MOCK = {
  ok: true,
  order_id: 999,
  order_number: "ORD-999",
  total: "99000.00",
};
