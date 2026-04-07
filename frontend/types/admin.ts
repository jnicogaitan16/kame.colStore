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
  full_name: string;
  email: string;
  phone: string;
  document_type: string;
  cedula: string;
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
export type CheckoutStep = { step: string; count: number };
export type ProductClick = { product_id: string; product_name: string; clicks: number };

export type AnalyticsData = {
  period: string;
  top_products_by_clicks: ProductClick[];
  funnel: FunnelStep[];
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
  is_active: boolean;
  total_stock: number;
  variant_count: number;
  primary_image: string | null;
  created_at: string;
};

export type AdminProductDetail = AdminProduct & {
  variants: Array<{
    id: number;
    value: string;
    color: string;
    is_active: boolean;
    stock: number;
  }>;
};

export type AdminCategory = {
  id: number;
  name: string;
  slug: string;
  department: string;
  is_leaf: boolean;
};
