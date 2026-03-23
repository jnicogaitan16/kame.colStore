/**
 * Cliente API para el catálogo (Django backend).
 *
 * Contrato de caché del SDK:
 * - `apiFetch()` centraliza transporte, headers, credenciales y política base.
 * - `apiFetch()` NO es cacheable por defecto: respeta `options.cache` y
 *   `options.next.revalidate` cuando el caller los define.
 * - Si el caller no define política, `apiFetch()` usa `no-store` como fallback
 *   seguro para flujos sensibles o mutables.
 *
 * Familias de endpoint:
 * - Navegación, home, promos y lecturas públicas: cacheables con
 *   `next.revalidate` explícito.
 * - PDP: cacheable de forma configurable por el caller, normalmente con
 *   revalidación corta.
 * - Checkout, stock validate y mutaciones: sin caché (`no-store`).
 */
import type {
  Category,
  HomepageBanner,
  HomepagePromo,
  PaginatedResponse,
  ProductDetail,
  Product,
} from "@/types/catalog";

export type HomepageStory = {
  id: number;
  title: string;
  subtitle?: string | null;
  content: string;
  is_active?: boolean | null;
  active?: boolean | null;
};

export type CategoryNav = {
  id: number;
  name: string;
  slug: string;
  sort_order?: number;
};

export type DepartmentNav = {
  id: number;
  name: string;
  slug: string;
  sort_order?: number;
  categories: CategoryNav[];
};

export type NavigationResponse = {
  departments: DepartmentNav[];
};

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

export type ProductFetchOptions = {
  cache?: RequestCache;
  next?: {
    revalidate?: number;
  };
};

