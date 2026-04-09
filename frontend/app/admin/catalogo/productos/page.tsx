"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminProducts, updateProduct } from "@/lib/admin-api";
import type { AdminProduct } from "@/types/admin";

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

export default function AdminProductosPage() {
  const [data, setData] = useState<{ count: number; page: number; total_pages: number; results: AdminProduct[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function load() {
    setLoading(true);
    getAdminProducts({ search, page }).then(setData).catch(console.error).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [search, page]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  }

  async function toggleActive(product: AdminProduct) {
    try {
      await updateProduct(product.id, { is_active: !product.is_active });
      setData((prev) => prev
        ? { ...prev, results: prev.results.map((p) => p.id === product.id ? { ...p, is_active: !p.is_active } : p) }
        : prev
      );
      showToast(`Producto ${!product.is_active ? "activado" : "desactivado"}.`);
    } catch (e: any) {
      showToast(e?.payload?.error || "Error al actualizar.", false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <Link href="/admin/catalogo" className="hover:text-zinc-700">Catálogo</Link>
        <span>/</span>
        <span className="text-zinc-900 font-medium">Productos</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Productos</h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="bg-white border border-zinc-300 rounded-lg px-3 py-2 sm:py-1.5 text-sm sm:text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/20 w-full sm:w-48 min-w-0"
          />
          <Link
            href="/admin/catalogo/productos/nuevo"
            className="text-center text-sm sm:text-xs px-4 py-2.5 sm:py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium shrink-0"
          >
            + Nuevo producto
          </Link>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="md:hidden divide-y divide-zinc-100">
          {loading &&
            [...Array(4)].map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <div className="h-4 bg-zinc-100 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-zinc-100 rounded animate-pulse w-1/2" />
              </div>
            ))}
          {!loading &&
            data?.results.map((p) => (
              <div key={p.id} className="p-4 space-y-3">
                <div className="flex gap-3">
                  {p.primary_image ? (
                    <img
                      src={p.primary_image}
                      alt={p.name}
                      className="w-14 h-14 rounded-lg object-cover bg-zinc-100 border border-zinc-200 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-zinc-100 border border-zinc-200 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-zinc-900 text-sm break-words">{p.name}</p>
                    <p className="text-xs text-zinc-400 font-mono break-all">{p.slug}</p>
                    <p className="text-xs text-zinc-500 mt-1">{p.category_name}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-zinc-600">
                  <span className="font-medium text-zinc-900 tabular-nums">{fmt(p.price)}</span>
                  <span>
                    Stock:{" "}
                    <span className={p.total_stock <= 3 ? "text-red-600 font-bold" : "font-medium"}>
                      {p.total_stock}
                    </span>
                  </span>
                  <span>{p.variant_count} variantes</span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => toggleActive(p)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      p.is_active
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-zinc-100 text-zinc-600 border-zinc-200"
                    }`}
                  >
                    {p.is_active ? "Activo" : "Inactivo"}
                  </button>
                  <Link
                    href={`/admin/catalogo/productos/${p.id}/editar`}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  >
                    Editar
                  </Link>
                </div>
              </div>
            ))}
          {!loading && data?.results.length === 0 && (
            <p className="p-6 text-center text-zinc-400 text-sm">Sin productos.</p>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto overscroll-x-contain touch-pan-x">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-xs text-zinc-500 border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3">Producto</th>
                <th className="text-left px-4 py-3">Categoría</th>
                <th className="text-right px-4 py-3">Precio</th>
                <th className="text-right px-4 py-3">Stock</th>
                <th className="text-right px-4 py-3">Variantes</th>
                <th className="text-center px-4 py-3">Estado</th>
                <th className="text-left px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-zinc-100">
                  {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-3 bg-zinc-100 rounded animate-pulse" /></td>)}
                </tr>
              ))}
              {!loading && data?.results.map((p) => (
                <tr key={p.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {p.primary_image && (
                        <img src={p.primary_image} alt={p.name} className="w-9 h-9 rounded-lg object-cover bg-zinc-100 border border-zinc-200" />
                      )}
                      <div>
                        <p className="text-zinc-900 text-xs font-semibold">{p.name}</p>
                        <p className="text-zinc-400 text-xs font-mono">{p.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{p.category_name}</td>
                  <td className="px-4 py-3 text-right text-xs font-medium text-zinc-900">{fmt(p.price)}</td>
                  <td className="px-4 py-3 text-right text-xs">
                    <span className={p.total_stock <= 3 ? "text-red-600 font-bold" : "text-zinc-600"}>
                      {p.total_stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-500 text-xs">{p.variant_count}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActive(p)}
                      className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                        p.is_active
                          ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                          : "bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200"
                      }`}>
                      {p.is_active ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/catalogo/productos/${p.id}/editar`}
                      className="text-xs text-zinc-500 hover:text-zinc-900 font-medium transition-colors">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
              {!loading && data?.results.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-400 text-sm">Sin productos.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.total_pages > 1 && (
          <div className="px-3 sm:px-4 py-3 border-t border-zinc-100 bg-zinc-50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-zinc-500">
            <span className="text-center sm:text-left">
              Página {data.page} de {data.total_pages} · {data.count} productos
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

      {toast && (
        <div
          className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:max-w-md border rounded-xl px-4 py-2.5 text-sm shadow-md z-50 ${
            toast.ok ? "bg-white border-zinc-200 text-zinc-800" : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
