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
  AdjustmentLog,
  CustomerListItem,
  CustomerDetail,
  AnalyticsData,
  PendingOrder,
  AdminProduct,
  AdminProductDetail,
  AdminCategory,
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

  if (!res.ok) {
    let payload: any = null;
    try { payload = await res.json(); } catch { /* ignore */ }
    const err: any = new Error(
      payload?.error || `API ${res.status}: ${res.statusText}`
    );
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  return res.json() as Promise<T>;
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

export async function getDashboard(period = "7d"): Promise<DashboardData> {
  return adminFetch<DashboardData>(`/admin/dashboard/?period=${period}`);
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

// ── Analytics ─────────────────────────────────────────────────────────────

export async function getAnalytics(period = "7d"): Promise<AnalyticsData> {
  return adminFetch<AnalyticsData>(`/admin/analytics/?period=${period}`);
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
}): Promise<AdminProductDetail> {
  return adminFetch<AdminProductDetail>(`/admin/products/create/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProduct(
  id: number,
  data: Partial<{ name: string; price: number; description: string; is_active: boolean; category_id: number }>
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

export async function getAdminCategories(): Promise<AdminCategory[]> {
  return adminFetch<AdminCategory[]>(`/admin/products/categories/`);
}
