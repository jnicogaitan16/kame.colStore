"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getAdminProduct, updateProduct, addVariant, getAdminCategories } from "@/lib/admin-api";
import type { AdminProductDetail, AdminCategory } from "@/types/admin";

const INPUT = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#e63946]/40";

export default function EditarProductoPage({ params }: { params: Promise<{ product_id: string }> }) {
  const { product_id } = use(params);
  const [product, setProduct] = useState<AdminProductDetail | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [form, setForm] = useState({
    name: "", price: "", description: "", category_id: "", is_active: false,
  });

  // New variant form
  const [variantForm, setVariantForm] = useState({ value: "", color: "", initial_stock: "0" });
  const [addingVariant, setAddingVariant] = useState(false);

  useEffect(() => {
    Promise.all([
      getAdminProduct(Number(product_id)),
      getAdminCategories(),
    ]).then(([p, cats]) => {
      setProduct(p);
      setCategories(cats);
      setForm({
        name: p.name,
        price: String(p.price),
        description: p.description,
        category_id: String(p.category_id),
        is_active: p.is_active,
      });
    }).catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [product_id]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await updateProduct(Number(product_id), {
        name: form.name,
        price: parseFloat(form.price),
        description: form.description,
        is_active: form.is_active,
        category_id: parseInt(form.category_id),
      });
      setProduct(updated);
      showToast("Producto actualizado.");
    } catch (e: any) {
      setError(e?.payload?.error || e?.message || "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!variantForm.value.trim()) return;
    setAddingVariant(true);
    try {
      await addVariant(Number(product_id), {
        value: variantForm.value.trim(),
        color: variantForm.color.trim(),
        initial_stock: parseInt(variantForm.initial_stock) || 0,
      });
      const updated = await getAdminProduct(Number(product_id));
      setProduct(updated);
      setVariantForm({ value: "", color: "", initial_stock: "0" });
      showToast("Variante agregada.");
    } catch (e: any) {
      showToast(e?.payload?.error || "Error al agregar variante.");
    } finally {
      setAddingVariant(false);
    }
  }

  if (loading) return <div className="text-white/40 text-sm">Cargando...</div>;
  if (!product) return <div className="text-[#e63946] text-sm">{error || "Producto no encontrado."}</div>;

  const leafCategories = categories.filter((c) => c.is_leaf);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2 text-xs text-white/40">
        <Link href="/admin/catalogo" className="hover:text-white">Catálogo</Link>
        <span>/</span>
        <span className="text-white">{product.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{product.name}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full ${product.is_active ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"}`}>
          {product.is_active ? "Activo" : "Inactivo"}
        </span>
      </div>

      {/* Product form */}
      <form onSubmit={handleSave} className="bg-white/5 rounded-lg p-4 space-y-4">
        <p className="text-xs text-white/40 uppercase tracking-wide mb-1">Datos del producto</p>

        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Nombre">
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT} required />
          </Field>
          <Field label="Precio (COP)">
            <input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={INPUT} required />
          </Field>
        </div>

        <Field label="Categoría">
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className={INPUT}>
            {leafCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.department} / {c.name}</option>
            ))}
          </select>
        </Field>

        <Field label="Descripción">
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${INPUT} h-20 resize-none`} />
        </Field>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="w-4 h-4 accent-[#e63946]"
          />
          <span className="text-sm text-white/70">Producto activo (visible en tienda)</span>
        </label>

        {error && (
          <p className="text-[#e63946] text-xs bg-[#e63946]/10 border border-[#e63946]/20 rounded px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="bg-[#e63946] hover:bg-[#e63946]/80 disabled:opacity-50 text-white text-sm py-2.5 px-5 rounded-lg transition-colors"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      {/* Variants */}
      <div className="bg-white/5 rounded-lg p-4 space-y-4">
        <p className="text-xs text-white/40 uppercase tracking-wide">Variantes ({product.variants.length})</p>

        {product.variants.length > 0 && (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/30 border-b border-white/10">
                <th className="text-left py-2">Talla</th>
                <th className="text-left py-2">Color</th>
                <th className="text-right py-2">Stock</th>
                <th className="text-center py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((v) => (
                <tr key={v.id} className="border-b border-white/5">
                  <td className="py-2 font-mono text-white/70">{v.value || "—"}</td>
                  <td className="py-2 text-white/50">{v.color || "—"}</td>
                  <td className="py-2 text-right">
                    <Link href={`/admin/inventario`} className={`hover:underline ${v.stock <= 3 ? "text-red-400 font-semibold" : "text-white/60"}`}>
                      {v.stock} →
                    </Link>
                  </td>
                  <td className="py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full ${v.is_active ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/30"}`}>
                      {v.is_active ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Add variant form */}
        <form onSubmit={handleAddVariant} className="border-t border-white/10 pt-4">
          <p className="text-xs text-white/30 mb-3">Agregar variante</p>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Talla *">
              <input
                type="text"
                value={variantForm.value}
                onChange={(e) => setVariantForm({ ...variantForm, value: e.target.value })}
                className={INPUT}
                placeholder="S, M, L, XL..."
                required
              />
            </Field>
            <Field label="Color">
              <input
                type="text"
                value={variantForm.color}
                onChange={(e) => setVariantForm({ ...variantForm, color: e.target.value })}
                className={INPUT}
                placeholder="Negro, Blanco..."
              />
            </Field>
            <Field label="Stock inicial">
              <input
                type="number"
                min={0}
                value={variantForm.initial_stock}
                onChange={(e) => setVariantForm({ ...variantForm, initial_stock: e.target.value })}
                className={INPUT}
              />
            </Field>
          </div>
          <button
            type="submit"
            disabled={addingVariant}
            className="mt-3 text-xs px-4 py-2 bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            {addingVariant ? "Agregando..." : "+ Agregar variante"}
          </button>
        </form>
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 bg-white/10 backdrop-blur border border-white/10 rounded-lg px-4 py-2 text-sm text-white">
          {toast}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-white/50 mb-1">{label}</label>
      {children}
    </div>
  );
}
