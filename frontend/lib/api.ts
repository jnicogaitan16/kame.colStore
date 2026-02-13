/**
 * Cliente API para el catálogo (Django backend).
 *
 * Objetivo del fix:
 * - Centralizar el fetch para evitar cache de Next (imágenes/JSON desactualizados)
 * - Forzar no-store + revalidate:0 en App Router
 */
import type {
  Category,
  HomepageBanner,
  PaginatedResponse,
  ProductDetail,
  ProductList,
} from "@/types/catalog";

export interface HomepageStory {
  title: string;
  subtitle?: string;
  content: string;
}

export interface StockValidateItemInput {
  product_variant_id: number;
  quantity: number;
}

export type StockValidateStatus =
  | "ok"
  | "exceeds_stock"
  | "missing"
  | "inactive"
  | "error";

export type StockValidateItem = {
  product_variant_id: number;
  quantity: number;
};

export type StockValidateResponse = {
  ok: boolean;
  warningsByVariantId: Record<
    number,
    { status: StockValidateStatus; available: number; message: string }
  >;
  items?: Array<{
    product_variant_id: number | null;
    requested: number;
    available: number;
    is_active: boolean;
    ok: boolean;
    reason: string | null;
  }>;
};

export type CheckoutPayload = {
  items: Array<{
    product_variant_id: number;
    quantity: number;
    unit_price: number;
  }>;
  full_name: string;
  document_type: string;
  cedula: string;
  email?: string;
  phone?: string;
  city_code: string;
  address: string;
  notes?: string;
  payment_method?: string;
};

export type CheckoutResponse = {
  order_id: number;
  payment_reference: string;
  status: string;
  payment_instructions: string;
  whatsapp_link?: string | null;
  subtotal?: number;
  shipping_cost?: number;
  total?: number;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "");

const DJANGO_BASE = (process.env.DJANGO_API_BASE || "").replace(/\/$/, "");
const SERVER_API_BASE = DJANGO_BASE ? `${DJANGO_BASE}/api` : "";

const SERVER_ORIGIN = (process.env.APP_ORIGIN || "").replace(/\/$/, "");
const DEFAULT_SERVER_ORIGIN = `http://localhost:${process.env.PORT || 3000}`;

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  let url = path.startsWith("http") ? path : `${API_BASE}${normalizedPath}`;

  if (typeof window === "undefined" && url.startsWith("/")) {
    if (SERVER_API_BASE && url.startsWith("/api")) {
      url = `${SERVER_API_BASE}${url.slice("/api".length)}`;
    } else {
      const origin = SERVER_ORIGIN || DEFAULT_SERVER_ORIGIN;
      url = `${origin}${url}`;
    }
  }

  const res = await fetch(url, {
    ...options,
    cache: options.cache ?? "no-store",
    // Next.js fetch option (supported in Next runtime)
    next: (options as any).next ?? { revalidate: 0 },
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export async function getCategories(): Promise<Category[]> {
  const data = await apiFetch<any>("/categories/");

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

export async function getProducts(params?: {
  category?: string;
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<PaginatedResponse<ProductList>> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set("category", params.category);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.page_size) searchParams.set("page_size", String(params.page_size));
  const qs = searchParams.toString();

  const url = `/products/${qs ? `?${qs}` : ""}`;

  return apiFetch<PaginatedResponse<ProductList>>(url);
}

export async function getProductBySlug(slug: string): Promise<ProductDetail> {
  return apiFetch<ProductDetail>(`/products/${encodeURIComponent(slug)}/`);
}

export async function getHomepageBanners(): Promise<HomepageBanner[]> {
  return apiFetch<HomepageBanner[]>("/homepage-banners/");
}

export async function getHomepageStory(): Promise<HomepageStory | null> {
  try {
    return await apiFetch<HomepageStory>("/homepage-story/");
  } catch {
    return null;
  }
}

export async function validateCartStock(
  items: StockValidateItem[]
): Promise<StockValidateResponse> {
  const payload = { items: items || [] };

  const raw = await apiFetch<any>("/stock-validate/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const rows = Array.isArray(raw?.items) ? raw.items : [];

  const warningsByVariantId: StockValidateResponse["warningsByVariantId"] = {};

  for (const row of rows) {
    const variantId = row?.product_variant_id;
    if (typeof variantId !== "number") continue;

    let status: StockValidateStatus = "error";

    if (row?.ok === true) status = "ok";
    else if (row?.is_active === false) status = "inactive";
    else if (row?.reason === "missing") status = "missing";
    else if (row?.reason === "exceeds_stock") status = "exceeds_stock";

    const available = typeof row?.available === "number" ? row.available : 0;

    let message = "";
    if (status === "exceeds_stock") message = "Stock insuficiente.";
    else if (status === "missing") message = "Variante no disponible.";
    else if (status === "inactive") message = "Variante inactiva.";
    else if (status === "error") message = "No pudimos validar stock en este momento.";

    warningsByVariantId[variantId] = { status, available, message };
  }

  const ok = typeof raw?.ok === "boolean" ? raw.ok : true;

  return {
    ok,
    warningsByVariantId,
    items: rows.length ? rows : undefined,
  };
}

export async function checkout(payload: CheckoutPayload): Promise<CheckoutResponse> {
  if (!payload.items?.length) {
    throw new Error("Checkout inválido: items vacío");
  }
  // DRF expects nested objects:
  // - customer: { full_name, document_type, document_number, email?, phone? }
  // - shipping_address: { city_code, address, notes? }
  // Keep current CheckoutPayload for the UI and adapt here.

  const apiPayload = {
    items: payload.items,
    customer: {
      full_name: payload.full_name,
      document_type: payload.document_type,
      // Backend expects `document_number` (not `cedula`)
      document_number: payload.cedula,
      email: payload.email || "",
      phone: payload.phone || "",
    },
    shipping_address: {
      city_code: payload.city_code,
      address: payload.address,
      notes: payload.notes || "",
    },
    payment_method: payload.payment_method || "",
  };

  const body = JSON.stringify(apiPayload);

  // POST /api/checkout/ → Django /api/orders/checkout/
  // apiFetch already prefixes /api
  return apiFetch<CheckoutResponse>("/checkout/", {
    method: "POST",
    body,
  });
}
