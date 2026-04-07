"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAdminCategories, createProduct } from "@/lib/admin-api";
import type { AdminCategory } from "@/types/admin";

export default function NuevoProductoPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [form, setForm] = useState({
    name: "", price: "", category_id: "", description: "",
  });
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
        price: parseFloat(form.price),
        category_id: parseInt(form.category_id),
        description: form.description,
      });
      router.replace(`/admin/catalogo/${product.id}/editar`);
    } catch (e: any) {
      setError(e?.payload?.error || e?.message || "Error al crear producto.");
    } finally {
      setSaving(false);
    }
  }

  const leafCategories = categories.filter((c) => c.is_leaf);

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center gap-2 text-xs text-white/40">
        <Link href="/admin/catalogo" className="hover:text-white">Catálogo</Link>
        <span>/</span>
        <span className="text-white">Nuevo producto</span>
      </div>

      <h1 className="text-lg font-semibold">Nuevo producto</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre *">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={INPUT}
            placeholder="Ej: Camiseta Kame Basic"
            required
          />
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
            <option value="">Seleccionar categoría leaf...</option>
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

        {error && (
          <p className="text-[#e63946] text-xs bg-[#e63946]/10 border border-[#e63946]/20 rounded px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Link href="/admin/catalogo" className="flex-1 text-center text-sm py-2.5 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-[#e63946] hover:bg-[#e63946]/80 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg transition-colors"
          >
            {saving ? "Creando..." : "Crear producto"}
          </button>
        </div>
      </form>
    </div>
  );
}

const INPUT = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#e63946]/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-white/50 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
