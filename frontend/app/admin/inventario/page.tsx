"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getInventory,
  updateInventoryStock,
  createInventoryPool,
  bulkInventoryLoad,
  deleteInventoryPool,
  getAdminCategories,
} from "@/lib/admin-api";
import type { InventoryPoolItem, AdminCategory } from "@/types/admin";

type AdjustModal = { item: InventoryPoolItem; newStock: string; reason: string };

type CreateForm = {
  category_id: string;
  value: string;
  color: string;
  quantity: string;
  is_active: boolean;
};

type BulkForm = {
  category_id: string;
  lines: string;
  add_to_existing: boolean;
};

function formatPayloadErrors(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Error desconocido";
  const p = payload as Record<string, unknown>;
  if (typeof p.error === "string") return p.error;
  const errs = p.errors;
  if (errs && typeof errs === "object" && errs !== null) {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(errs as Record<string, unknown>)) {
      const msg = Array.isArray(v) ? (v as string[]).join(" ") : String(v);
      parts.push(`${k}: ${msg}`);
    }
    if (parts.length) return parts.join(" · ");
  }
  return "No se pudo completar la operación.";
}

export default function InventarioPage() {
  const [items, setItems] = useState<InventoryPoolItem[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<AdjustModal | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    category_id: "",
    value: "",
    color: "",
    quantity: "0",
    is_active: true,
  });
  const [bulkForm, setBulkForm] = useState<BulkForm>({
    category_id: "",
    lines: "",
    add_to_existing: false,
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const leafCategories = categories.filter((c) => c.is_leaf);

  function loadInventory() {
    setLoading(true);
    getInventory({ search: search.trim() || undefined })
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadInventory();
  }, [search]);

  useEffect(() => {
    getAdminCategories({ include_inactive: true })
      .then(setCategories)
      .catch(console.error);
  }, []);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSave() {
    if (!modal) return;
    const newStock = parseInt(modal.newStock, 10);
    if (isNaN(newStock) || newStock < 0) {
      showToast("Stock debe ser un número no negativo.", false);
      return;
    }
    if (!modal.reason.trim()) {
      showToast("Ingresa el motivo del ajuste.", false);
      return;
    }
    setSaving(true);
    try {
      await updateInventoryStock(modal.item.pool_id, newStock, modal.reason.trim());
      setItems((prev) =>
        prev.map((p) =>
          p.pool_id === modal.item.pool_id ? { ...p, quantity: newStock, low_stock: newStock <= 3 } : p
        )
      );
      showToast("Stock actualizado.");
      setModal(null);
    } catch (e: unknown) {
      const err = e as { payload?: unknown };
      showToast(formatPayloadErrors(err?.payload), false);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    const cid = parseInt(createForm.category_id, 10);
    if (!cid) {
      showToast("Elige una categoría (hoja).", false);
      return;
    }
    const qty = parseInt(createForm.quantity, 10);
    if (isNaN(qty) || qty < 0) {
      showToast("Cantidad inválida.", false);
      return;
    }
    setSaving(true);
    try {
      const created = await createInventoryPool({
        category_id: cid,
        value: createForm.value.trim(),
        color: createForm.color.trim(),
        quantity: qty,
        is_active: createForm.is_active,
      });
      setItems((prev) => [...prev, created].sort((a, b) => a.category_name.localeCompare(b.category_name)));
      showToast("Entrada de inventario creada.");
      setCreateOpen(false);
      setCreateForm({ category_id: "", value: "", color: "", quantity: "0", is_active: true });
    } catch (e: unknown) {
      const err = e as { payload?: unknown };
      showToast(formatPayloadErrors(err?.payload), false);
    } finally {
      setSaving(false);
    }
  }

  async function handleBulk() {
    const cid = parseInt(bulkForm.category_id, 10);
    if (!cid) {
      showToast("Elige una categoría (hoja).", false);
      return;
    }
    if (!bulkForm.lines.trim()) {
      showToast("Pega o escribe al menos una línea.", false);
      return;
    }
    setSaving(true);
    try {
      const res = await bulkInventoryLoad({
        category_id: cid,
        lines: bulkForm.lines,
        add_to_existing: bulkForm.add_to_existing,
      });
      const errMsg = res.errors?.length ? ` · Avisos: ${res.errors.slice(0, 5).join("; ")}` : "";
      showToast(`Carga masiva: ${res.created} creados, ${res.updated} actualizados.${errMsg}`, !res.errors?.length);
      setBulkOpen(false);
      setBulkForm({ category_id: "", lines: "", add_to_existing: false });
      loadInventory();
    } catch (e: unknown) {
      const err = e as { payload?: unknown };
      showToast(formatPayloadErrors(err?.payload), false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: InventoryPoolItem) {
    const label = [item.category_name, item.value, item.color].filter(Boolean).join(" / ");
    if (!confirm(`¿Eliminar esta entrada de inventario?\n${label}`)) return;
    try {
      await deleteInventoryPool(item.pool_id);
      setItems((prev) => prev.filter((p) => p.pool_id !== item.pool_id));
      showToast("Entrada eliminada.");
    } catch (e: unknown) {
      const err = e as { payload?: unknown };
      showToast(formatPayloadErrors(err?.payload), false);
    }
  }

  const lowStockCount = items.filter((i) => i.low_stock).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="text-lg font-semibold text-zinc-900">Inventario</h1>
          {lowStockCount > 0 && (
            <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">
              {lowStockCount} bajo stock
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex-1 sm:flex-none text-xs font-medium px-3 py-2.5 sm:py-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors text-center"
            >
              Nueva entrada
            </button>
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="flex-1 sm:flex-none text-xs font-medium px-3 py-2.5 sm:py-1.5 rounded-lg bg-white border border-zinc-300 text-zinc-800 hover:bg-zinc-50 transition-colors text-center"
            >
              Carga masiva
            </button>
          </div>
          <input
            type="text"
            placeholder="Buscar categoría, talla o color..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white border border-zinc-300 rounded-lg px-3 py-2 sm:py-1.5 text-sm sm:text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/20 w-full sm:w-56 min-w-0"
          />
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="md:hidden divide-y divide-zinc-100">
          {loading &&
            [...Array(5)].map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <div className="h-4 bg-zinc-100 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-zinc-100 rounded animate-pulse w-1/2" />
              </div>
            ))}
          {!loading &&
            items.map((item) => (
              <div
                key={item.pool_id}
                className={`p-4 space-y-3 ${item.low_stock ? "bg-red-50/50" : ""}`}
              >
                <div className="flex justify-between gap-2 items-start">
                  <p className="font-medium text-zinc-900 text-sm break-words">{item.category_name}</p>
                  <span
                    className={`text-sm font-mono font-bold tabular-nums shrink-0 ${
                      item.low_stock ? "text-red-600" : "text-zinc-800"
                    }`}
                  >
                    {item.quantity} u.
                  </span>
                </div>
                <p className="text-xs text-zinc-600">
                  <span className="font-mono">{item.value || "—"}</span>
                  {" · "}
                  <span>{item.color || "—"}</span>
                </p>
                {item.low_stock ? (
                  <span className="inline-block text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">
                    ⚠ Bajo stock
                  </span>
                ) : (
                  <span className="text-xs text-green-600 font-medium">OK</span>
                )}
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setModal({ item, newStock: String(item.quantity), reason: "" })}
                    className="w-full text-sm py-2 rounded-lg border border-zinc-200 text-zinc-800 font-medium hover:bg-zinc-50"
                  >
                    Ajustar stock
                  </button>
                  <Link
                    href={`/admin/inventario/${item.pool_id}/historial`}
                    className="block w-full text-center text-sm py-2 rounded-lg bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                  >
                    Ver historial
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="w-full text-sm py-2 text-red-600 font-medium"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          {!loading && items.length === 0 && (
            <p className="p-6 text-center text-zinc-400 text-sm">No hay entradas de inventario.</p>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto overscroll-x-contain touch-pan-x">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-xs text-zinc-500 border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3">Categoría</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Talla</th>
                <th className="text-left px-4 py-3">Color</th>
                <th className="text-right px-4 py-3 whitespace-nowrap">Stock</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Estado</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                [...Array(8)].map((_, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-zinc-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading &&
                items.map((item) => (
                  <tr
                    key={item.pool_id}
                    className={`border-b border-zinc-100 hover:bg-zinc-50 transition-colors ${
                      item.low_stock ? "bg-red-50/40" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-zinc-800 text-xs font-medium max-w-[180px] break-words align-top">
                      {item.category_name}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs font-mono whitespace-nowrap align-top">
                      {item.value || "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs align-top">{item.color || "—"}</td>
                    <td className="px-4 py-3 text-right align-top">
                      <span
                        className={`text-xs font-mono font-semibold ${
                          item.low_stock ? "text-red-600" : "text-zinc-700"
                        }`}
                      >
                        {item.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {item.low_stock ? (
                        <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">
                          ⚠ Bajo stock
                        </span>
                      ) : (
                        <span className="text-xs text-green-600 font-medium">OK</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <button
                          type="button"
                          onClick={() => setModal({ item, newStock: String(item.quantity), reason: "" })}
                          className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors font-medium"
                        >
                          Ajustar
                        </button>
                        <Link
                          href={`/admin/inventario/${item.pool_id}/historial`}
                          className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
                        >
                          Historial →
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="text-xs text-red-500/80 hover:text-red-600 transition-colors font-medium"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-sm">
                    No hay entradas de inventario.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {!loading && (
          <div className="px-4 py-2 border-t border-zinc-100 bg-zinc-50 text-xs text-zinc-400">
            {items.length} entradas
          </div>
        )}
      </div>

      {/* Adjustment Modal */}
      {modal && (
        <div className="fixed inset-0 bg-zinc-950/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-zinc-900">Ajustar stock</h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="text-zinc-400 hover:text-zinc-700 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 mb-4 text-xs space-y-1">
              <p>
                <span className="text-zinc-400">Categoría:</span>{" "}
                <span className="text-zinc-700 font-medium">{modal.item.category_name}</span>
              </p>
              {modal.item.value && (
                <p>
                  <span className="text-zinc-400">Talla:</span>{" "}
                  <span className="font-mono text-zinc-700">{modal.item.value}</span>
                </p>
              )}
              {modal.item.color && (
                <p>
                  <span className="text-zinc-400">Color:</span>{" "}
                  <span className="text-zinc-700">{modal.item.color}</span>
                </p>
              )}
              <p>
                <span className="text-zinc-400">Stock actual:</span>{" "}
                <span className={`font-mono font-bold ${modal.item.low_stock ? "text-red-600" : "text-zinc-900"}`}>
                  {modal.item.quantity}
                </span>
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Nueva cantidad *</label>
                <input
                  type="number"
                  min={0}
                  value={modal.newStock}
                  autoFocus
                  onChange={(e) => setModal({ ...modal, newStock: e.target.value })}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/20"
                />
                {modal.newStock !== "" &&
                  !isNaN(parseInt(modal.newStock, 10)) &&
                  parseInt(modal.newStock, 10) !== modal.item.quantity && (
                    <p className="text-xs mt-1">
                      {parseInt(modal.newStock, 10) > modal.item.quantity ? (
                        <span className="text-green-600 font-medium">
                          +{parseInt(modal.newStock, 10) - modal.item.quantity} unidades
                        </span>
                      ) : (
                        <span className="text-red-600 font-medium">
                          {parseInt(modal.newStock, 10) - modal.item.quantity} unidades
                        </span>
                      )}
                    </p>
                  )}
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Motivo del ajuste *</label>
                <input
                  type="text"
                  value={modal.reason}
                  onChange={(e) => setModal({ ...modal, reason: e.target.value })}
                  placeholder="Ej: Devolución cliente, recepción mercancía..."
                  className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/20"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="flex-1 text-sm py-2.5 bg-white border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !modal.reason.trim() || modal.newStock === ""}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-sm py-2.5 rounded-lg transition-colors"
              >
                {saving ? "Guardando..." : "Confirmar ajuste"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-zinc-950/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-zinc-900">Nueva entrada de inventario</h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              Categoría debe ser hoja (como en Django admin). Talla y color se normalizan al guardar.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Categoría *</label>
                <select
                  value={createForm.category_id}
                  onChange={(e) => setCreateForm({ ...createForm, category_id: e.target.value })}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900"
                >
                  <option value="">— Elegir —</option>
                  {leafCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.department} / {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Talla / valor</label>
                <input
                  value={createForm.value}
                  onChange={(e) => setCreateForm({ ...createForm, value: e.target.value })}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900"
                  placeholder="Ej: M, 32"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Color</label>
                <input
                  value={createForm.color}
                  onChange={(e) => setCreateForm({ ...createForm, color: e.target.value })}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900"
                  placeholder="Ej: Negro"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Cantidad *</label>
                <input
                  type="number"
                  min={0}
                  value={createForm.quantity}
                  onChange={(e) => setCreateForm({ ...createForm, quantity: e.target.value })}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-700">
                <input
                  type="checkbox"
                  checked={createForm.is_active}
                  onChange={(e) => setCreateForm({ ...createForm, is_active: e.target.checked })}
                />
                Activo
              </label>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="flex-1 text-sm py-2.5 bg-white border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-sm py-2.5 rounded-lg"
              >
                {saving ? "Guardando..." : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk modal */}
      {bulkOpen && (
        <div className="fixed inset-0 bg-zinc-950/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-zinc-900">Carga masiva de stock</h3>
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              Una línea por registro. Formato: <code className="text-zinc-700">talla, color, cantidad</code> (ej.{" "}
              <code className="text-zinc-700">L, Blanco, 10</code>). Misma validación que Django admin.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Categoría *</label>
                <select
                  value={bulkForm.category_id}
                  onChange={(e) => setBulkForm({ ...bulkForm, category_id: e.target.value })}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900"
                >
                  <option value="">— Elegir —</option>
                  {leafCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.department} / {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Líneas *</label>
                <textarea
                  rows={10}
                  value={bulkForm.lines}
                  onChange={(e) => setBulkForm({ ...bulkForm, lines: e.target.value })}
                  placeholder={"L, Blanco, 10\nM, Negro, 5"}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900 font-mono"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-700">
                <input
                  type="checkbox"
                  checked={bulkForm.add_to_existing}
                  onChange={(e) => setBulkForm({ ...bulkForm, add_to_existing: e.target.checked })}
                />
                Sumar a existentes (consolida duplicados en la carga y suma sobre filas ya guardadas)
              </label>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                className="flex-1 text-sm py-2.5 bg-white border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleBulk}
                disabled={saving}
                className="flex-1 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white text-sm py-2.5 rounded-lg"
              >
                {saving ? "Procesando..." : "Procesar carga"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-5 right-5 border rounded-xl px-4 py-2.5 text-sm shadow-md max-w-md ${
            toast.ok ? "bg-white border-zinc-200 text-zinc-800" : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
