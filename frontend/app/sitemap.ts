import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.kamecol.com";
const API_BASE = process.env.DJANGO_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type ApiProduct = { slug: string; updated_at?: string };
type ApiCategory = { slug: string };

async function fetchProducts(): Promise<ApiProduct[]> {
  try {
    const res = await fetch(`${API_BASE}/api/products/?page_size=200`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function fetchCategories(): Promise<ApiCategory[]> {
  try {
    const res = await fetch(`${API_BASE}/api/categories/`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    fetchProducts(),
    fetchCategories(),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/catalogo`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/legal/politica-de-privacidad`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const categoryPages: MetadataRoute.Sitemap = categories
    .filter((c) => c.slug)
    .map((c) => ({
      url: `${SITE_URL}/categoria/${encodeURIComponent(c.slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  const productPages: MetadataRoute.Sitemap = products
    .filter((p) => p.slug)
    .map((p) => ({
      url: `${SITE_URL}/producto/${encodeURIComponent(p.slug)}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  return [...staticPages, ...categoryPages, ...productPages];
}
