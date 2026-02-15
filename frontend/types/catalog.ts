/**
 * Tipos alineados con la API del catálogo (Django DRF).
 */

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface ProductImage {
  id: number;
  image: string | null;
  alt_text: string;
  is_primary: boolean;
  sort_order: number;
}

export interface ProductVariant {
  id: number;
  kind: string;
  kind_display: string;
  value: string | null;
  color: string | null;
  stock: number;
  is_active: boolean;
  images: ProductImage[];
}

export interface ProductList {
  id: number;
  name: string;
  slug: string;
  price: string;
  category: Category;
  primary_image: string | null;
  is_active: boolean;

  // Backend-computed fields (list endpoint)
  stock_total?: number;
  sold_out?: boolean;
}

export interface ProductDetail extends ProductList {
  description: string;
  stock: number;
  created_at: string;
  updated_at: string;
  variants: ProductVariant[];
}

export interface HomepageBanner {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  image: string | null;
  alt_text: string;
  cta_label: string;
  cta_url: string;
  sort_order: number;
}

export interface HomepagePromo {
  id: number;
  title: string;
  subtitle?: string | null;
  image: string | null;
  alt_text?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  sort_order: number;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
