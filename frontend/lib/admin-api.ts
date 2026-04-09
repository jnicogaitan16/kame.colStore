/**
 * Admin API client.
 * All requests use credentials:include and default to no-store.
 * Mirrors the pattern in lib/api.ts but targets /api/admin/* endpoints.
 */

import type {
  AdminUser,
  DashboardData,
  PaginatedOrders,
  OrderDetail,
  InventoryPoolItem,
  InventoryBulkLoadResult,
  AdjustmentLog,
  CustomerListItem,
  CustomerDetail,
  AnalyticsData,
  PendingOrder,
  AdminProduct,
  AdminProductDetail,
  AdminCategory,
  AdminDepartment,
  AdminHomepageBanner,
  AdminHomepagePromo,
  AdminHomepageSection,
  AdminProductColorImage,
} from "@/types/admin";

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "");
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || undefined);

  if (options.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // CSRF for unsafe methods (client-side)
  if (typeof window !== "undefined" && !["GET", "HEAD"].includes(method)) {
    const csrf = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("csrftoken="))
      ?.split("=")[1];
    if (csrf) headers.set("X-CSRFToken", decodeURIComponent(csrf));
  }

  const res = await fetch(url, {
    ...options,
    method,
    credentials: "include",
    cache: "no-store",
    headers,
  });

  if (res.status === 204 || res.status === 205) {
    return undefined as T;
  }

  if (!res.ok) {
    let payload: any = null;
    try { payload = await res.json(); } catch { /* ignore */ }
    const rawErr = payload?.error;
    const msg =
      typeof rawErr === "string"
        ? rawErr
        : rawErr != null && typeof rawErr === "object"
          ? JSON.stringify(rawErr)
          : `API ${res.status}: ${res.statusText}`;
    const err: any = new Error(msg);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** POST/PATCH con FormData (sin forzar Content-Type; el navegador pone multipart boundary). */
async function adminFetchMultipart<T>(path: string, options: RequestInit = {}): Promise<T> {
  const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "");
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || undefined);

  if (typeof window !== "undefined" && !["GET", "HEAD"].includes(method)) {
    const csrf = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("csrftoken="))
      ?.split("=")[1];
    if (csrf) headers.set("X-CSRFToken", decodeURIComponent(csrf));
  }

  const res = await fetch(url, {
    ...options,
    method,
    credentials: "include",
    cache: "no-store",
    headers,
  });

  if (res.status === 204 || res.status === 205) {
    return undefined as T;
  }

  if (!res.ok) {
    let payload: any = null;
    try { payload = await res.json(); } catch { /* ignore */ }
    const rawErr = payload?.error;
    const msg =
      typeof rawErr === "string"
        ? rawErr
        : rawErr != null && typeof rawErr === "object"
          ? JSON.stringify(rawErr)
          : `API ${res.status}: ${res.statusText}`;
    const err: any = new Error(msg);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────

export type LoginResponse =
  | (AdminUser & { requires_otp?: false })
  | { requires_otp: true; ephemeral_token: string };

export async function authLogin(
  username: string,
  password: string
): Promise<LoginResponse> {
  return adminFetch<LoginResponse>("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function authVerifyOtp(
  ephemeral_token: string,
  otp_code: string
): Promise<AdminUser> {
  return adminFetch<AdminUser>("/auth/verify-otp/", {
    method: "POST",
    body: JSON.stringify({ ephemeral_token, otp_code }),
  });
}

export async function authLogout(): Promise<void> {
  await adminFetch("/auth/logout/", { method: "POST" });
}

export async function authMe(): Promise<AdminUser | null> {
  try {
    return await adminFetch<AdminUser>("/auth/me/");
  } catch {
    return null;
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export async function getDashboard(params: {
  period?: string;
  start?: string;
  end?: string;
} = {}): Promise<DashboardData> {
  const qs = new URLSearchParams();
  if (params.period) qs.set("period", params.period);
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  const q = qs.toString() ? `?${qs}` : "?period=7d";
  return adminFetch<DashboardData>(`/admin/dashboard/${q}`);
}

// ── Orders ────────────────────────────────────────────────────────────────

export async function getAdminOrders(params: {
  status?: string;
  start?: string;
  end?: string;
  search?: string;
  page?: number;
} = {}): Promise<PaginatedOrders> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  if (params.search) qs.set("search", params.search);
  if (params.page) qs.set("page", String(params.page));
  const q = qs.toString() ? `?${qs}` : "";
  return adminFetch<PaginatedOrders>(`/admin/orders/${q}`);
}

export async function getAdminOrder(reference: string): Promise<OrderDetail> {
  return adminFetch<OrderDetail>(`/admin/orders/${encodeURIComponent(reference)}/`);
}

export async function shipOrder(reference: string, tracking_number: string) {
  return adminFetch(`/admin/orders/${encodeURIComponent(reference)}/ship/`, {
    method: "POST",
    body: JSON.stringify({ tracking_number }),
  });
}

export async function cancelOrder(reference: string, note?: string) {
  return adminFetch(`/admin/orders/${encodeURIComponent(reference)}/cancel/`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export async function sendReminder(reference: string) {
  return adminFetch<{ ok: boolean; message: string }>(
    `/admin/orders/${encodeURIComponent(reference)}/send-reminder/`,
    { method: "POST" }
  );
}

export async function getPendingRecovery(): Promise<{ count: number; results: PendingOrder[] }> {
  return adminFetch(`/admin/orders/pending-recovery/`);
}

// ── Inventory ─────────────────────────────────────────────────────────────

export async function getInventory(params: { category?: string; search?: string } = {}): Promise<InventoryPoolItem[]> {
  const qs = new URLSearchParams();
  if (params.category) qs.set("category", params.category);
  if (params.search) qs.set("search", params.search);
  const q = qs.toString() ? `?${qs}` : "";
  return adminFetch<InventoryPoolItem[]>(`/admin/inventory/${q}`);
}

export async function updateInventoryStock(
  poolId: number,
  newStock: number,
  reason: string
) {
  return adminFetch(`/admin/inventory/${poolId}/`, {
    method: "PATCH",
    body: JSON.stringify({ new_stock: newStock, reason }),
  });
}

export async function getInventoryHistory(
  poolId: number
): Promise<{ pool_id: number; category: string; value: string; color: string; history: AdjustmentLog[] }> {
  return adminFetch(`/admin/inventory/${poolId}/history/`);
}

export async function createInventoryPool(data: {
  category_id: number;
  value?: string;
  color?: string;
  quantity?: number;
  is_active?: boolean;
}): Promise<InventoryPoolItem> {
  return adminFetch<InventoryPoolItem>(`/admin/inventory/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function bulkInventoryLoad(data: {
  category_id: number;
  lines: string;
  add_to_existing?: boolean;
}): Promise<InventoryBulkLoadResult> {
  return adminFetch<InventoryBulkLoadResult>(`/admin/inventory/bulk/`, {
    method: "POST",
    body: JSON.stringify({
      category_id: data.category_id,
      lines: data.lines,
      add_to_existing: data.add_to_existing ?? false,
    }),
  });
}

export async function deleteInventoryPool(poolId: number): Promise<void> {
  return adminFetch<void>(`/admin/inventory/${poolId}/`, { method: "DELETE" });
}

// ── Customers ─────────────────────────────────────────────────────────────

export async function getAdminCustomers(params: { search?: string; page?: number } = {}): Promise<{
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: CustomerListItem[];
}> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.page) qs.set("page", String(params.page));
  const q = qs.toString() ? `?${qs}` : "";
  return adminFetch(`/admin/customers/${q}`);
}

export async function getAdminCustomer(customerId: number): Promise<CustomerDetail> {
  return adminFetch<CustomerDetail>(`/admin/customers/${customerId}/`);
}

export async function updateAdminCustomer(
  customerId: number,
  data: Partial<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    document_type: string;
    cedula: string;
    is_active: boolean;
  }>
): Promise<CustomerDetail> {
  return adminFetch<CustomerDetail>(`/admin/customers/${customerId}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteAdminCustomer(customerId: number): Promise<void> {
  await adminFetch<void>(`/admin/customers/${customerId}/delete/`, { method: "DELETE" });
}

// ── Analytics ─────────────────────────────────────────────────────────────

export async function getAnalytics(params: {
  period?: string;
  start?: string;
  end?: string;
} = {}): Promise<AnalyticsData> {
  const qs = new URLSearchParams();
  if (params.period) qs.set("period", params.period);
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);
  const q = qs.toString() ? `?${qs}` : "?period=7d";
  return adminFetch<AnalyticsData>(`/admin/analytics/${q}`);
}

// ── Products ──────────────────────────────────────────────────────────────

export async function getAdminProducts(params: {
  search?: string;
  category?: string;
  page?: number;
} = {}): Promise<{ count: number; page: number; total_pages: number; results: AdminProduct[] }> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.category) qs.set("category", params.category);
  if (params.page) qs.set("page", String(params.page));
  const q = qs.toString() ? `?${qs}` : "";
  return adminFetch(`/admin/products/${q}`);
}

export async function getAdminProduct(id: number): Promise<AdminProductDetail> {
  return adminFetch<AdminProductDetail>(`/admin/products/${id}/`);
}

export async function createProduct(data: {
  name: string;
  price: number;
  category_id: number;
  description?: string;
  /** Si se omite o va vacío, el servidor genera uno único a partir del nombre. */
  slug?: string;
}): Promise<AdminProductDetail> {
  return adminFetch<AdminProductDetail>(`/admin/products/create/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProduct(
  id: number,
  data: Partial<{
    name: string;
    slug: string;
    price: number;
    description: string;
    is_active: boolean;
    category_id: number;
  }>
): Promise<AdminProductDetail> {
  return adminFetch<AdminProductDetail>(`/admin/products/${id}/edit/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(id: number) {
  return adminFetch(`/admin/products/${id}/delete/`, { method: "DELETE" });
}

export async function addVariant(
  productId: number,
  data: { value: string; color?: string; initial_stock?: number }
) {
  return adminFetch(`/admin/products/${productId}/variants/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createProductColorImage(productId: number, formData: FormData): Promise<AdminProductColorImage> {
  return adminFetchMultipart<AdminProductColorImage>(`/admin/products/${productId}/color-images/create/`, {
    method: "POST",
    body: formData,
  });
}

export async function updateProductColorImage(
  productId: number,
  imageId: number,
  formData: FormData
): Promise<AdminProductColorImage> {
  return adminFetchMultipart<AdminProductColorImage>(`/admin/products/${productId}/color-images/${imageId}/`, {
    method: "PATCH",
    body: formData,
  });
}

export async function deleteProductColorImage(productId: number, imageId: number): Promise<void> {
  await adminFetch<void>(`/admin/products/${productId}/color-images/${imageId}/delete/`, { method: "DELETE" });
}

export async function getAdminCategories(params: { include_inactive?: boolean } = {}): Promise<AdminCategory[]> {
  const qs = new URLSearchParams();
  if (params.include_inactive) qs.set("include_inactive", "1");
  const q = qs.toString() ? `?${qs}` : "";
  return adminFetch<AdminCategory[]>(`/admin/products/categories/${q}`);
}

export async function createCategory(data: {
  name: string;
  department_id: number;
  variant_schema?: string;
  parent_id?: number | null;
  /** Si se omite o va vacío, el servidor genera uno a partir del nombre. */
  slug?: string;
}): Promise<AdminCategory> {
  return adminFetch<AdminCategory>(`/admin/products/categories/create/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCategory(
  id: number,
  data: Partial<{
    name: string;
    slug: string;
    is_active: boolean;
    variant_schema: string;
    sort_order: number;
  }>
): Promise<AdminCategory> {
  return adminFetch<AdminCategory>(`/admin/products/categories/${id}/edit/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getAdminDepartments(
  params: { include_inactive?: boolean } = {}
): Promise<AdminDepartment[]> {
  const qs = new URLSearchParams();
  if (params.include_inactive) qs.set("include_inactive", "1");
  const q = qs.toString() ? `?${qs}` : "";
  return adminFetch<AdminDepartment[]>(`/admin/products/departments/${q}`);
}

export async function createDepartment(data: {
  name: string;
  slug?: string;
  sort_order?: number;
  is_active?: boolean;
}): Promise<AdminDepartment> {
  return adminFetch<AdminDepartment>(`/admin/products/departments/create/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateDepartment(
  id: number,
  data: Partial<{ name: string; slug: string; is_active: boolean; sort_order: number }>
): Promise<AdminDepartment> {
  return adminFetch<AdminDepartment>(`/admin/products/departments/${id}/edit/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteDepartment(id: number): Promise<void> {
  await adminFetch<void>(`/admin/products/departments/${id}/delete/`, { method: "DELETE" });
}

export async function getAdminHomepageBanners(): Promise<AdminHomepageBanner[]> {
  return adminFetch<AdminHomepageBanner[]>(`/admin/homepage/banners/`);
}

export async function createHomepageBanner(formData: FormData): Promise<AdminHomepageBanner> {
  return adminFetchMultipart<AdminHomepageBanner>(`/admin/homepage/banners/create/`, {
    method: "POST",
    body: formData,
  });
}

export async function updateHomepageBanner(
  id: number,
  data: Partial<{
    is_active: boolean;
    sort_order: number;
    title: string;
    subtitle: string;
    description: string;
    alt_text: string;
    cta_label: string;
    cta_url: string;
    show_text: boolean;
  }>
): Promise<AdminHomepageBanner> {
  return adminFetch<AdminHomepageBanner>(`/admin/homepage/banners/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function updateHomepageBannerMultipart(
  id: number,
  formData: FormData
): Promise<AdminHomepageBanner> {
  return adminFetchMultipart<AdminHomepageBanner>(`/admin/homepage/banners/${id}/`, {
    method: "PATCH",
    body: formData,
  });
}

export async function deleteHomepageBanner(id: number): Promise<void> {
  await adminFetch<void>(`/admin/homepage/banners/${id}/delete/`, { method: "DELETE" });
}

export async function getAdminHomepagePromos(): Promise<AdminHomepagePromo[]> {
  return adminFetch<AdminHomepagePromo[]>(`/admin/homepage/promos/`);
}

export async function createHomepagePromo(formData: FormData): Promise<AdminHomepagePromo> {
  return adminFetchMultipart<AdminHomepagePromo>(`/admin/homepage/promos/create/`, {
    method: "POST",
    body: formData,
  });
}

export async function updateHomepagePromo(
  id: number,
  data: Partial<{
    is_active: boolean;
    sort_order: number;
    title: string;
    subtitle: string;
    placement: string;
    cta_label: string;
    cta_url: string;
    show_text: boolean;
    alt_text: string;
  }>
): Promise<AdminHomepagePromo> {
  return adminFetch<AdminHomepagePromo>(`/admin/homepage/promos/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function updateHomepagePromoMultipart(
  id: number,
  formData: FormData
): Promise<AdminHomepagePromo> {
  return adminFetchMultipart<AdminHomepagePromo>(`/admin/homepage/promos/${id}/`, {
    method: "PATCH",
    body: formData,
  });
}

export async function deleteHomepagePromo(id: number): Promise<void> {
  await adminFetch<void>(`/admin/homepage/promos/${id}/delete/`, { method: "DELETE" });
}

export async function getAdminHomepageSections(): Promise<AdminHomepageSection[]> {
  return adminFetch<AdminHomepageSection[]>(`/admin/homepage/sections/`);
}

export async function createHomepageSection(data: {
  title: string;
  subtitle?: string;
  content?: string;
  sort_order?: number;
  is_active?: boolean;
  /** Opcional; el backend genera slug desde el título si no se envía (como Django admin). */
  key?: string;
}): Promise<AdminHomepageSection> {
  return adminFetch<AdminHomepageSection>(`/admin/homepage/sections/create/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateHomepageSection(
  id: number,
  data: Partial<{
    is_active: boolean;
    sort_order: number;
    title: string;
    subtitle: string;
    content: string;
  }>
): Promise<AdminHomepageSection> {
  return adminFetch<AdminHomepageSection>(`/admin/homepage/sections/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteHomepageSection(id: number): Promise<void> {
  await adminFetch<void>(`/admin/homepage/sections/${id}/delete/`, { method: "DELETE" });
}
