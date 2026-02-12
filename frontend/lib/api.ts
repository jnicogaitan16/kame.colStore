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

// Base URL for API calls.
// Default: "/api" (same-origin) so Next rewrites can proxy to Django without CORS.
// If you explicitly set NEXT_PUBLIC_API_URL, it will be used.
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "");

// Server-side base for Django (no CORS; avoids proxy/rewrite redirect loops).
// NOTE: DJANGO_API_BASE is defined in frontend/.env.local but is NOT exposed to the browser
// because it does not start with NEXT_PUBLIC_.
const DJANGO_BASE = (process.env.DJANGO_API_BASE || "").replace(/\/$/, "");
const SERVER_API_BASE = DJANGO_BASE ? `${DJANGO_BASE}/api` : "";

// Fallback for environments where you still want to hit Next's own origin (rare).
const SERVER_ORIGIN = (process.env.APP_ORIGIN || "").replace(/\/$/, "");
const DEFAULT_SERVER_ORIGIN = `http://localhost:${process.env.PORT || 3000}`;

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  let url = path.startsWith("http") ? path : `${API_BASE}${normalizedPath}`;

  // If we're running on the server and the URL is relative (starts with "/"),
  // make it absolute so Node fetch can parse it.
  if (typeof window === "undefined" && url.startsWith("/")) {
    // Prefer calling Django directly during SSR to avoid proxy/rewrite issues.
    if (SERVER_API_BASE && url.startsWith("/api")) {
      url = `${SERVER_API_BASE}${url.slice("/api".length)}`;
    } else {
      const origin = SERVER_ORIGIN || DEFAULT_SERVER_ORIGIN;
      url = `${origin}${url}`;
    }
  }

  const res = await fetch(url, {
    ...options,
    // Avoid Next data cache for dynamic content (catalog/checkout)
    cache: options.cache ?? "no-store",
    // (@ts-expect-error: next is supported in Next.js runtime)
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

  // Soporta respuestas paginadas y no paginadas
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
  const data = await apiFetch<HomepageBanner[]>("/homepage-banners/");
  return data;
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
  // Backend contract: POST /api/orders/stock-validate/ { items: [{ product_variant_id, quantity }] }
  const payload = { items: items || [] };

  // Backend typically returns: { ok: boolean, items: [{ product_variant_id, requested, available, is_active, ok, reason }] }
  const raw = await apiFetch<any>("/stock-validate/", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  type StockValidateRow = NonNullable<StockValidateResponse["items"]>[number];

  const rows: StockValidateRow[] = Array.isArray(raw?.items) ? raw.items : [];

  const warningsByVariantId: StockValidateResponse["warningsByVariantId"] = {};

  for (const row of rows) {
    const variantId = row?.product_variant_id;

    // Skip null/undefined ids (but keep them in `items` for debugging if needed)
    if (typeof variantId !== "number") continue;

    let status: StockValidateStatus = "error";

    if (row?.ok === true) {
      status = "ok";
    } else if (row?.is_active === false) {
      status = "inactive";
    } else if (row?.reason === "missing") {
      status = "missing";
    } else if (row?.reason === "exceeds_stock") {
      status = "exceeds_stock";
    } else {
      status = "error";
    }

    const available =
      typeof row?.available === "number" ? row.available : 0;

    const message =
      typeof row?.reason === "string" && row.reason
        ? row.reason
        : status === "ok"
          ? ""
          : "error";

    warningsByVariantId[variantId] = { status, available, message };
  }

  // If backend didn't send items, still return a consistent shape
  const ok = typeof raw?.ok === "boolean" ? raw.ok : true;

  return {
    ok,
    warningsByVariantId,
    items: rows.length ? rows : undefined,
  };
}
