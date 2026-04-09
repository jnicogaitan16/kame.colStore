"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminOrders } from "@/lib/admin-api";
import type { PaginatedOrders } from "@/types/admin";

const STATUSES = [
  { value: "", label: "Todos" },
  { value: "pending_payment", label: "Pendiente" },
  { value: "paid", label: "Pagado" },
  { value: "shipped", label: "Enviado" },
  { value: "cancelled", label: "Cancelado" },
];

const STATUS_BADGE: Record<string, string> = {
  paid: "bg-green-50 text-green-700 border border-green-200",
  pending_payment: "bg-amber-50 text-amber-700 border border-amber-200",
  shipped: "bg-blue-50 text-blue-700 border border-blue-200",
  cancelled: "bg-red-50 text-red-600 border border-red-200",
  refunded: "bg-purple-50 text-purple-700 border border-purple-200",
  created: "bg-zinc-100 text-zinc-500 border border-zinc-200",
};

const STATUS_LABELS: Record<string, string> = {
  paid: "Pagado",
  pending_payment: "Pendiente",
  shipped: "Enviado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  created: "Creado",
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);
}

// 🔥 mismos helpers que dashboard
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

export default function OrdenesPage() {
  // 🔥 default últimos 7 días
  const [filters, setFilters] = useState({
    status: "",
    start: daysAgoISO(7),
    end: todayISO(),
    search: "",
  });

  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedOrders | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAdminOrders({ ...filters, page })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters, page]);

  function setFilter(key: string, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  const INPUT =
    "bg-white border border-zinc-300 rounded-lg px-3 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/20";

  return (
    <div className="space-y-4">
      {/* 🔥 HEADER CON FECHAS (igual dashboard) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Órdenes</h1>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <input
            type="date"
            value={filters.start}
            max={filters.end}
            onChange={(e) => setFilter("start", e.target.value)}
            className="min-w-0 flex-1 sm:flex-none border border-red-400 bg-red-50 rounded-lg px-2 py-2 sm:py-1.5 text-sm sm:text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-red-400/30"
          />
          <span className="text-zinc-400 text-xs shrink-0">—</span>
          <input
            type="date"
            value={filters.end}
            min={filters.start}
            max={todayISO()}
            onChange={(e) => setFilter("end", e.target.value)}
            className="min-w-0 flex-1 sm:flex-none border border-red-400 bg-red-50 rounded-lg px-2 py-2 sm:py-1.5 text-sm sm:text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-red-400/30"
          />
        </div>
      </div>

      {/* 🔥 FILTROS LIMPIOS */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setFilter("status", s.value)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors border ${
                filters.status === s.value
                  ? "bg-red-500 text-white border-red-500"
                  : "bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Buscar referencia o cliente..."
          value={filters.search}
          onChange={(e) => setFilter("search", e.target.value)}
          className={`${INPUT} w-full sm:w-52 min-w-0 flex-1 sm:flex-none`}
        />
      </div>

      {/* TABLE */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="md:hidden divide-y divide-zinc-100">
          {loading &&
            [...Array(4)].map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <div className="h-4 bg-zinc-100 rounded animate-pulse w-2/3" />
                <div className="h-3 bg-zinc-100 rounded animate-pulse w-1/2" />
              </div>
            ))}
          {!loading &&
            data?.results.map((o) => (
              <div key={o.reference} className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link
                    href={`/admin/ordenes/${encodeURIComponent(o.reference)}`}
                    className="text-red-600 hover:text-red-700 font-mono text-sm font-semibold break-all min-w-0"
                  >
                    {o.reference}
                  </Link>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      STATUS_BADGE[o.status] || "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                </div>
                <div className="text-xs space-y-1">
                  <p className="font-medium text-zinc-800 break-words">{o.customer_name}</p>
                  <p className="text-zinc-400 break-all">{o.customer_email}</p>
                  <p className="text-zinc-500 break-words">{o.items_summary}</p>
                </div>
                <div className="flex flex-wrap justify-between gap-2 text-xs text-zinc-500">
                  <span className="capitalize">{o.payment_method}</span>
                  <span className="tabular-nums font-semibold text-zinc-900">{fmt(o.total)}</span>
                </div>
                <p className="text-xs text-zinc-400">
                  {new Date(o.created_at).toLocaleDateString("es-CO")}
                </p>
              </div>
            ))}
          {!loading && data?.results.length === 0 && (
            <p className="p-6 text-center text-zinc-400 text-sm">No hay órdenes para los filtros seleccionados.</p>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto overscroll-x-contain touch-pan-x">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-xs text-zinc-500 border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 whitespace-nowrap">Referencia</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Productos</th>
                <th className="text-right px-4 py-3 whitespace-nowrap">Total</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Pago</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Estado</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Fecha</th>
              </tr>
            </thead>

            <tbody>
              {loading &&
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-zinc-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading &&
                data?.results.map((o) => (
                  <tr
                    key={o.reference}
                    className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap align-top">
                      <Link
                        href={`/admin/ordenes/${encodeURIComponent(o.reference)}`}
                        className="text-red-500 hover:text-red-600 hover:underline font-mono text-xs"
                      >
                        {o.reference}
                      </Link>
                    </td>

                    <td className="px-4 py-3 max-w-[200px] align-top">
                      <p className="text-zinc-800 text-xs font-medium break-words">{o.customer_name}</p>
                      <p className="text-zinc-400 text-xs break-all">{o.customer_email}</p>
                    </td>

                    <td className="px-4 py-3 text-zinc-500 text-xs max-w-[220px] break-words align-top">
                      {o.items_summary}
                    </td>

                    <td className="px-4 py-3 text-right font-semibold text-xs text-zinc-900 whitespace-nowrap align-top">
                      {fmt(o.total)}
                    </td>

                    <td className="px-4 py-3 text-zinc-500 text-xs capitalize whitespace-nowrap align-top">
                      {o.payment_method}
                    </td>

                    <td className="px-4 py-3 align-top">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          STATUS_BADGE[o.status] ||
                          "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap align-top">
                      {new Date(o.created_at).toLocaleDateString("es-CO")}
                    </td>
                  </tr>
                ))}

              {!loading && data?.results.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-zinc-400 text-sm"
                  >
                    No hay órdenes para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.total_pages > 1 && (
          <div className="px-3 sm:px-4 py-3 border-t border-zinc-100 bg-zinc-50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-zinc-500">
            <span className="text-center sm:text-left">
              Página {data.page} de {data.total_pages} · {data.count} órdenes
            </span>

            <div className="flex gap-2 justify-center sm:justify-end">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 bg-white border border-zinc-300 rounded-lg disabled:opacity-40 hover:bg-zinc-50 transition-colors"
              >
                ← Anterior
              </button>

              <button
                type="button"
                disabled={page === data.total_pages}
                onClick={() => setPage((p) => p + 1)}
                className="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 bg-white border border-zinc-300 rounded-lg disabled:opacity-40 hover:bg-zinc-50 transition-colors"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}