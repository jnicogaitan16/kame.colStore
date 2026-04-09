"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getAdminCategories, createCategory, updateCategory, getAdminDepartments } from "@/lib/admin-api";
import { adminUrlify, SLUG_MAX } from "@/lib/admin-prepopulate";
import type { AdminCategory, AdminDepartment } from "@/types/admin";

const VARIANT_SCHEMAS = [
  { value: "size_color", label: "Talla + Color" },
  { value: "jean_size", label: "Talla Jean" },
  { value: "shoe_size", label: "Talla Zapatilla" },
  { value: "no_variant", label: "Sin variantes" },
];

const INPUT = "w-full bg-white border border-zinc-300 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/20";

function formatApiError(err: unknown): string {
  if (err == null) return "Error al guardar.";
  if (typeof err === "string") return err;
  if (typeof err === "object" && !Array.isArray(err)) {
    const labels: Record<string, string> = {
      slug: "Slug",
      name: "Nombre",
      department: "Departamento",
      parent: "Categoría padre",
      __all__: "General",
    };
    const parts: string[] = [];
    for (const [k, v] of Object.entries(err as Record<string, unknown>)) {
      const msg = Array.isArray(v) ? (v as string[]).join(" ") : String(v);
      parts.push(`${labels[k] || k}: ${msg}`);
    }
    return parts.join(" ") || "Error de validación.";
  }
  return String(err);
}

type FormMode = { type: "create" } | { type: "edit"; category: AdminCategory };

