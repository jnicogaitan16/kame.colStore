/**
 * Cliente API para el catálogo (Django backend).
 */
import type {
  Category,
  PaginatedResponse,
  ProductDetail,
  ProductList,
} from "@/types/catalog";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function getCategories(): Promise<Category[]> {
  return fetchApi<Category[]>("/categories/");
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
  return fetchApi<PaginatedResponse<ProductList>>(
    `/products/${qs ? `?${qs}` : ""}`
  );
}

export async function getProductBySlug(slug: string): Promise<ProductDetail> {
  return fetchApi<ProductDetail>(`/products/${encodeURIComponent(slug)}/`);
}
