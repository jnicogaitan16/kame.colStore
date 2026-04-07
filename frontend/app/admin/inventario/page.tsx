"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { getInventory, updateInventoryStock } from "@/lib/admin-api";
import type { InventoryPoolItem } from "@/types/admin";

export default function InventarioPage() {
  const [items, setItems] = useState<InventoryPoolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function loadInventory() {
    setLoading(true);
    getInventory({ search })
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadInventory(); }, [search]);

  useEffect(() => {
    if (editId !== null) inputRef.current?.focus();
  }, [editId]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  function startEdit(item: InventoryPoolItem) {
    setEditId(item.pool_id);
    setEditValue(String(item.quantity));
  }

  async function commitEdit(item: InventoryPoolItem) {
    const newStock = parseInt(editValue, 10);
    if (isNaN(newStock) || newStock < 0 || newStock === item.quantity) {
      setEditId(null);
      return;
    }
    setSaving(true);
    try {
      await updateInventoryStock(item.pool_id, newStock, "Ajuste manual desde admin");
      setItems((prev) =>
        prev.map((p) => (p.pool_id === item.pool_id ? { ...p, quantity: newStock, low_stock: newStock <= 3 } : p))
      );
      showToast("Stock actualizado.");
    } catch (e: any) {
      showToast(e?.payload?.error || "Error al actualizar.");
    } finally {
      setSaving(false);
      setEditId(null);
    }
  }

  const filtered = search
    ? items.filter((i) =>
        i.category_name.toLowerCase().includes(search.toLowerCase()) ||
        i.value.toLowerCase().includes(search.toLowerCase()) ||
        i.color.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Inventario</h1>
        <input
          type="text"
          placeholder="Buscar categoría o producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/20 w-52"
        />
      </div>

      <div className="bg-white/5 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-white/30 border-b border-white/10">
                <th className="text-left px-4 py-3">Categoría</th>
                <th className="text-left px-4 py-3">Talla</th>
                <th className="text-left px-4 py-3">Color</th>
                <th className="text-right px-4 py-3">Stock disponible</th>
                <th className="text-left px-4 py-3">Historial</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    {[...Array(5)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-white/10 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading &&
                filtered.map((item) => (
                  <tr
                    key={item.pool_id}
                    className={`border-b border-white/5 ${item.low_stock ? "bg-red-500/5" : ""}`}
                  >
                    <td className="px-4 py-3 text-white/80 text-xs">{item.category_name}</td>
                    <td className="px-4 py-3 text-white/60 text-xs font-mono">{item.value || "—"}</td>
                    <td className="px-4 py-3 text-white/60 text-xs">{item.color || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {editId === item.pool_id ? (
                        <input
                          ref={inputRef}
                          type="number"
                          min={0}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => commitEdit(item)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit(item);
                            if (e.key === "Escape") setEditId(null);
                          }}
                          disabled={saving}
                          className="w-20 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-xs text-right text-white focus:outline-none focus:border-[#e63946]/50"
                        />
                      ) : (
                        <button
                          onClick={() => startEdit(item)}
                          className={`text-xs font-mono px-2 py-0.5 rounded hover:bg-white/10 transition-colors ${
                            item.low_stock ? "text-red-400 font-semibold" : "text-white/70"
                          }`}
                          title="Click para editar"
                        >
                          {item.quantity}
                          {item.low_stock && " ⚠"}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/inventario/${item.pool_id}/historial`}
                        className="text-xs text-white/30 hover:text-[#e63946] transition-colors"
                      >
                        Ver historial →
                      </Link>
                    </td>
                  </tr>
                ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-white/30 text-sm">
                    No hay entradas de inventario.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-white/30">
        Click en el stock para editar inline. Presiona Enter para guardar, Esc para cancelar.
      </p>

      {toast && (
        <div className="fixed bottom-5 right-5 bg-white/10 backdrop-blur border border-white/10 rounded-lg px-4 py-2 text-sm text-white">
          {toast}
        </div>
      )}
    </div>
  );
}
