"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  createDepartment,
  deleteDepartment,
  getAdminDepartments,
  updateDepartment,
} from "@/lib/admin-api";
import { adminUrlify, SLUG_MAX } from "@/lib/admin-prepopulate";
import type { AdminDepartment } from "@/types/admin";

const INPUT =
  "w-full bg-white border border-zinc-300 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/20";

function formatApiError(err: unknown): string {
  if (err == null) return "Error al guardar.";
  if (typeof err === "string") return err;
  if (typeof err === "object" && !Array.isArray(err)) {
    const labels: Record<string, string> = {
      slug: "Slug",
      name: "Nombre",
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

type FormMode = { type: "create" } | { type: "edit"; dep: AdminDepartment };

export default function DepartamentosAdminPage() {
  const [list, setList] = useState<AdminDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(true);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    sort_order: "0",
    is_active: true,
  });
  const slugTouchedRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminDepartment | null>(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setLoading(true);
    getAdminDepartments({ include_inactive: showInactive })
      .then(setList)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [showInactive]);

  function openCreate() {
    slugTouchedRef.current = false;
    setForm({ name: "", slug: "", sort_order: "0", is_active: true });
    setFormError("");
    setFormMode({ type: "create" });
  }

  function openEdit(d: AdminDepartment) {
    slugTouchedRef.current = true;
    setForm({
      name: d.name,
      slug: d.slug,
      sort_order: String(d.sort_order),
      is_active: d.is_active,
    });
    setFormError("");
    setFormMode({ type: "edit", dep: d });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim()) {
      setFormError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      if (formMode?.type === "create") {
        const created = await createDepartment({
          name: form.name.trim(),
          slug: form.slug.trim(),
          sort_order: parseInt(form.sort_order, 10) || 0,
          is_active: form.is_active,
        });
        setList((prev) => [...prev, created].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)));
      } else if (formMode?.type === "edit") {
        const updated = await updateDepartment(formMode.dep.id, {
          name: form.name.trim(),
          slug: form.slug.trim(),
          sort_order: parseInt(form.sort_order, 10) || 0,
          is_active: form.is_active,
        });
        setList((prev) =>
          prev.map((x) => (x.id === updated.id ? updated : x)).sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        );
      }
      setFormMode(null);
    } catch (err: any) {
      setFormError(formatApiError(err?.payload?.error ?? err?.message));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDepartment(deleteTarget.id);
      setList((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      alert(formatApiError(err?.payload?.error ?? err?.message));
    } finally {
      setDeleting(false);
    }
  }

  async function toggleActive(d: AdminDepartment) {
    try {
      const updated = await updateDepartment(d.id, { is_active: !d.is_active });
      setList((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <Link href="/admin/catalogo" className="hover:text-zinc-700">
          Catálogo
        </Link>
        <span>/</span>
        <span className="text-zinc-900 font-medium">Departamentos</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Departamentos</h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 w-full sm:w-auto">
          <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="accent-red-500"
            />
            Incluir inactivos
          </label>
          <button
            type="button"
            onClick={openCreate}
            className="text-sm sm:text-xs px-4 py-2.5 sm:py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors text-center w-full sm:w-auto"
          >
            + Nuevo departamento
          </button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-zinc-400 text-sm">Cargando…</div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain touch-pan-x">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-xs text-zinc-500 border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-2">Nombre</th>
                <th className="text-left px-4 py-2">Slug</th>
                <th className="text-right px-4 py-2">Orden</th>
                <th className="text-center px-4 py-2">Estado</th>
                <th className="text-left px-4 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                  <td className="px-4 py-2.5 font-medium text-zinc-900">{d.name}</td>
                  <td className="px-4 py-2.5 text-zinc-500 text-xs font-mono">{d.slug}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-600 text-xs">{d.sort_order}</td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => toggleActive(d)}
                      className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                        d.is_active
                          ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                          : "bg-zinc-100 text-zinc-400 border-zinc-200 hover:bg-zinc-200"
                      }`}
                    >
                      {d.is_active ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(d)}
                      className="text-xs text-zinc-600 hover:text-zinc-900 font-medium"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(d)}
                      className="text-xs text-red-500 hover:text-red-600 font-medium"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-400 text-sm">
                    Sin departamentos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {formMode && (
        <div className="fixed inset-0 bg-zinc-950/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-zinc-900">
                {formMode.type === "create" ? "Nuevo departamento" : `Editar: ${formMode.dep.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setFormMode(null)}
                className="text-zinc-400 hover:text-zinc-700 text-xl leading-none"
              >
                ×
              </button>
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
                        ? { slug: adminUrlify(name, SLUG_MAX.department, "departamento") }
                        : {}),
                    }));
                  }}
                  onKeyUp={(e) => {
                    if (formMode.type !== "create" || slugTouchedRef.current) return;
                    const name = (e.target as HTMLInputElement).value;
                    setForm((prev) => ({ ...prev, slug: adminUrlify(name, SLUG_MAX.department, "departamento") }));
                  }}
                  onFocus={(e) => {
                    if (formMode.type !== "create" || slugTouchedRef.current) return;
                    const name = (e.target as HTMLInputElement).value;
                    setForm((prev) => ({ ...prev, slug: adminUrlify(name, SLUG_MAX.department, "departamento") }));
                  }}
                  className={INPUT}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Slug *</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => {
                    slugTouchedRef.current = true;
                    setForm((prev) => ({ ...prev, slug: e.target.value }));
                  }}
                  className={`${INPUT} font-mono text-xs`}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Orden</label>
                <input
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                  className={INPUT}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  className="accent-red-500"
                />
                <span className="text-sm text-zinc-700">Activo</span>
              </label>
              {formError && (
                <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFormMode(null)}
                  className="flex-1 text-sm py-2.5 bg-white border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg font-medium"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-zinc-950/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <p className="text-sm text-zinc-800 font-medium">¿Eliminar departamento?</p>
            <p className="text-xs text-zinc-500 mt-2">
              <strong>{deleteTarget.name}</strong> solo se puede eliminar si no tiene categorías vinculadas.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 text-sm py-2.5 border border-zinc-300 rounded-lg hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="flex-1 text-sm py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? "…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
