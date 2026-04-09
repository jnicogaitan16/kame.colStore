"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createHomepageSection,
  deleteHomepageSection,
  getAdminHomepageSections,
  updateHomepageSection,
} from "@/lib/admin-api";
import type { AdminHomepageSection } from "@/types/admin";

const INPUT =
  "w-full bg-white border border-zinc-300 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/20";

type SectionForm = {
  title: string;
  subtitle: string;
  content: string;
  sort_order: string;
  is_active: boolean;
};

function emptyForm(): SectionForm {
  return { title: "", subtitle: "", content: "", sort_order: "0", is_active: true };
}

function formFromSection(s: AdminHomepageSection): SectionForm {
  return {
    title: s.title,
    subtitle: s.subtitle || "",
    content: s.content || "",
    sort_order: String(s.sort_order),
    is_active: s.is_active,
  };
}

function formatApiError(err: unknown): string {
  if (err == null) return "Error.";
  if (typeof err === "string") return err;
  if (typeof err === "object" && !Array.isArray(err)) {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(err as Record<string, unknown>)) {
      const msg = Array.isArray(v) ? (v as string[]).join(" ") : String(v);
      parts.push(`${k}: ${msg}`);
    }
    return parts.join(" ") || "Error de validación.";
  }
  return String(err);
}

type Mode = { type: "create" } | { type: "edit"; s: AdminHomepageSection };

export default function SeccionesHomeAdminPage() {
  const [list, setList] = useState<AdminHomepageSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode | null>(null);
  const [form, setForm] = useState<SectionForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminHomepageSection | null>(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setLoading(true);
    getAdminHomepageSections()
      .then(setList)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm(emptyForm());
    setFormError("");
    setMode({ type: "create" });
  }

  function openEdit(s: AdminHomepageSection) {
    setForm(formFromSection(s));
    setFormError("");
    setMode({ type: "edit", s });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.title.trim()) {
      setFormError("El título es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      if (mode?.type === "create") {
        const created = await createHomepageSection({
          title: form.title.trim(),
          subtitle: form.subtitle,
          content: form.content,
          sort_order: parseInt(form.sort_order, 10) || 0,
          is_active: form.is_active,
        });
        setList((prev) => [...prev, created].sort((a, b) => a.sort_order - b.sort_order));
      } else if (mode?.type === "edit") {
        const updated = await updateHomepageSection(mode.s.id, {
          title: form.title.trim(),
          subtitle: form.subtitle,
          content: form.content,
          sort_order: parseInt(form.sort_order, 10) || 0,
          is_active: form.is_active,
        });
        setList((prev) =>
          prev.map((x) => (x.id === updated.id ? updated : x)).sort((a, b) => a.sort_order - b.sort_order)
        );
      }
      setMode(null);
    } catch (err: any) {
      setFormError(formatApiError(err?.payload?.error ?? err?.message));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: AdminHomepageSection) {
    try {
      const updated = await updateHomepageSection(s.id, { is_active: !s.is_active });
      setList((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      console.error(e);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteHomepageSection(deleteTarget.id);
      setList((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      alert(formatApiError(err?.payload?.error ?? err?.message));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <Link href="/admin/catalogo" className="hover:text-zinc-700">
          Catálogo
        </Link>
        <span>/</span>
        <span className="text-zinc-900 font-medium">Secciones de Home</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-900">Secciones de Home</h1>
        <button
          type="button"
          onClick={openCreate}
          className="text-xs px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
        >
          + Nueva sección
        </button>
      </div>

      <p className="text-xs text-zinc-500">
        Mismos campos que en Django admin: título, subtítulo, contenido, orden y activo. El identificador interno (slug) se genera en el servidor a partir del título si hace falta.
      </p>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-zinc-400 text-sm">Cargando…</div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain touch-pan-x">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-4 py-2 w-14">#</th>
                  <th className="text-left px-4 py-2">Título</th>
                  <th className="text-left px-4 py-2 max-w-[200px]">Vista previa</th>
                  <th className="text-right px-4 py-2">Orden</th>
                  <th className="text-center px-4 py-2">Activo</th>
                  <th className="text-left px-4 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-100 hover:bg-zinc-50 align-top">
                    <td className="px-4 py-2.5 text-xs font-mono text-zinc-400">{s.id}</td>
                    <td className="px-4 py-2.5 text-xs font-medium text-zinc-900">{s.title}</td>
                    <td className="px-4 py-2.5 text-[11px] text-zinc-500 max-w-[200px] whitespace-normal">{s.content_preview}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-600 text-xs">{s.sort_order}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggleActive(s)}
                        className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                          s.is_active
                            ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            : "bg-zinc-100 text-zinc-400 border-zinc-200 hover:bg-zinc-200"
                        }`}
                      >
                        {s.is_active ? "Sí" : "No"}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 space-x-3">
                      <button type="button" onClick={() => openEdit(s)} className="text-xs text-zinc-600 hover:text-zinc-900 font-medium">
                        Editar
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(s)} className="text-xs text-red-500 hover:text-red-600 font-medium">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-sm">
                      Sin secciones.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mode && (
        <div className="fixed inset-0 bg-zinc-950/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 w-full max-w-lg shadow-xl my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-zinc-900">{mode.type === "create" ? "Nueva sección" : "Editar sección"}</h3>
              <button type="button" onClick={() => setMode(null)} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1 font-medium">Título *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className={INPUT}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1 font-medium">Subtítulo</label>
                <input type="text" value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} className={INPUT} />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1 font-medium">Contenido</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  className={`${INPUT} min-h-[160px] resize-y`}
                />
                <p className="text-[11px] text-zinc-400 mt-1">Contenido principal (texto largo).</p>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1 font-medium">Orden</label>
                <input
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                  className={INPUT}
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="accent-red-500"
                />
                <span className="text-sm text-zinc-700">Activo</span>
              </label>
              {formError && <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setMode(null)} className="flex-1 text-sm py-2.5 border border-zinc-300 rounded-lg hover:bg-zinc-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 text-sm py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 font-medium">
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-zinc-950/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <p className="text-sm text-zinc-800 font-medium">¿Eliminar esta sección?</p>
            <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{deleteTarget.title || `ID ${deleteTarget.id}`}</p>
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setDeleteTarget(null)} className="flex-1 text-sm py-2.5 border border-zinc-300 rounded-lg hover:bg-zinc-50">
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
