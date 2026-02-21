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
  HomepagePromo,
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
  | "insufficient"
  | "missing"
  | "inactive"
  | "error"
  // Tolerant: backend may add new statuses without breaking the frontend build.
  | (string & {});

export type StockValidateItem = {
  product_variant_id: number;
  quantity: number;
};

export type StockWarning = {
  status: StockValidateStatus;
  available: number;
  requested: number;
  message: string;
};

export type StockHintKind = "last_unit";

export type StockHint = {
  kind: StockHintKind;
  message: string;
};

export type StockValidateRow = {
  product_variant_id: number | null;
  requested: number;
  available: number;
  is_active: boolean;
  ok: boolean;
  reason: string | null;
};

export type StockValidateResponse = {
  ok: boolean;
  // IMPORTANT: keys are ALWAYS strings to match JSON behavior and avoid number/string ambiguity.
  warningsByVariantId: Record<string, StockWarning>;
  // Non-blocking informational hints (e.g. last unit). Never used as blocking warnings.
  hintsByVariantId: Record<string, StockHint>;
  items?: StockValidateRow[];
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

const getCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.split("=").slice(1).join("="));
};

const isUnsafeMethod = (method?: string) => {
  const m = (method || "GET").toUpperCase();
  return !(m === "GET" || m === "HEAD" || m === "OPTIONS" || m === "TRACE");
};

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  let url = path.startsWith("http") ? path : `${API_BASE}${normalizedPath}`;

  // Server-side (Next) can call Django directly to avoid depending on any public origin.
  // In the browser we always stay same-origin via /api/* (tunnel-safe).
  if (typeof window === "undefined" && url.startsWith("/")) {
    if (SERVER_API_BASE && url.startsWith("/api")) {
      url = `${SERVER_API_BASE}${url.slice("/api".length)}`;
    }
    // IMPORTANT: do NOT prepend an origin (APP_ORIGIN). Relative URLs must stay relative.
  }

  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || undefined);

  // Ensure JSON content-type when body exists (do not override if caller set it)
  if (options.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // CSRF header for unsafe methods (client-side only)
  if (typeof window !== "undefined" && isUnsafeMethod(method)) {
    const csrf = getCookie("csrftoken");
    if (csrf && !headers.has("X-CSRFToken")) {
      headers.set("X-CSRFToken", csrf);
    }
  }

  const cacheOpt = options.cache ?? "no-store";

  // IMPORTANT: Do not mix `cache: "no-store"` with `next.revalidate`.
  // If caller wants ISR-style revalidate, they must provide a non-"no-store" cache option.
  const nextOpt =
    cacheOpt === "no-store" ? undefined : (options as any).next;

  const res = await fetch(url, {
    ...options,
    method,
    credentials: "include",
    cache: cacheOpt,
    ...(nextOpt ? { next: nextOpt } : {}),
    headers,
  });

  if (!res.ok) {
    let payload: any = null;
    try {
      payload = await res.json();
    } catch {
      // ignore
    }

    let text = "";
    if (payload == null) {
      try {
        text = await res.text();
      } catch {
        // ignore
      }
    }

    const err: any = new Error(
      `API ${res.status}: ${text || res.statusText || "Request failed"}`
    );
    err.status = res.status;
    err.payload = payload;
    throw err;
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


export async function getCatalogo(params?: {
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

  const url = `/catalogo/${qs ? `?${qs}` : ""}`;

  return apiFetch<PaginatedResponse<ProductList>>(url);
}

function normalizeProductDetail(raw: any): ProductDetail {
  // Defensive normalization: ensure runtime types are stable even if backend returns strings.
  const soldRaw = raw?.sold_out;
  const stockRaw = raw?.stock_total;

  const sold_out =
    typeof soldRaw === "boolean"
      ? soldRaw
      : typeof soldRaw === "string"
        ? soldRaw.toLowerCase() === "true"
        : false;

  const stock_total =
    typeof stockRaw === "number"
      ? stockRaw
      : typeof stockRaw === "string"
        ? Number(stockRaw)
        : 0;

  return {
    ...(raw || {}),
    sold_out,
    stock_total: Number.isFinite(stock_total) ? stock_total : 0,
  } as ProductDetail;
}


export async function getProductBySlug(slug: string): Promise<ProductDetail> {
  const raw = await apiFetch<any>(`/products/${encodeURIComponent(slug)}/`);
  return normalizeProductDetail(raw);
}

export async function getHomepageBanners(): Promise<HomepageBanner[]> {
  return apiFetch<HomepageBanner[]>("/homepage-banners/");
}

export async function getHomepagePromos(
  placement?: "TOP" | "MID"
): Promise<HomepagePromo[]> {
  const qs = placement ? `?placement=${encodeURIComponent(placement)}` : "";
  return apiFetch<HomepagePromo[]>(`/homepage-promos/${qs}`);
}

export async function getHomepageStory(): Promise<HomepageStory | null> {
  try {
    return await apiFetch<HomepageStory>("/homepage-story/");
  } catch {
    return null;
  }
}

export async function validateCartStock(
  items: StockValidateItem[],
  opts?: { signal?: AbortSignal }
): Promise<StockValidateResponse> {
  const payload: { items: StockValidateItem[] } = { items: items || [] };

  type RawStockValidate = {
    ok?: unknown;
    items?: unknown;
    warningsByVariantId?: unknown;
    hintsByVariantId?: unknown;
  };

  const raw = await apiFetch<RawStockValidate>("/stock-validate/", {
    method: "POST",
    body: JSON.stringify(payload),
    signal: opts?.signal,
  });

  const rows: StockValidateRow[] = Array.isArray(raw?.items)
    ? (raw.items as StockValidateRow[])
    : [];

  // Backend is the source of truth. Pass-through maps as-is (keys remain strings).
  const warningsByVariantId =
    raw?.warningsByVariantId && typeof raw.warningsByVariantId === "object"
      ? (raw.warningsByVariantId as Record<string, StockWarning>)
      : {};

  const hintsByVariantId =
    raw?.hintsByVariantId && typeof raw.hintsByVariantId === "object"
      ? (raw.hintsByVariantId as Record<string, StockHint>)
      : {};

  // Do NOT invent ok=true. Default safe if backend sends something unexpected.
  const ok = raw?.ok === true;

  return {
    ok,
    warningsByVariantId,
    hintsByVariantId,
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
