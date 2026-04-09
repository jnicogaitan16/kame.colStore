"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDashboard } from "@/lib/admin-api";
import type { DashboardData, OrderStatus } from "@/types/admin";

type DateRange = { start: string; end: string };

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pendiente", paid: "Pagado", shipped: "Enviado",
  cancelled: "Cancelado", refunded: "Reembolsado", created: "Creado",
};
const STATUS_COLOR: Record<OrderStatus, string> = {
  pending_payment: "bg-amber-50 text-amber-700 border border-amber-200",
  paid: "bg-green-50 text-green-700 border border-green-200",
  shipped: "bg-blue-50 text-blue-700 border border-blue-200",
  cancelled: "bg-red-50 text-red-600 border border-red-200",
  refunded: "bg-purple-50 text-purple-700 border border-purple-200",
  created: "bg-zinc-100 text-zinc-500 border border-zinc-200",
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}
function fmtCompactCOP(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
    notation: "compact",
    compactDisplay: "short",
  }).format(n);
}
function fmtShortDate(isoDate: string) {
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}
function todayISO() { return new Date().toISOString().split("T")[0]; }
function daysAgoISO(days: number) {
  const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().split("T")[0];
}

function xTickIndices(len: number, maxTicks: number): number[] {
  if (len <= 0) return [];
  if (len === 1) return [0];
  const k = Math.min(maxTicks, len);
  const idx = Array.from({ length: k }, (_, i) => Math.round((i / (k - 1)) * (len - 1)));
  return Array.from(new Set(idx));
}

