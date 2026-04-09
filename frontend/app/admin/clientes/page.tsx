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
    getAdminCustomers({ search, page }).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [search, page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Clientes</h1>
        <input
          type="text"
          placeholder="Nombre, email o documento…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="bg-white border border-zinc-300 rounded-lg px-3 py-2 sm:py-1.5 text-sm sm:text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/20 w-full sm:w-56 min-w-0"
        />
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="md:hidden divide-y divide-zinc-100">
          {loading &&
            [...Array(5)].map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <div className="h-4 bg-zinc-100 rounded animate-pulse w-2/3" />
                <div className="h-3 bg-zinc-100 rounded animate-pulse w-1/2" />
              </div>
            ))}
          {!loading &&
            data?.results.map((c) => (
              <div key={c.id} className="p-4 space-y-2">
                <Link
                  href={`/admin/clientes/${c.id}`}
                  className="text-base font-medium text-zinc-900 hover:text-red-500 transition-colors break-words block"
                >
                  {c.full_name || "(sin nombre)"}
                </Link>
                <p className="text-sm text-zinc-500 break-all">{c.email}</p>
                {c.phone ? <p className="text-sm text-zinc-500">{c.phone}</p> : null}
                <dl className="grid grid-cols-2 gap-2 pt-1 text-xs text-zinc-600">
                  <div>
                    <dt className="text-zinc-400">LTV</dt>
                    <dd className="font-bold text-zinc-900 tabular-nums">{fmt(c.lifetime_value)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-400">Órdenes</dt>
                    <dd className="tabular-nums">{c.order_count}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-zinc-400">Registro</dt>
                    <dd>
                      {c.created_at
                        ? new Date(c.created_at).toLocaleString("es-CO", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-zinc-400">Última compra</dt>
                    <dd>
                      {c.last_purchase ? new Date(c.last_purchase).toLocaleDateString("es-CO") : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          {!loading && data?.results.length === 0 && (
            <p className="p-6 text-center text-zinc-400 text-sm">Sin clientes.</p>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto overscroll-x-contain touch-pan-x">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-xs text-zinc-500 border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Registro</th>
                <th className="text-right px-4 py-3 whitespace-nowrap">Lifetime Value</th>
                <th className="text-right px-4 py-3 whitespace-nowrap">Órdenes</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Última compra</th>
              </tr>
            </thead>
            <tbody>
              {loading && [...Array(6)].map((_, i) => (
                <tr key={i} className="border-b border-zinc-100">
                  {[...Array(5)].map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 bg-zinc-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
              {!loading &&
                data?.results.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 max-w-[220px]">
                      <Link
                        href={`/admin/clientes/${c.id}`}
                        className="text-zinc-900 hover:text-red-500 text-sm font-medium transition-colors break-words"
                      >
                        {c.full_name || "(sin nombre)"}
                      </Link>
                      <p className="text-zinc-400 text-xs break-all">{c.email}</p>
                      {c.phone && <p className="text-zinc-400 text-xs">{c.phone}</p>}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap align-top">
                      {c.created_at
                        ? new Date(c.created_at).toLocaleString("es-CO", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-sm text-zinc-900 whitespace-nowrap align-top">
                      {fmt(c.lifetime_value)}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-600 text-xs align-top">{c.order_count}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap align-top">
                      {c.last_purchase ? new Date(c.last_purchase).toLocaleDateString("es-CO") : "—"}
                    </td>
                  </tr>
                ))}
              {!loading && data?.results.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-400 text-sm">
                    Sin clientes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.total_pages > 1 && (
          <div className="px-3 sm:px-4 py-3 border-t border-zinc-100 bg-zinc-50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-zinc-500">
            <span className="text-center sm:text-left">
              Página {data.page} de {data.total_pages} · {data.count} clientes
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
