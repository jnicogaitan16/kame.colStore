"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAdminCategories, createProduct } from "@/lib/admin-api";
import { adminUrlify, SLUG_MAX } from "@/lib/admin-prepopulate";
import type { AdminCategory } from "@/types/admin";

const INPUT =
  "w-full bg-white border border-zinc-300 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/20";

function formatApiError(err: unknown): string {
  if (err == null) return "Error al crear producto.";
  if (typeof err === "string") return err;
  if (typeof err === "object" && !Array.isArray(err)) {
    const labels: Record<string, string> = {
      slug: "Slug",
      name: "Nombre",
      category: "Categoría",
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

export default function NuevoProductoPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [form, setForm] = useState({ name: "", slug: "", price: "", category_id: "", description: "" });
  const slugTouchedRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminCategories().then(setCategories).catch(console.error);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name || !form.price || !form.category_id) {
      setError("Completa nombre, precio y categoría.");
      return;
    }
    setSaving(true);
    try {
      const product = await createProduct({
        name: form.name,
        slug: form.slug.trim(),
        price: parseFloat(form.price),
        category_id: parseInt(form.category_id),
        description: form.description,
      });
      router.replace(`/admin/catalogo/productos/${product.id}/editar`);
    } catch (e: any) {
      setError(formatApiError(e?.payload?.error ?? e?.message));
    } finally {
      setSaving(false);
    }
  }

  const leafCategories = categories.filter((c) => c.is_leaf);

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <Link href="/admin/catalogo" className="hover:text-zinc-700">
          Catálogo
        </Link>
        <span>/</span>
        <Link href="/admin/catalogo/productos" className="hover:text-zinc-700">
          Productos
        </Link>
        <span>/</span>
        <span className="text-zinc-900">Nuevo</span>
      </div>

      <h1 className="text-lg font-semibold text-zinc-900">Nuevo producto</h1>

      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Nombre *">
            <input
              type="text"
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  name,
                  ...(!slugTouchedRef.current ? { slug: adminUrlify(name, SLUG_MAX.product, "producto") } : {}),
                }));
              }}
              onKeyUp={(e) => {
                if (slugTouchedRef.current) return;
                const name = (e.target as HTMLInputElement).value;
                setForm((prev) => ({ ...prev, slug: adminUrlify(name, SLUG_MAX.product, "producto") }));
              }}
              onFocus={(e) => {
                if (slugTouchedRef.current) return;
                const name = (e.target as HTMLInputElement).value;
                setForm((prev) => ({ ...prev, slug: adminUrlify(name, SLUG_MAX.product, "producto") }));
              }}
              className={INPUT}
              placeholder="Ej: Camiseta Kame Basic"
              required
            />
          </Field>

          <Field label="Slug">
            <input
              type="text"
              value={form.slug}
              onChange={(e) => {
                slugTouchedRef.current = true;
                setForm((prev) => ({ ...prev, slug: e.target.value }));
              }}
              className={`${INPUT} font-mono text-xs`}
              placeholder="se genera desde el nombre"
              spellCheck={false}
            />
            <p className="text-[11px] text-zinc-400 mt-1">
              Mismo comportamiento que Django prepopulate (keyup / change / focus sobre el nombre). Puedes editarlo; si lo borras, el servidor genera uno único.
            </p>
          </Field>

          <Field label="Precio (COP) *">
            <input
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className={INPUT}
              placeholder="Ej: 59900"
              required
            />
          </Field>

          <Field label="Categoría *">
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className={INPUT}
              required
            >
              <option value="">Seleccionar categoría...</option>
              {leafCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.department} / {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Descripción">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={`${INPUT} h-24 resize-none`}
              placeholder="Descripción del producto..."
            />
          </Field>

          {error && <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Link
              href="/admin/catalogo/productos"
              className="flex-1 text-center text-sm py-2.5 bg-white border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg transition-colors font-medium"
            >
              {saving ? "Creando..." : "Crear producto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1.5 font-medium">{label}</label>
      {children}
    </div>
  );
}
