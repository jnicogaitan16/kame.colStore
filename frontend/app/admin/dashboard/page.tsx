"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDashboard } from "@/lib/admin-api";
import type { DashboardData, OrderStatus } from "@/types/admin";

const PERIODS = [
  { value: "today", label: "Hoy" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
];

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pendiente",
  paid: "Pagado",
  shipped: "Enviado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  created: "Creado",
};
const STATUS_COLOR: Record<OrderStatus, string> = {
  pending_payment: "bg-yellow-500/20 text-yellow-400",
  paid: "bg-green-500/20 text-green-400",
  shipped: "bg-blue-500/20 text-blue-400",
  cancelled: "bg-red-500/20 text-red-400",
  refunded: "bg-purple-500/20 text-purple-400",
  created: "bg-white/10 text-white/50",
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

function MiniLineChart({ data }: { data: { date: string; amount: number }[] }) {
  if (!data.length) return <div className="h-20 flex items-center justify-center text-white/20 text-xs">Sin datos</div>;

  const max = Math.max(...data.map((d) => d.amount), 1);
  const W = 480, H = 80, PAD = 8;
  const points = data.map((d, i) => {
    const x = PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2);
    const y = H - PAD - ((d.amount / max) * (H - PAD * 2));
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="#e63946"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={`${PAD},${H} ${points.join(" ")} ${W - PAD},${H}`}
        fill="url(#grad)"
        opacity="0.15"
      />
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e63946" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-white/50 mb-1">
        <span>{label}</span>
        <span>{value.toLocaleString()} ({pct}%)</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-[#e63946] rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] = useState("7d");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    getDashboard(period)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="space-y-6">
      {/* Header + period selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                period === p.value
                  ? "bg-[#e63946] text-white"
                  : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-[#e63946] text-sm">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Ventas totales" value={fmt(data.total_revenue)} sub={`${data.order_count} órdenes`} />
            <KpiCard label="Ticket promedio" value={fmt(data.avg_ticket)} />
            <KpiCard label="Conversión" value={`${data.conversion_rate}%`} sub="órdenes pagadas / creadas" />
            <KpiCard label="Revenue en riesgo" value={fmt(data.revenue_at_risk)} sub="pendientes de pago" warn />
          </div>

          {/* Charts row */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Daily sales line */}
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-xs text-white/40 mb-3">Ventas diarias (30 días)</p>
              <MiniLineChart data={data.daily_sales} />
            </div>

            {/* Top products */}
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-xs text-white/40 mb-3">Top productos (unidades)</p>
              <div className="space-y-2">
                {data.top_products.length === 0 && (
                  <p className="text-white/20 text-xs">Sin datos</p>
                )}
                {data.top_products.map((p, i) => {
                  const maxUnits = data.top_products[0]?.units || 1;
                  return (
                    <div key={p.product_id}>
                      <div className="flex justify-between text-xs text-white/60 mb-0.5">
                        <span className="truncate">{i + 1}. {p.name}</span>
                        <span className="ml-2 shrink-0">{p.units} uds</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#e63946]/70 rounded-full"
                          style={{ width: `${(p.units / maxUnits) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Funnel */}
          <div className="bg-white/5 rounded-lg p-4">
            <p className="text-xs text-white/40 mb-3">Funnel de conversión</p>
            <div className="space-y-3">
              <FunnelBar label="Add to cart (sesiones)" value={data.funnel.events_sent} max={data.funnel.events_sent || 1} />
              <FunnelBar label="Orden creada" value={data.funnel.orders_created} max={data.funnel.events_sent || 1} />
              <FunnelBar label="Pagado" value={data.funnel.paid} max={data.funnel.events_sent || 1} />
            </div>
          </div>

          {/* Recent orders */}
          <div className="bg-white/5 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <p className="text-xs text-white/40">Órdenes recientes</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-white/30 border-b border-white/10">
                    <th className="text-left px-4 py-2">Referencia</th>
                    <th className="text-left px-4 py-2">Cliente</th>
                    <th className="text-right px-4 py-2">Total</th>
                    <th className="text-left px-4 py-2">Estado</th>
                    <th className="text-left px-4 py-2">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_orders.map((o) => (
                    <tr
                      key={o.reference}
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/admin/ordenes/${encodeURIComponent(o.reference)}`}
                          className="text-[#e63946] hover:underline font-mono text-xs"
                        >
                          {o.reference}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-white/70">{o.customer_name}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{fmt(o.total)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[o.status] || "bg-white/10 text-white/50"}`}>
                          {STATUS_LABEL[o.status] || o.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-white/40 text-xs">
                        {new Date(o.created_at).toLocaleDateString("es-CO")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div className={`rounded-lg p-4 ${warn ? "bg-yellow-500/5 border border-yellow-500/10" : "bg-white/5"}`}>
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className={`text-xl font-semibold ${warn ? "text-yellow-400" : "text-white"}`}>{value}</p>
      {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
    </div>
  );
}