function MiniLineChart({ data }: { data: { date: string; amount: number }[] }) {
  if (!data.length) return <div className="h-28 flex items-center justify-center text-zinc-400 text-xs">Sin datos en el período</div>;

  const maxVal = Math.max(...data.map((d) => d.amount), 1);
  const W = 520;
  const H = 132;
  const ML = 44;
  const MR = 10;
  const MT = 14;
  const MB = 36;
  const CW = W - ML - MR;
  const CH = H - MT - MB;

  const points = data.map((d, i) => {
    const x = ML + (i / Math.max(data.length - 1, 1)) * CW;
    const y = MT + CH - (d.amount / maxVal) * CH;
    return `${x},${y}`;
  });

  const xTicks = xTickIndices(data.length, 5);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[8.25rem]" preserveAspectRatio="xMidYMid meet">
        <text
          x={11}
          y={MT + CH / 2}
          textAnchor="middle"
          transform={`rotate(-90, 11, ${MT + CH / 2})`}
          className="fill-zinc-400"
          style={{ fontSize: "9px" }}
        >
          Ventas (COP)
        </text>
        <text x={ML - 4} y={MT + 12} textAnchor="end" className="fill-zinc-500" style={{ fontSize: "10px" }}>
          {fmtCompactCOP(maxVal)}
        </text>
        <text x={ML - 4} y={MT + CH} textAnchor="end" className="fill-zinc-500 text-[10px]" style={{ fontSize: "10px" }}>
          $0
        </text>
        <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke="#e4e4e7" strokeWidth="1" />
        <line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke="#e4e4e7" strokeWidth="1" />
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={`${ML},${MT + CH} ${points.join(" ")} ${ML + CW},${MT + CH}`}
          fill="url(#dash-grad)"
          opacity="0.12"
        />
        {xTicks.map((i) => {
          const x = ML + (i / Math.max(data.length - 1, 1)) * CW;
          return (
            <text
              key={i}
              x={x}
              y={H - 10}
              textAnchor="middle"
              className="fill-zinc-500 text-[9px]"
              style={{ fontSize: "9px" }}
            >
              {fmtShortDate(data[i].date)}
            </text>
          );
        })}
        <text x={ML + CW / 2} y={H - 2} textAnchor="middle" className="fill-zinc-400 text-[9px]" style={{ fontSize: "9px" }}>
          Fecha
        </text>
        <defs>
          <linearGradient id="dash-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function DashboardPage() {
  const [range, setRange] = useState<DateRange>({ start: daysAgoISO(7), end: todayISO() });
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true); setError("");
    getDashboard({ start: range.start, end: range.end })
      .then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [range]);

  return (
    <div className="space-y-6">
      {/* Header + date range picker */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Dashboard</h1>
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <input
            type="date"
            value={range.start}
            max={range.end}
            onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
            className="min-w-0 flex-1 sm:flex-none border border-red-400 bg-red-50 rounded-lg px-2 py-2 sm:py-1.5 text-sm sm:text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-red-400/30"
          />
          <span className="text-zinc-400 text-xs shrink-0">—</span>
          <input
            type="date"
            value={range.end}
            min={range.start}
            max={todayISO()}
            onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
            className="min-w-0 flex-1 sm:flex-none border border-red-400 bg-red-50 rounded-lg px-2 py-2 sm:py-1.5 text-sm sm:text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-red-400/30"
          />
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-zinc-100 rounded-lg animate-pulse" />)}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Ventas totales" value={fmt(data.total_revenue)} sub={`${data.order_count} órdenes`} />
            <KpiCard label="Venta promedio" value={fmt(data.avg_ticket)} />
            <KpiCard label="Conversión" value={`${data.conversion_rate}%`} sub="pagadas / creadas" />
            <KpiCard label="Revenue en riesgo" value={fmt(data.revenue_at_risk)} sub="pendientes de pago" warn />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white border border-zinc-200 rounded-xl p-4">
              <div className="mb-2">
                <p className="text-xs text-zinc-500 font-medium">Ventas diarias</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {fmtShortDate(data.start_date)} – {fmtShortDate(data.end_date)}
                  <span className="text-zinc-300 mx-1">·</span>
                  pagadas y enviadas
                </p>
              </div>
              <MiniLineChart data={data.daily_sales} />
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-3 font-medium">Top productos (unidades)</p>
              <div className="space-y-2.5">
                {data.top_products.length === 0 && <p className="text-zinc-400 text-xs">Sin datos</p>}
                {data.top_products.map((p, i) => {
                  const maxUnits = data.top_products[0]?.units || 1;
                  return (
                    <div key={p.product_id}>
                      <div className="flex justify-between text-xs text-zinc-600 mb-0.5">
                        <span className="truncate">{i + 1}. {p.name}</span>
                        <span className="ml-2 shrink-0 text-zinc-500">{p.units} uds</span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${(p.units / maxUnits) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-4 font-medium">Funnel de conversión</p>
            <div className="space-y-3">
              {[
                { label: "Add to cart (sesiones)", value: data.funnel.events_sent, max: data.funnel.events_sent || 1 },
                { label: "Orden creada", value: data.funnel.orders_created, max: data.funnel.events_sent || 1 },
                { label: "Pagado", value: data.funnel.paid, max: data.funnel.events_sent || 1 },
              ].map(({ label, value, max }) => {
                const pct = max ? Math.round((value / max) * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-zinc-600 mb-1">
                      <span>{label}</span>
                      <span className="text-zinc-500">{value.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-3 sm:px-4 py-3 border-b border-zinc-100">
              <p className="text-xs text-zinc-500 font-medium">Órdenes recientes</p>
            </div>
            <div className="md:hidden divide-y divide-zinc-100">
              {data.recent_orders.map((o) => (
                <div key={o.reference} className="p-4 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link
                      href={`/admin/ordenes/${encodeURIComponent(o.reference)}`}
                      className="text-red-600 hover:text-red-700 font-mono text-sm font-semibold break-all min-w-0"
                    >
                      {o.reference}
                    </Link>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                        STATUS_COLOR[o.status] || "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {STATUS_LABEL[o.status] || o.status}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-700 break-words">{o.customer_name}</p>
                  <div className="flex justify-between text-sm gap-2">
                    <span className="text-zinc-400">
                      {new Date(o.created_at).toLocaleDateString("es-CO")}
                    </span>
                    <span className="font-semibold text-zinc-900 tabular-nums">{fmt(o.total)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto overscroll-x-contain touch-pan-x">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-xs text-zinc-400 border-b border-zinc-100 bg-zinc-50">
                    <th className="text-left px-4 py-2 whitespace-nowrap">Referencia</th>
                    <th className="text-left px-4 py-2">Cliente</th>
                    <th className="text-right px-4 py-2 whitespace-nowrap">Total</th>
                    <th className="text-left px-4 py-2 whitespace-nowrap">Estado</th>
                    <th className="text-left px-4 py-2 whitespace-nowrap">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_orders.map((o) => (
                    <tr key={o.reference} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap align-top">
                        <Link
                          href={`/admin/ordenes/${encodeURIComponent(o.reference)}`}
                          className="text-red-500 hover:text-red-600 hover:underline font-mono text-xs"
                        >
                          {o.reference}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-700 text-xs max-w-[200px] break-words align-top">
                        {o.customer_name}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-xs text-zinc-900 whitespace-nowrap align-top">
                        {fmt(o.total)}
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            STATUS_COLOR[o.status] || "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {STATUS_LABEL[o.status] || o.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400 text-xs whitespace-nowrap align-top">
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

function KpiCard({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${warn ? "bg-amber-50 border-amber-200" : "bg-white border-zinc-200"}`}>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${warn ? "text-amber-700" : "text-zinc-900"}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}
