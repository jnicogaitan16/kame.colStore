"use client";

import { useEffect, useState } from "react";
import {
  getAdminDiscounts,
  createAdminDiscount,
  updateAdminDiscount,
  deleteAdminDiscount,
  getAdminDepartments,
  getAdminCategories,
  getAdminProducts,
} from "@/lib/admin-api";
import type { AdminDiscountRule } from "@/lib/admin-api";

const INPUT =
  "w-full bg-white border border-zinc-300 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/20";
const SELECT =
  "w-full bg-white border border-zinc-300 rounded-lg px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/20";
const BTN =
  "rounded-lg px-4 py-2 text-sm font-medium transition-colors";

type DiscountForm = {
  name: string;
  discount_type: string;
  discount_value: string;
  scope: string;
  department_id: string;
  category_id: string;
  product_id: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  priority: string;
};

const emptyForm = (): DiscountForm => ({
  name: "",
  discount_type: "percentage",
  discount_value: "",
  scope: "store_wide",
  department_id: "",
  category_id: "",
  product_id: "",
  starts_at: new Date().toISOString().slice(0, 16),
  ends_at: "",
  is_active: true,
  priority: "0",
});

function formFromRule(r: AdminDiscountRule): DiscountForm {
  return {
    name: r.name,
    discount_type: r.discount_type,
    discount_value: String(r.discount_value),
    scope: r.scope,
    department_id: r.department_id ? String(r.department_id) : "",
    category_id: r.category_id ? String(r.category_id) : "",
    product_id: r.product_id ? String(r.product_id) : "",
    starts_at: r.starts_at ? r.starts_at.slice(0, 16) : "",
    ends_at: r.ends_at ? r.ends_at.slice(0, 16) : "",
    is_active: r.is_active,
    priority: String(r.priority),
  };
}

function scopeLabel(scope: string): string {
  switch (scope) {
    case "store_wide": return "Toda la tienda";
    case "department": return "Departamento";
    case "category": return "Categoría";
    case "product": return "Producto";
    default: return scope;
  }
}

function targetLabel(r: AdminDiscountRule): string {
  if (r.scope === "store_wide") return "—";
  if (r.scope === "department") return r.department_name || `Dept #${r.department_id}`;
  if (r.scope === "category") return r.category_name || `Cat #${r.category_id}`;
  if (r.scope === "product") return r.product_name || `Prod #${r.product_id}`;
  return "—";
}

