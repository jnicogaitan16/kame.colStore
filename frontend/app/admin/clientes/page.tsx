"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminCustomers } from "@/lib/admin-api";
import type { CustomerListItem } from "@/types/admin";

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

export default function ClientesPage() {
  const [data, setData] = useState<{
    count: number; page: number; total_pages: number; results: CustomerListItem[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    getAdminCustomers({ search, page })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, page]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Clientes</h1>
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/20 w-56"
        />
      </div>

      <div className="bg-white/5 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-white/30 border-b border-white/10">
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-right px-4 py-3">Lifetime Value</th>
                <th className="text-right px-4 py-3">Órdenes</th>
                <th className="text-left px-4 py-3">Última compra</th>
              </tr>
            </thead>
            <tbody>
              {loading && [...Array(6)].map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {[...Array(4)].map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 bg-white/10 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && data?.results.map((c) => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/clientes/${c.id}`}
                      className="text-white/80 hover:text-[#e63946] text-sm transition-colors"
                    >
                      {c.full_name || "(sin nombre)"}
                    </Link>
                    <p className="text-white/30 text-xs">{c.email}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-sm">{fmt(c.lifetime_value)}</td>
                  <td className="px-4 py-3 text-right text-white/60 text-xs">{c.order_count}</td>
                  <td className="px-4 py-3 text-white/40 text-xs">
                    {c.last_purchase ? new Date(c.last_purchase).toLocaleDateString("es-CO") : "—"}
                  </td>
                </tr>
              ))}
              {!loading && data?.results.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-white/30 text-sm">Sin clientes.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.total_pages > 1 && (
          <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between text-xs text-white/40">
            <span>Página {data.page} de {data.total_pages} · {data.count} clientes</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 bg-white/5 rounded disabled:opacity-30">← Anterior</button>
              <button disabled={page === data.total_pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 bg-white/5 rounded disabled:opacity-30">Siguiente →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