export default function CategoriasPage() {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    department_id: "",
    variant_schema: "size_color",
    parent_id: "",
  });
  const slugTouchedRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function load() {
    setLoading(true);
    Promise.all([getAdminCategories({ include_inactive: showInactive }), getAdminDepartments()])
      .then(([cats, deps]) => { setCategories(cats); setDepartments(deps); })
      .catch(console.error).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [showInactive]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  function openCreate() {
    slugTouchedRef.current = false;
    setForm({
      name: "",
      slug: "",
      department_id: departments[0] ? String(departments[0].id) : "",
      variant_schema: "size_color",
      parent_id: "",
    });
    setFormError("");
    setFormMode({ type: "create" });
  }

  function openEdit(cat: AdminCategory) {
    slugTouchedRef.current = true;
    setForm({
      name: cat.name,
      slug: cat.slug,
      department_id: String(cat.department_id),
      variant_schema: cat.variant_schema,
      parent_id: cat.parent_id ? String(cat.parent_id) : "",
    });
    setFormError("");
    setFormMode({ type: "edit", category: cat });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim() || !form.department_id) { setFormError("Nombre y departamento son requeridos."); return; }
    if (formMode?.type === "edit" && !form.slug.trim()) { setFormError("El slug no puede estar vacío."); return; }
    setSaving(true);
    try {
      if (formMode?.type === "create") {
        const cat = await createCategory({
          name: form.name.trim(),
          slug: form.slug.trim(),
          department_id: parseInt(form.department_id),
          variant_schema: form.variant_schema,
          parent_id: form.parent_id ? parseInt(form.parent_id) : null,
        });
        setCategories((prev) => [cat, ...prev]);
        showToast("Categoría creada.");
      } else if (formMode?.type === "edit") {
        const updated = await updateCategory(formMode.category.id, {
          name: form.name.trim(),
          slug: form.slug.trim(),
          variant_schema: form.variant_schema,
        });
        setCategories((prev) => prev.map((c) => c.id === updated.id ? updated : c));
        showToast("Categoría actualizada.");
      }
      setFormMode(null);
    } catch (e: any) {
      setFormError(formatApiError(e?.payload?.error ?? e?.message) || "Error al guardar.");
    } finally { setSaving(false); }
  }

  async function toggleActive(cat: AdminCategory) {
    try {
      const updated = await updateCategory(cat.id, { is_active: !cat.is_active });
      setCategories((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      showToast(`Categoría ${updated.is_active ? "activada" : "desactivada"}.`);
    } catch (e: any) {
      showToast(e?.payload?.error || "Error al actualizar.", false);
    }
  }

  const grouped = categories.reduce<Record<string, AdminCategory[]>>((acc, cat) => {
    const key = cat.department || "Sin departamento";
    if (!acc[key]) acc[key] = [];
    acc[key].push(cat);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <Link href="/admin/catalogo" className="hover:text-zinc-700">
            Catálogo
          </Link>
          <span>/</span>
          <span className="text-zinc-900 font-medium">Categorías</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 w-full sm:w-auto">
          <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="accent-red-500"
            />
            Mostrar inactivas
          </label>
          <button
            type="button"
            onClick={openCreate}
            className="text-sm sm:text-xs px-4 py-2.5 sm:py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium text-center w-full sm:w-auto"
          >
            + Nueva categoría
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-zinc-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([dept, cats]) => (
            <div key={dept} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <div className="px-3 sm:px-4 py-2.5 bg-zinc-50 border-b border-zinc-100">
                <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wide break-words">{dept}</p>
              </div>
              <div className="overflow-x-auto overscroll-x-contain touch-pan-x">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="text-xs text-zinc-400 border-b border-zinc-100">
                    <th className="text-left px-4 py-2">Nombre</th>
                    <th className="text-left px-4 py-2">Slug</th>
                    <th className="text-left px-4 py-2">Esquema</th>
                    <th className="text-right px-4 py-2">Productos</th>
                    <th className="text-center px-4 py-2">Hoja</th>
                    <th className="text-center px-4 py-2">Estado</th>
                    <th className="text-left px-4 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cats.map((cat) => (
                    <tr key={cat.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className={`text-sm font-medium ${cat.is_active ? "text-zinc-900" : "text-zinc-400 line-through"}`}>
                          {cat.name}
                        </span>
                        {cat.parent_id && <span className="text-zinc-400 text-xs ml-1">↳</span>}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400 text-xs font-mono">{cat.slug}</td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs">
                        {VARIANT_SCHEMAS.find((s) => s.value === cat.variant_schema)?.label || cat.variant_schema}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-600 text-xs font-medium">{cat.product_count}</td>
                      <td className="px-4 py-2.5 text-center text-xs">
                        {cat.is_leaf ? <span className="text-green-600">●</span> : <span className="text-zinc-300">○</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => toggleActive(cat)}
                          className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                            cat.is_active
                              ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                              : "bg-zinc-100 text-zinc-400 border-zinc-200 hover:bg-zinc-200"
                          }`}>
                          {cat.is_active ? "Activa" : "Inactiva"}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => openEdit(cat)} className="text-xs text-zinc-500 hover:text-zinc-900 font-medium transition-colors">
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <p className="text-center text-zinc-400 text-sm py-8">Sin categorías.</p>
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {formMode && (
        <div className="fixed inset-0 bg-zinc-950/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-zinc-900">
                {formMode.type === "create" ? "Nueva categoría" : `Editar: ${formMode.category.name}`}
              </h3>
              <button onClick={() => setFormMode(null)} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">×</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Nombre *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      name,
                      ...(formMode.type === "create" && !slugTouchedRef.current
                        ? { slug: adminUrlify(name, SLUG_MAX.category, "categoria") }
                        : {}),
                    }));
                  }}
                  onKeyUp={(e) => {
                    if (formMode.type !== "create" || slugTouchedRef.current) return;
                    const name = (e.target as HTMLInputElement).value;
                    setForm((prev) => ({ ...prev, slug: adminUrlify(name, SLUG_MAX.category, "categoria") }));
                  }}
                  onFocus={(e) => {
                    if (formMode.type !== "create" || slugTouchedRef.current) return;
                    const name = (e.target as HTMLInputElement).value;
                    setForm((prev) => ({ ...prev, slug: adminUrlify(name, SLUG_MAX.category, "categoria") }));
                  }}
                  className={INPUT}
                  placeholder="Ej: Camisetas"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1.5 font-medium">
                  Slug{formMode.type === "edit" ? " *" : ""}
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => {
                    slugTouchedRef.current = true;
                    setForm((prev) => ({ ...prev, slug: e.target.value }));
                  }}
                  className={`${INPUT} font-mono text-xs`}
                  placeholder="ej: camisetas"
                  required={formMode.type === "edit"}
                  spellCheck={false}
                />
                {formMode.type === "create" && (
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Mismo comportamiento que Django prepopulate (keyup / change / focus sobre el nombre). Puedes cambiarlo; si lo borras, el servidor genera uno único.
                  </p>
                )}
              </div>

              {formMode.type === "create" && (
                <>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Departamento *</label>
                    <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} className={INPUT} required>
                      <option value="">Seleccionar...</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Categoría padre (opcional)</label>
                    <select value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })} className={INPUT}>
                      <option value="">Ninguna (categoría raíz)</option>
                      {categories.filter((c) => c.department_id === parseInt(form.department_id || "0") && !c.parent_id).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Esquema de variante</label>
                <select value={form.variant_schema} onChange={(e) => setForm({ ...form, variant_schema: e.target.value })} className={INPUT}>
                  {VARIANT_SCHEMAS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              {formError && (
                <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setFormMode(null)}
                  className="flex-1 text-sm py-2.5 bg-white border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg transition-colors font-medium">
                  {saving ? "Guardando..." : formMode.type === "create" ? "Crear" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-5 right-5 border rounded-xl px-4 py-2.5 text-sm shadow-md ${
          toast.ok ? "bg-white border-zinc-200 text-zinc-800" : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
