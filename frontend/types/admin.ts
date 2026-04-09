// Admin panel types — do NOT export from catalog.ts

export type AdminUser = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
};

// ── Dashboard ──────────────────────────────────────────────────────────────

export type DailySale = { date: string; amount: number };
export type TopProduct = { product_id: number; name: string; units: number };
export type Funnel = { events_sent: number; orders_created: number; paid: number };
export type RecentOrder = {
  reference: string;
  customer_name: string;
  total: number;
  status: OrderStatus;
  created_at: string;
};

export type DashboardData = {
  period: string;
  start_date: string;
  end_date: string;
  total_revenue: number;
  order_count: number;
  avg_ticket: number;
  conversion_rate: number;
  revenue_at_risk: number;
  daily_sales: DailySale[];
  top_products: TopProduct[];
  funnel: Funnel;
  recent_orders: RecentOrder[];
};

// ── Orders ─────────────────────────────────────────────────────────────────

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "shipped"
  | "cancelled"
  | "refunded"
  | "created";

export type OrderListItem = {
  reference: string;
  id: number;
  customer_name: string;
  customer_email: string;
  items_summary: string;
  total: number;
  payment_method: string;
  status: OrderStatus;
  created_at: string;
  tracking_number: string;
};

export type OrderItemLine = {
  product_name: string;
  variant: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type StatusLog = {
  status: string;
  note: string;
  created_at: string;
};

export type OrderDetail = {
  reference: string;
  id: number;
  status: OrderStatus;
  payment_method: string;
  tracking_number: string;
  customer: {
    full_name: string;
    email: string;
    phone: string;
    document_type: string;
    cedula: string;
  };
  shipping: {
    city_code: string;
    address: string;
    notes: string;
  };
  items: OrderItemLine[];
  summary: { subtotal: number; shipping_cost: number; total: number };
  status_logs: StatusLog[];
  created_at: string;
  updated_at: string;
  payment_confirmed_at: string | null;
};

export type PaginatedOrders = {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: OrderListItem[];
};

// ── Inventory ──────────────────────────────────────────────────────────────

export type InventoryPoolItem = {
  pool_id: number;
  category_id: number;
  category_name: string;
  value: string;
  color: string;
  quantity: number;
  reserved: number;
  is_active: boolean;
  low_stock: boolean;
  updated_at?: string;
};

export type InventoryBulkLoadResult = {
  ok: boolean;
  created: number;
  updated: number;
  errors: string[];
};

export type AdjustmentLog = {
  id: number;
  previous_stock: number;
  new_stock: number;
  diff: number;
  reason: string;
  adjusted_by: string | null;
  created_at: string;
};

// ── Customers ──────────────────────────────────────────────────────────────

export type CustomerListItem = {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  lifetime_value: number;
  /** ISO 8601: fecha de creación del registro de cliente (created_at). */
  created_at: string;
  order_count: number;
  last_purchase: string | null;
};

export type CustomerMetrics = {
  lifetime_value: number;
  order_count: number;
  avg_ticket: number;
  first_purchase: string | null;
  last_purchase: string | null;
};

export type CustomerDetail = {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  document_type: string;
  cedula: string;
  is_active: boolean;
  /** ISO 8601: fecha de creación del registro (created_at). */
  created_at: string;
  metrics: CustomerMetrics;
  orders: Array<{
    reference: string;
    items_summary: string;
    total: number;
    status: OrderStatus;
    created_at: string;
  }>;
  top_products: Array<{ name: string; variant: string; units: number }>;
};

// ── Analytics ──────────────────────────────────────────────────────────────

export type FunnelStep = { event: string; sessions: number };
export type FunnelVolumeStep = { event: string; count: number };
export type CheckoutStep = { step: string; count: number };
export type ProductClick = { product_id: string; product_name: string; clicks: number };
export type TopProductViews = { product_id: string; product_name: string; views: number };
export type TopProductAddToCart = { product_id: string; product_name: string; add_to_cart: number };

export type ProductPerformanceRow = {
  product_id: string;
  product_name: string;
  product_views: number;
  view_sessions: number;
  product_clicks: number;
  click_sessions: number;
  add_to_cart: number;
  cart_sessions: number;
  sessions_view_and_cart: number;
  conv_view_to_cart_pct: number | null;
  click_through_pct: number | null;
};

export type AnalyticsSummary = {
  total_events: number;
  unique_sessions: number;
  events_by_type: Record<string, number>;
};

export type DailyActivityPoint = { date: string; events: number };

export type HomeTraffic = {
  hits: number;
  sessions: number;
};

export type AnalyticsData = {
  period: string;
  start_date: string;
  end_date: string;
  summary: AnalyticsSummary;
  home_traffic: HomeTraffic;
  daily_activity: DailyActivityPoint[];
  top_products_by_clicks: ProductClick[];
  top_products_by_views: TopProductViews[];
  top_products_by_add_to_cart: TopProductAddToCart[];
  product_performance: ProductPerformanceRow[];
  funnel: FunnelStep[];
  funnel_volume: FunnelVolumeStep[];
  checkout_steps: CheckoutStep[];
};

// ── Recovery ───────────────────────────────────────────────────────────────

export type PendingOrder = {
  reference: string;
  id: number;
  customer_name: string;
  email: string;
  items_summary: string;
  total: number;
  time_pending: string;
  created_at: string;
};

// ── Products ───────────────────────────────────────────────────────────────

export type AdminProduct = {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  category_id: number;
  category_name: string;
  /** Mirrors Django Category.variant_schema (e.g. "size_color"). */
  category_variant_schema: string;
  is_active: boolean;
  total_stock: number;
  variant_count: number;
  primary_image: string | null;
  created_at: string;
};

export type AdminVariantRule = {
  label: string;
  use_select: boolean;
  allowed_values: string[] | null;
  allowed_colors: string[] | null;
  normalize_upper: boolean;
};

export type AdminProductColorImage = {
  id: number;
  color: string;
  alt_text: string;
  is_primary: boolean;
  sort_order: number;
  image_thumb_url: string | null;
};

export type AdminProductDetail = AdminProduct & {
  variant_rule: AdminVariantRule;
  variants: Array<{
    id: number;
    value: string;
    color: string;
    is_active: boolean;
    stock: number;
  }>;
  /** ProductColorImage list (only for SIZE_COLOR categories). */
  color_images: AdminProductColorImage[];
};

export type AdminCategory = {
  id: number;
  name: string;
  slug: string;
  department: string;
  department_id: number;
  is_leaf: boolean;
  is_active: boolean;
  variant_schema: string;
  product_count: number;
  parent_id: number | null;
  sort_order: number;
};

export type AdminDepartment = {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  sort_order: number;
};

export type AdminHomepageBanner = {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  alt_text: string;
  is_active: boolean;
  sort_order: number;
  cta_label: string;
  cta_url: string;
  show_text: boolean;
  image_thumb_url: string | null;
};

export type AdminHomepagePromo = {
  id: number;
  title: string;
  subtitle: string;
  placement: string;
  is_active: boolean;
  sort_order: number;
  cta_label: string;
  cta_url: string;
  show_text: boolean;
  alt_text: string;
  image_thumb_url: string | null;
};

export type AdminHomepageSection = {
  id: number;
  key: string;
  title: string;
  subtitle: string;
  content: string;
  content_preview: string;
  is_active: boolean;
  sort_order: number;
};
