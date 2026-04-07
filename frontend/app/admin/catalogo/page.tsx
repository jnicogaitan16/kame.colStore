"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminProducts, updateProduct, deleteProduct } from "@/lib/admin-api";
import type { AdminProduct } from "@/types/admin";

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

export default function CatalogoAdminPage() {
  const [data, setData] = useState<{ count: number; page: number; total_pages: number; results: AdminProduct[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState("");

  function load() {
    setLoading(true);
    getAdminProducts({ search, page })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [search, page]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function toggleActive(product: AdminProduct) {
    try {
      await updateProduct(product.id, { is_active: !product.is_active });
      setData((prev) =>
        prev
          ? { ...prev, results: prev.results.map((p) => p.id === product.id ? { ...p, is_active: !p.is_active } : p) }
          : prev
      );
      showToast(`Producto ${!product.is_active ? "activado" : "desactivado"}.`);
    } catch (e: any) {
      showToast(e?.payload?.error || "Error al actualizar.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Catálogo</h1>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/20 w-48"
          />
          <Link
            href="/admin/catalogo/nuevo"
            className="text-xs px-3 py-1.5 bg-[#e63946] text-white rounded-md hover:bg-[#e63946]/80 transition-colors whitespace-nowrap"
          >
            + Nuevo producto
          </Link>
        </div>
      </div>

      <div className="bg-white/5 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-white/30 border-b border-white/10">
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
                <tr key={i} className="border-b border-white/5">
                  {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-3 bg-white/10 rounded animate-pulse" /></td>)}
                </tr>
              ))}
              {!loading && data?.results.map((p) => (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {p.primary_image && (
                        <img src={p.primary_image} alt={p.name} className="w-8 h-8 rounded object-cover bg-white/5" />
                      )}
                      <div>
                        <p className="text-white/80 text-xs font-medium">{p.name}</p>
                        <p className="text-white/30 text-xs font-mono">{p.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs">{p.category_name}</td>
                  <td className="px-4 py-3 text-right text-xs">{fmt(p.price)}</td>
                  <td className="px-4 py-3 text-right text-xs">
                    <span className={p.total_stock <= 3 ? "text-red-400 font-semibold" : "text-white/60"}>
                      {p.total_stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-white/40 text-xs">{p.variant_count}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(p)}
                      className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                        p.is_active
                          ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                          : "bg-white/10 text-white/40 hover:bg-white/15"
                      }`}
                    >
                      {p.is_active ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/catalogo/${p.id}/editar`}
                        className="text-xs text-white/40 hover:text-white transition-colors"
                      >
                        Editar
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && data?.results.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-white/30 text-sm">Sin productos.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data && data.total_pages > 1 && (
          <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between text-xs text-white/40">
            <span>Página {data.page} de {data.total_pages} · {data.count} productos</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 bg-white/5 rounded disabled:opacity-30">← Anterior</button>
              <button disabled={page === data.total_pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 bg-white/5 rounded disabled:opacity-30">Siguiente →</button>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 bg-white/10 backdrop-blur border border-white/10 rounded-lg px-4 py-2 text-sm text-white">
          {toast}
        </div>
      )}
    </div>
  );
}