export default function DiscountsPage() {
  const [rules, setRules] = useState<AdminDiscountRule[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DiscountForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadAll() {
    setLoading(true);
    try {
      const [r, d, c, p] = await Promise.all([
        getAdminDiscounts(),
        getAdminDepartments(),
        getAdminCategories(),
        getAdminProducts({}),
      ]);
      setRules(r);
      setDepartments(d.map((x) => ({ id: x.id, name: x.name })));
      setCategories(c.map((x) => ({ id: x.id, name: x.name })));
      const prodList = Array.isArray(p) ? p : (p as { results?: { id: number; name: string }[] })?.results ?? [];
      setProducts(prodList.map((x) => ({ id: x.id, name: x.name })));
    } catch (e) {
      console.error("Error loading discounts", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
    setError("");
  }

  function openEdit(r: AdminDiscountRule) {
    setEditingId(r.id);
    setForm(formFromRule(r));
    setShowForm(true);
    setError("");
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const payload: Record<string, unknown> = {
      name: form.name,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value) || 0,
      scope: form.scope,
      department_id: form.scope === "department" ? parseInt(form.department_id) || null : null,
      category_id: form.scope === "category" ? parseInt(form.category_id) || null : null,
      product_id: form.scope === "product" ? parseInt(form.product_id) || null : null,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      is_active: form.is_active,
      priority: parseInt(form.priority) || 0,
    };
    try {
      if (editingId) {
        await updateAdminDiscount(editingId, payload);
      } else {
        await createAdminDiscount(payload);
      }
      setShowForm(false);
      await loadAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al guardar.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar esta regla de descuento?")) return;
    try {
      await deleteAdminDiscount(id);
      await loadAll();
    } catch (e) {
      console.error(e);
    }
  }

  async function handleToggle(r: AdminDiscountRule) {
    try {
      await updateAdminDiscount(r.id, { is_active: !r.is_active });
      await loadAll();
    } catch (e) {
      console.error(e);
    }
  }

  const set = (field: keyof DiscountForm, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  if (loading) {
    return <div className="p-6 text-zinc-500">Cargando descuentos...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-zinc-900">Descuentos</h1>
        <button
          className={`${BTN} bg-zinc-900 text-white hover:bg-zinc-700`}
          onClick={openCreate}
        >
          + Nuevo descuento
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-8 rounded-xl border border-zinc-200 bg-zinc-50 p-5">
          <h2 className="text-base font-semibold text-zinc-800 mb-4">
            {editingId ? "Editar descuento" : "Nuevo descuento"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Nombre</label>
              <input className={INPUT} placeholder="Ej: Día de la Mujer 2026" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Tipo</label>
                <select className={SELECT} value={form.discount_type} onChange={(e) => set("discount_type", e.target.value)}>
                  <option value="percentage">Porcentaje</option>
                  <option value="fixed_amount">Monto fijo (COP)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Valor</label>
                <input className={INPUT} type="number" placeholder={form.discount_type === "percentage" ? "Ej: 15" : "Ej: 10000"} value={form.discount_value} onChange={(e) => set("discount_value", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Alcance</label>
              <select className={SELECT} value={form.scope} onChange={(e) => set("scope", e.target.value)}>
                <option value="store_wide">Toda la tienda</option>
                <option value="department">Departamento</option>
                <option value="category">Categoría</option>
                <option value="product">Producto específico</option>
              </select>
            </div>

            {form.scope === "department" && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Departamento</label>
                <select className={SELECT} value={form.department_id} onChange={(e) => set("department_id", e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}

            {form.scope === "category" && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Categoría</label>
                <select className={SELECT} value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {form.scope === "product" && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Producto</label>
                <select className={SELECT} value={form.product_id} onChange={(e) => set("product_id", e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Inicio</label>
              <input className={INPUT} type="datetime-local" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Fin (vacío = sin expiración)</label>
              <input className={INPUT} type="datetime-local" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Prioridad</label>
                <input className={INPUT} type="number" value={form.priority} onChange={(e) => set("priority", e.target.value)} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} className="accent-zinc-900" />
                  Activo
                </label>
              </div>
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 mt-5">
            <button className={`${BTN} bg-zinc-900 text-white hover:bg-zinc-700`} onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
            </button>
            <button className={`${BTN} bg-zinc-100 text-zinc-700 hover:bg-zinc-200`} onClick={() => setShowForm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Alcance</th>
              <th className="px-4 py-3">Destino</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Vigencia</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rules.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-400">Sin reglas de descuento.</td></tr>
            ) : rules.map((r) => (
              <tr key={r.id} className={`${r.is_currently_active ? "bg-white" : "bg-zinc-50 opacity-60"}`}>
                <td className="px-4 py-3 font-medium text-zinc-900">{r.name}</td>
                <td className="px-4 py-3 text-zinc-600">{r.discount_type === "percentage" ? "%" : "COP"}</td>
                <td className="px-4 py-3 text-zinc-900 font-semibold">
                  {r.discount_type === "percentage" ? `${r.discount_value}%` : `$${r.discount_value.toLocaleString("es-CO")}`}
                </td>
                <td className="px-4 py-3 text-zinc-600">{scopeLabel(r.scope)}</td>
                <td className="px-4 py-3 text-zinc-600">{targetLabel(r)}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleToggle(r)} className="cursor-pointer">
                    {r.is_currently_active ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Activa</span>
                    ) : r.is_active ? (
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-700">Fuera de fecha</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">Inactiva</span>
                    )}
                  </button>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {r.starts_at ? new Date(r.starts_at).toLocaleDateString("es-CO") : "—"}
                  {" → "}
                  {r.ends_at ? new Date(r.ends_at).toLocaleDateString("es-CO") : "∞"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-zinc-500 hover:text-zinc-900 text-xs mr-3" onClick={() => openEdit(r)}>Editar</button>
                  <button className="text-red-400 hover:text-red-600 text-xs" onClick={() => handleDelete(r.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
