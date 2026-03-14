/**
 * Tipos alineados con la API del catálogo (Django DRF).
 *
 * Estructura estándar e-commerce:
 * - Department
 * - Category (tree via parent_id)
 * - Product (list/detail)
 * - ProductVariant (stock real desde InventoryPool)
 *
 * Importante de arquitectura:
 * - `Category` representa taxonomía de catálogo.
 * - `Category` no sustituye el contrato de navegación pública.
 * - Para navegación pública del header/mobile menu debe priorizarse
 *   la estructura `Department -> Category` proveniente de `/navigation/`.
 * - Las listas planas de categorías deben considerarse legacy/fallback.
 */

// =============================
// Taxonomía
// =============================

export interface Department {
  id: number;
  name: string;
  slug: string;
  sort_order?: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;

  // Domain relationship: a category may belong to a department.
  // For public navigation, prefer `/navigation/` over reconstructing menus from flat categories.
  department?: Pick<Department, "id" | "name" | "slug">;
  // Convenience field (optional). Useful for compatibility, but not the preferred menu contract.
  department_slug?: string;

  // Legacy flat fields. Keep for backward compatibility only.
  // They must not become the preferred source for grouped public navigation.
  department_id?: number;
  department_name?: string;

  parent_id: number | null;

  sort_order?: number;
  variant_schema: string; // size_color | jean_size | no_variant | dimension

  is_active: boolean;
}

// =============================
// Producto (List)
// =============================

export interface Product {
  id: number;
  name: string;
  slug: string;
  price: string;

  stock_total: number; // derivado desde InventoryPool (max por variantes)
  sold_out: boolean;   // boolean real

  category: Category;

  primary_image: string | null;
  // Fuente de verdad para imágenes en todo el front
  images?: ProductImage[];
  // Legacy opcional (si algún endpoint aún lo envía)
  image_url?: string | null;
  is_active: boolean;
}

// =============================
// Imágenes  
// =============================

export type ProductImage = {
  url: string;
  thumb_url?: string | null;
  alt_text?: string | null;
};

export interface ProductColorImage extends ProductImage {
  color?: string | null;
}

// =============================
// Variante (Detail)
// =============================

export interface ProductVariant {
  id: number;
  value: string | null;   // talla / número / medida (el frontend puede ordenar visualmente según variant_schema)
  color: string | null;
  stock: number;          // stock real desde InventoryPool
  is_active: boolean;

  image_url?: string | null;
  image_thumb_url?: string | null;
  images?: ProductImage[];
}

// =============================
// Producto (Detail)
// =============================

export interface ProductDetail extends Product {
  description: string;
  created_at: string;
  updated_at: string;
  variants: ProductVariant[];
}

// =============================
// PDP View Model / Frontend derivados
// =============================

/**
 * Imagen ya normalizada para render del PDP.
 * Diferente del contrato API: aquí el frontend asume `url` usable
 * y puede adjuntar metadata lista para galería / fallback visual.
 */
export interface NormalizedProductGalleryImage {
  url: string;
  thumb_url?: string | null;
  alt_text?: string | null;
}

/**
 * Estructuras derivadas para selección rápida de variantes en PDP.
 * No representa payload backend; es una estructura de apoyo para UI.
 */
export interface ProductVariantMatrix {
  byColor: Map<string, ProductVariant[]>;
  byValue: Map<string, ProductVariant[]>;
  byColorValue: Map<string, ProductVariant>;
}

/**
 * Estado derivado de selección del PDP.
 * Se usa para separar reglas de interacción de los datos crudos del API.
 */
export interface ProductSelectionState {
  variantSchema: string;
  requiresValue: boolean;
  requiresColor: boolean;
  selectedValue: string;
  selectedColor: string;
  availableStock: number;
  canAdd: boolean;
  uiSoldOut: boolean;
  isInvalidCombo: boolean;
  helperSelectionText: string;
}

/**
 * View model del detalle de producto para el PDP.
 * Extiende el contrato base del API sin mutarlo; permite transportar
 * datos ya preparados para render, metadata visual y galería canónica.
 */
export interface ProductDetailViewModel {
  product: ProductDetail;
  primaryImage: string | null;
  canonicalProductImage: string | null;
  galleryImages: NormalizedProductGalleryImage[];
}

// =============================
// Homepage
// =============================

export interface HomepageBanner {
  id: number;
  title: string;
  subtitle?: string | null;
  image: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  show_text?: boolean;
  sort_order: number;
  is_active?: boolean;
  created_at?: string;
}

export interface HomepagePromo {
  id: number;
  title?: string | null;
  subtitle?: string | null;
  image: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  placement?: string;
  sort_order: number;
  is_active?: boolean;
}

// =============================
// Paginación
// =============================

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