function buildListQueryString(
  params?: Record<string, string | number | undefined>
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params || {})) {
    if (value == null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    searchParams.set(key, String(value));
  }

  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

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

/**
 * Temporary legacy helper.
 * Prefer `apiFetch()` for all new code so transport, credentials, cache rules,
 * and error handling stay centralized in one path.
 */
export async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(url, {
    ...init,
    cache: init?.cache ?? "no-store",
  });
}

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

  const nextFromOptions = (options as RequestInit & {
    next?: { revalidate?: number };
  }).next;

  const hasExplicitCache = options.cache != null;
  const hasRevalidate = nextFromOptions?.revalidate != null;

  // Base cache contract:
  // - respect explicit `cache` from caller
  // - respect explicit `next.revalidate` from caller
  // - if caller defines `revalidate`, do NOT inject `cache`
  // - otherwise default to `no-store` as the safe fallback
  const cacheOpt = hasExplicitCache
    ? options.cache
    : hasRevalidate
      ? undefined
      : "no-store";

  const nextOpt = hasRevalidate ? nextFromOptions : undefined;

  const res = await fetch(url, {
    ...options,
    method,
    credentials: "include",
    ...(cacheOpt ? { cache: cacheOpt } : {}),
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

/**
 * Legacy flat catalog categories.
 *
 * Cache policy:
 * - Public read endpoint.
 * - Cacheable with ISR-style revalidation (`next.revalidate`).
 *
 * This endpoint remains available only as a legacy fallback source.
 * It must not be treated as the preferred public navigation contract.
 * Prefer `getNavigation()` for public navigation and only use this data
 * when `/navigation/` is unavailable or invalid upstream.
 */
export async function getCategories(): Promise<Category[]> {
  const data = await apiFetch<any>("/categories/", {
    next: { revalidate: 300 },
  });

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;

  return [];
}

/**
 * Official public navigation contract.
 *
 * Cache policy:
 * - Public read endpoint.
 * - Cacheable with ISR-style revalidation (`next.revalidate`).
 *
 * Responsibilities in this API layer are intentionally limited to:
 * - fetching `/navigation/`
 * - performing minimal structural validation
 * - returning reasonably safe raw data compatible with the backend contract
 *
 * Deep sanitization, deduplication, presentation ordering, and UI-specific
 * derivations must live outside this file (for example in
 * `frontend/lib/navigation-normalize.ts`).
 */
export async function getNavigation(): Promise<NavigationResponse> {
  const data = await apiFetch<any>("/navigation/", {
    next: { revalidate: 300 },
  });

  const rawDepartments = Array.isArray(data?.departments)
    ? data.departments
    : Array.isArray(data)
      ? data
      : [];

  const departments: DepartmentNav[] = rawDepartments.map((d: any) => {
    const rawCategories = Array.isArray(d?.categories) ? d.categories : [];

    const categories: CategoryNav[] = rawCategories.map((c: any) => ({
      id: Number(c?.id) || 0,
      name: String(c?.name || "").trim(),
      slug: String(c?.slug || "").trim(),
      sort_order:
        typeof c?.sort_order === "number"
          ? c.sort_order
          : Number(c?.sort_order) || 0,
    }));

    return {
      id: Number(d?.id) || 0,
      name: String(d?.name || "").trim(),
      slug: String(d?.slug || "").trim(),
      sort_order:
        typeof d?.sort_order === "number"
          ? d.sort_order
          : Number(d?.sort_order) || 0,
      categories,
    } as DepartmentNav;
  });

  return { departments };
}

/**
 * Primary public catalog listing wrapper based on `/products/`.
 *
 * Cache policy:
 * - Public read endpoint.
 * - By default this wrapper inherits the safe `no-store` fallback from
 *   `apiFetch()` because listing freshness may depend on active filters,
 *   stock visibility or search context.
 * - If a listing flow later needs caching, that policy must be declared
 *   explicitly at the call site or by extending this wrapper intentionally.
 *
 * Use this for general product listings, including category and department
 * filtering. This is the canonical SDK entry point for filtered product lists.
 */
export async function getProducts(params?: {
  category?: string;
  department?: string;
  page?: number;
  page_size?: number;
  search?: string;
}): Promise<PaginatedResponse<Product>> {
  const query = buildListQueryString({
    category: params?.category,
    department: params?.department,
    page: params?.page,
    page_size: params?.page_size,
    search: params?.search,
  });

  return apiFetch<PaginatedResponse<Product>>(`/products/${query}`);
}


/**
 * Catalog view wrapper based on `/catalogo/`.
 *
 * Cache policy:
 * - Public read endpoint.
 * - By default this wrapper inherits the safe fallback from `apiFetch()`
 *   (`no-store` unless the caller provides an explicit cache policy).
 * - Public SSR listing flows may pass an explicit policy from the caller
 *   (for example `next.revalidate`) when the page contract requires it.
 *
 * Use this only when the frontend explicitly depends on the backend contract of
 * `/catalogo/` for the catalog page or compatibility flows. Do not use it as a
 * generic replacement for `getProducts()`.
 */
export async function getCatalogo(
  params?: {
    category?: string;
    search?: string;
    page?: number;
    page_size?: number;
  },
  options?: ProductFetchOptions
): Promise<PaginatedResponse<Product>> {
  const query = buildListQueryString({
    category: params?.category,
    search: params?.search,
    page: params?.page,
    page_size: params?.page_size,
  });

  return apiFetch<PaginatedResponse<Product>>(`/catalogo/${query}`, {
    cache: options?.cache,
    next: options?.next,
  });
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

/**
 * Product detail wrapper for PDP.
 *
 * Cache policy:
 * - Public read endpoint.
 * - Cache is intentionally delegated to the caller through `options`.
 * - Typical PDP usage may provide short `next.revalidate`, but this wrapper
 *   must stay configurable and must not hardcode a cache policy here.
 */
export async function getProductBySlug(
  slug: string,
  options?: ProductFetchOptions
): Promise<ProductDetail> {
  const raw = await apiFetch<any>(`/products/${encodeURIComponent(slug)}/`, {
    cache: options?.cache,
    next: options?.next,
  });

  return normalizeProductDetail(raw);
}

/**
 * Homepage banners.
 *
 * Cache policy:
 * - Public home read endpoint.
 * - Cacheable with ISR-style revalidation.
 */
export async function getHomepageBanners(): Promise<HomepageBanner[]> {
  return apiFetch<HomepageBanner[]>("/homepage-banners/", {
    next: { revalidate: 300 },
  });
}

/**
 * Homepage promos.
 *
 * Cache policy:
 * - Public home read endpoint.
 * - Cacheable with ISR-style revalidation.
 *
 * Contract note:
 * - When `placement` is provided, the backend is expected to respect that filter
 *   and return only promos matching the requested placement.
 * - If the backend returns inconsistent rows (for example `placement=TOP` but rows
 *   labeled as `MID`), that is a backend contract violation.
 * - This SDK wrapper must remain transport-only for this endpoint: it must not
 *   silently fix, remap, or defensively filter placement mismatches.
 * - Consumers that need extra resilience may validate the payload on their side,
 *   but that validation must not redefine the backend contract here.
 */
export async function getHomepagePromos(
  placement?: "TOP" | "MID"
): Promise<HomepagePromo[]> {
  const qs = placement ? `?placement=${encodeURIComponent(placement)}` : "";
  return apiFetch<HomepagePromo[]>(`/homepage-promos/${qs}`, {
    next: { revalidate: 300 },
  });
}

function extractArray<T>(res: any): T[] {
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray(res?.results)) return res.results as T[];
  if (Array.isArray(res?.data)) return res.data as T[];
  if (Array.isArray(res?.sections)) return res.sections as T[];
  if (Array.isArray(res?.items)) return res.items as T[];
  if (Array.isArray(res?.story)) return res.story as T[];
  return [];
}

function isActiveRow(row: any): boolean {
  if (!row) return false;
  // soporta is_active o active (y null/undefined = true por defecto)
  if (typeof row.is_active === "boolean") return row.is_active;
  if (typeof row.active === "boolean") return row.active;
  return true;
}

/**
 * Sección de Home (Brand Story).
 *
 * Cache policy:
 * - Public home read endpoint.
 * - Cacheable with ISR-style revalidation.
 *
 * Soporta múltiples variantes de endpoint y payload:
 * - Listas: {results:[...]}, {sections:[...]}, [...]
 * - Objeto: {title, content, ...} (legacy)
 * - Wrapper: {story: {...}} o {story: [...]} 
 */
export async function getHomepageStory(): Promise<HomepageStory | null> {
  // Preferimos `apiFetch` para mantener tunnel-safe (/api en browser)
  // y call directo al Django en server-side cuando `DJANGO_API_BASE` está seteado.
  // Fuente preferida actual: `/homepage-story/`.
  // Los demás endpoints se mantienen solo como fallback legacy temporal.
  const candidates = [
    "/homepage-story/",
    "/home_sections/",
    "/home-sections/",
  ];

  let lastStatus: number | null = null;

  for (const path of candidates) {
    try {
      const data = await apiFetch<any>(path, {
        next: { revalidate: 300 },
      });

      // 1) Si viene una lista (o wrappers comunes), tomamos la primera activa.
      const rows = extractArray<HomepageStory>(data);
      if (rows.length) {
        const active = rows.filter(isActiveRow);
        return active[0] || rows[0] || null;
      }

      // 2) Si viene un objeto directo (legacy), lo aceptamos.
      const maybe = (data?.story ?? data) as any;
      const hasFields =
        maybe &&
        (typeof maybe.title === "string" || typeof maybe.content === "string");

      if (hasFields && isActiveRow(maybe)) {
        // Normaliza a HomepageStory mínimo
        return {
          id: Number(maybe.id) || 0,
          title: String(maybe.title || ""),
          subtitle: (maybe.subtitle ?? null) as any,
          content: String(maybe.content || ""),
          is_active:
            typeof maybe.is_active === "boolean"
              ? maybe.is_active
              : (maybe.is_active ?? null),
          active:
            typeof maybe.active === "boolean" ? maybe.active : (maybe.active ?? null),
        } as HomepageStory;
      }

      // Si llegó pero no tiene forma esperada, seguimos probando.
      lastStatus = 200;
    } catch (e: any) {
      lastStatus = typeof e?.status === "number" ? e.status : lastStatus;
      continue;
    }
  }

  // útil para diagnóstico
  console.warn(
    "getHomepageStory: no usable homepage story data from configured candidates. lastStatus=",
    lastStatus
  );
  return null;
}

/**
 * Server-side cart stock validation.
 *
 * Cache policy:
 * - Sensitive POST operation.
 * - Must remain uncached and continue using the safe default `no-store` path.
 */
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

/**
 * Checkout submission.
 *
 * Cache policy:
 * - Sensitive POST operation.
 * - Must remain uncached and continue using the safe default `no-store` path.
 */
export async function checkout(
  payload: CheckoutPayload
): Promise<CheckoutResponse> {
  if (!payload.items?.length) {
    throw new Error("Checkout inválido: items vacío");
  }

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
