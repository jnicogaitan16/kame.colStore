"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminOrders } from "@/lib/admin-api";
import type { OrderListItem, OrderStatus, PaginatedOrders } from "@/types/admin";

const STATUSES: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "pending_payment", label: "Pendiente" },
  { value: "paid", label: "Pagado" },
  { value: "shipped", label: "Enviado" },
  { value: "cancelled", label: "Cancelado" },
];

const STATUS_BADGE: Record<string, string> = {
  paid: "bg-green-500/20 text-green-400",
  pending_payment: "bg-yellow-500/20 text-yellow-400",
  shipped: "bg-blue-500/20 text-blue-400",
  cancelled: "bg-red-500/20 text-red-400",
  refunded: "bg-purple-500/20 text-purple-400",
  created: "bg-white/10 text-white/50",
};
const STATUS_LABELS: Record<string, string> = {
  paid: "Pagado", pending_payment: "Pendiente", shipped: "Enviado",
  cancelled: "Cancelado", refunded: "Reembolsado", created: "Creado",
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

export default function OrdenesPage() {
  const [filters, setFilters] = useState({ status: "", start: "", end: "", search: "" });
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

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Órdenes</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Status tabs */}
        <div className="flex gap-1">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setFilter("status", s.value)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                filters.status === s.value
                  ? "bg-[#e63946] text-white"
                  : "bg-white/5 text-white/50 hover:bg-white/10"
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
          className="bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/20 w-52"
        />
        <input
          type="date"
          value={filters.start}
          onChange={(e) => setFilter("start", e.target.value)}
          className="bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white/20"
        />
        <input
          type="date"
          value={filters.end}
          onChange={(e) => setFilter("end", e.target.value)}
          className="bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white/20"
        />
      </div>

      {/* Table */}
      <div className="bg-white/5 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-white/30 border-b border-white/10">
                <th className="text-left px-4 py-3">Referencia</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Productos</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Pago</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="text-left px-4 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-white/10 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading &&
                data?.results.map((o) => (
                  <tr key={o.reference} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/ordenes/${encodeURIComponent(o.reference)}`}
                        className="text-[#e63946] hover:underline font-mono text-xs"
                      >
                        {o.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white/80 text-xs">{o.customer_name}</p>
                      <p className="text-white/30 text-xs">{o.customer_email}</p>
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs max-w-[200px] truncate">{o.items_summary}</td>
                    <td className="px-4 py-3 text-right font-medium text-xs">{fmt(o.total)}</td>
                    <td className="px-4 py-3 text-white/40 text-xs capitalize">{o.payment_method}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[o.status] || "bg-white/10 text-white/40"}`}>
                        {STATUS_LABELS[o.status] || o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs">
                      {new Date(o.created_at).toLocaleDateString("es-CO")}
                    </td>
                  </tr>
                ))}
              {!loading && data?.results.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-white/30 text-sm">
                    No hay órdenes para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between text-xs text-white/40">
            <span>
              Página {data.page} de {data.total_pages} · {data.count} órdenes
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 bg-white/5 rounded disabled:opacity-30 hover:bg-white/10"
              >
                ← Anterior
              </button>
              <button
                disabled={page === data.total_pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 bg-white/5 rounded disabled:opacity-30 hover:bg-white/10"
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
