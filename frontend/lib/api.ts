/**
 * Cliente API para el catálogo (Django backend).
 *
 * Objetivo del fix:
 * - Centralizar el fetch para evitar cache de Next (imágenes/JSON desactualizados)
 * - Forzar no-store + revalidate:0 en App Router
 */
import type {
  Category,
  PaginatedResponse,
  ProductDetail,
  ProductList,
} from "@/types/catalog";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

/**
 * Fetch centralizado para la API.
 *
 * - cache: "no-store" evita que Next reutilice respuestas antiguas.
 * - next.revalidate=0 refuerza el comportamiento en App Router.
 * - Cache-Control: no-cache es un hint adicional para intermediarios.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;

  const res = await fetch(url, {
    ...options,
    // Defaults (pueden ser sobrescritos si pasas otras opciones explícitas)
    cache: options.cache ?? "no-store",
    // (@ts-expect-error: next is supported in Next.js runtime
    next: (options as any).next ?? { revalidate: 0 },
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
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
