/**
 * Tipos alineados con la API del catálogo (Django DRF).
 *
 * Capas que este archivo distingue explícitamente:
 * - Contrato API: payloads crudos que llegan desde backend.
 * - Media backend: estructuras de imagen tal como pueden venir del API.
 * - Media normalizada UI: estructura estable ya apta para render.
 * - View model PDP: estructura derivada que consume la UI del detalle.
 *
 * Regla arquitectónica:
 * - Los tipos `Product`, `ProductDetail`, `ProductVariant`, `Category`, etc.
 *   representan contrato backend o compatibilidad directa con ese contrato.
 * - La normalización de media no debe inferirse desde estos tipos; debe pasar por
 *   los helpers compartidos de `frontend/lib/product-media.ts`.
 * - El PDP debe consumir un view model derivado, no reinterpretar manualmente el
 *   payload crudo del API.
 *
 * Importante para navegación:
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
  size_guide?: SizeGuide | null;
  size_guide_id?: number | null;

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

  // Campo backend explícito. Puede venir vacío o requerir normalización.
  primary_image: string | null;
  primary_thumb_url?: string | null;
  primary_medium_url?: string | null;

  // Colección de media enviada por backend. No implica por sí sola que ya esté
  // filtrada, deduplicada o lista para UI; debe normalizarse con product-media.ts.
  images?: ProductImage[];

  // Nota arquitectónica para superficies de listing/card:
  // - Las cards y listados deben consumir helpers compartidos de `frontend/lib/product-media.ts`.
  // - Los candidatos de imagen no deben inferirse inline dentro de componentes.
  // - Este tipo describe contrato backend/compatibilidad, no la política de resolución de media para UI.

  // Campo legacy opcional de compatibilidad.
  image_url?: string | null;
  is_active: boolean;
}

// =============================
// Media backend (payload API)
// =============================

/**
 * Estructura de imagen tal como puede venir desde backend.
 * Aún no representa media canónica de UI.
 */
export type ProductImage = {
  url: string;
  thumb_url?: string | null;
  alt_text?: string | null;
};

/**
 * Variante de media backend asociada a color.
 * Sigue siendo contrato API, no media normalizada de frontend.
 */
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

  // Media opcional asociada a la variante según contrato backend.
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

export interface SizeGuideRow {
  size: string;
  values: Array<string | number>;
}

export interface SizeGuide {
  title: string;
  subtitle?: string | null;
  columns: string[];
  rows: SizeGuideRow[];
}

// =============================
// Media normalizada UI + View model PDP
// =============================

/**
 * Media ya normalizada para frontend.
 *
 * A diferencia de `ProductImage`, esta estructura representa una URL canónica
 * apta para render en cards, PDP, metadata visual y galerías.
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
 * View model derivado del detalle de producto para el PDP.
 *
 * No es payload backend. Agrupa el contrato crudo junto con media canónica y
 * estructuras preparadas para render consistente en la UI del detalle.
 */
export interface ProductDetailViewModel {
  // Contrato backend original del detalle.
  product: ProductDetail;

  // Imagen principal ya resuelta para UI.
  primaryImage: string | null;
  primaryThumb: string | null;
  primaryMedium: string | null;

  // Alias explícito para usos donde se quiera remarcar la imagen canónica del producto.
  canonicalProductImage: string | null;

  // Galería final ya normalizada para render.
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
