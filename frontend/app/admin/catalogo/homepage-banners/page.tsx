"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createHomepageBanner,
  deleteHomepageBanner,
  getAdminHomepageBanners,
  updateHomepageBanner,
  updateHomepageBannerMultipart,
} from "@/lib/admin-api";
import type { AdminHomepageBanner } from "@/types/admin";

const INPUT =
  "w-full bg-white border border-zinc-300 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/20";

type BannerForm = {
  title: string;
  subtitle: string;
  description: string;
  alt_text: string;
  cta_label: string;
  cta_url: string;
  show_text: boolean;
  is_active: boolean;
  sort_order: string;
};

const emptyForm = (): BannerForm => ({
  title: "",
  subtitle: "",
  description: "",
  alt_text: "",
  cta_label: "",
  cta_url: "",
  show_text: true,
  is_active: true,
  sort_order: "0",
});

function formFromBanner(b: AdminHomepageBanner): BannerForm {
  return {
    title: b.title || "",
    subtitle: b.subtitle || "",
    description: b.description || "",
    alt_text: b.alt_text || "",
    cta_label: b.cta_label || "",
    cta_url: b.cta_url || "",
    show_text: b.show_text,
    is_active: b.is_active,
    sort_order: String(b.sort_order),
  };
}

function bannerFormData(f: BannerForm, image?: File | null): FormData {
  const fd = new FormData();
  fd.append("title", f.title);
  fd.append("subtitle", f.subtitle);
  fd.append("description", f.description);
  fd.append("alt_text", f.alt_text);
  fd.append("cta_label", f.cta_label);
  fd.append("cta_url", f.cta_url);
  fd.append("show_text", f.show_text ? "true" : "false");
  fd.append("is_active", f.is_active ? "true" : "false");
  fd.append("sort_order", String(parseInt(f.sort_order, 10) || 0));
  if (image) fd.append("image", image);
  return fd;
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

type Mode = { type: "create" } | { type: "edit"; b: AdminHomepageBanner };

export default function HomepageBannersAdminPage() {
  const [list, setList] = useState<AdminHomepageBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode | null>(null);
  const [form, setForm] = useState<BannerForm>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminHomepageBanner | null>(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setLoading(true);
    getAdminHomepageBanners()
      .then(setList)
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm(emptyForm());
    setImageFile(null);
    setFormError("");
    setMode({ type: "create" });
  }

  function openEdit(b: AdminHomepageBanner) {
    setForm(formFromBanner(b));
    setImageFile(null);
    setFormError("");
    setMode({ type: "edit", b });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (mode?.type === "create" && !imageFile) {
      setFormError("Selecciona una imagen.");
      return;
    }
    setSaving(true);
    try {
      if (mode?.type === "create") {
        const fd = bannerFormData(form, imageFile);
        const created = await createHomepageBanner(fd);
        setList((prev) => [...prev, created].sort((a, b) => a.sort_order - b.sort_order));
      } else if (mode?.type === "edit") {
        if (imageFile) {
          const fd = bannerFormData(form, imageFile);
          const updated = await updateHomepageBannerMultipart(mode.b.id, fd);
          setList((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        } else {
          const updated = await updateHomepageBanner(mode.b.id, {
            title: form.title,
            subtitle: form.subtitle,
            description: form.description,
            alt_text: form.alt_text,
            cta_label: form.cta_label,
            cta_url: form.cta_url,
            show_text: form.show_text,
            is_active: form.is_active,
            sort_order: parseInt(form.sort_order, 10) || 0,
          });
          setList((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
        }
      }
      setMode(null);
    } catch (err: any) {
      setFormError(formatApiError(err?.payload?.error ?? err?.message));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(b: AdminHomepageBanner) {
    try {
      const updated = await updateHomepageBanner(b.id, { is_active: !b.is_active });
      setList((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e) {
      console.error(e);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteHomepageBanner(deleteTarget.id);
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
        <span className="text-zinc-900 font-medium">Homepage banners</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-zinc-900">Homepage banners</h1>
        <button
          type="button"
          onClick={openCreate}
          className="text-xs px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
        >
          + Nuevo banner
        </button>
      </div>

      <p className="text-xs text-zinc-500">
        CTA debe ser una ruta relativa (ej. <code className="bg-zinc-100 px-1 rounded">/catalogo</code>), sin{" "}
        <code className="bg-zinc-100 px-1 rounded">http://</code>.
      </p>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-zinc-400 text-sm">Cargando…</div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain touch-pan-x">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-4 py-2 w-16">Vista</th>
                  <th className="text-left px-4 py-2">Título</th>
                  <th className="text-right px-4 py-2">Orden</th>
                  <th className="text-center px-4 py-2">Activo</th>
                  <th className="text-left px-4 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="px-4 py-2">
                      {b.image_thumb_url ? (
                        <img
                          src={b.image_thumb_url}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover bg-zinc-100 border border-zinc-200"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-zinc-100 border border-zinc-200" />
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <p className="text-zinc-900 text-xs font-medium">{b.title || "—"}</p>
                      <p className="text-zinc-400 text-[11px] truncate max-w-[220px]">{b.cta_url || "sin CTA"}</p>
                    </td>
                    <td className="px-4 py-2 text-right text-zinc-600 text-xs">{b.sort_order}</td>
                    <td className="px-4 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => toggleActive(b)}
                        className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                          b.is_active
                            ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            : "bg-zinc-100 text-zinc-400 border-zinc-200 hover:bg-zinc-200"
                        }`}
                      >
                        {b.is_active ? "Sí" : "No"}
                      </button>
                    </td>
                    <td className="px-4 py-2 space-x-3">
                      <button type="button" onClick={() => openEdit(b)} className="text-xs text-zinc-600 hover:text-zinc-900 font-medium">
                        Editar
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(b)} className="text-xs text-red-500 hover:text-red-600 font-medium">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-400 text-sm">
                      Sin banners.
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
              <h3 className="font-semibold text-sm text-zinc-900">
                {mode.type === "create" ? "Nuevo banner" : "Editar banner"}
              </h3>
              <button type="button" onClick={() => setMode(null)} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-xs text-zinc-500 mb-1 font-medium">Imagen {mode.type === "create" ? "*" : "(opcional, reemplaza)"}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  className="text-xs text-zinc-600 w-full"
                />
              </div>
              <Field label="Título">
                <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={INPUT} />
              </Field>
              <Field label="Subtítulo">
                <input type="text" value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} className={INPUT} />
              </Field>
              <Field label="Descripción">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className={`${INPUT} h-20 resize-y`}
                />
              </Field>
              <Field label="Texto alternativo (alt)">
                <input type="text" value={form.alt_text} onChange={(e) => setForm((f) => ({ ...f, alt_text: e.target.value }))} className={INPUT} />
              </Field>
              <Field label="CTA — etiqueta">
                <input type="text" value={form.cta_label} onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))} className={INPUT} />
              </Field>
              <Field label="CTA — URL (relativa)">
                <input type="text" value={form.cta_url} onChange={(e) => setForm((f) => ({ ...f, cta_url: e.target.value }))} className={INPUT} placeholder="/catalogo" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Orden">
                  <input
                    type="number"
                    min={0}
                    value={form.sort_order}
                    onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                    className={INPUT}
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.show_text}
                  onChange={(e) => setForm((f) => ({ ...f, show_text: e.target.checked }))}
                  className="accent-red-500"
                />
                <span className="text-sm text-zinc-700">Mostrar textos</span>
              </label>
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
              <div className="flex gap-2 pt-2 sticky bottom-0 bg-white pb-1">
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
            <p className="text-sm text-zinc-800 font-medium">¿Eliminar este banner?</p>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1 font-medium">{label}</label>
      {children}
    </div>
  );
}
