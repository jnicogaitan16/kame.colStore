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
