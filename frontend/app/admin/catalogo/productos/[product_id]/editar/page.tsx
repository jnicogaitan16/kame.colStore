"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  addVariant,
  createProductColorImage,
  deleteProductColorImage,
  getAdminCategories,
  getAdminProduct,
  updateProduct,
} from "@/lib/admin-api";
import type { AdminProductColorImage, AdminProductDetail, AdminCategory } from "@/types/admin";

const INPUT =
  "w-full bg-white border border-zinc-300 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/20";

function formatApiError(err: unknown): string {
  if (err == null) return "Error al guardar.";
  if (typeof err === "string") return err;
  if (typeof err === "object" && !Array.isArray(err)) {
    const labels: Record<string, string> = {
      slug: "Slug",
      name: "Nombre",
      category: "Categoría",
      is_active: "Estado",
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

export default function EditarProductoPage({ params }: { params: { product_id: string } }) {
  const { product_id } = params;
  const [product, setProduct] = useState<AdminProductDetail | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    price: "",
    description: "",
    category_id: "",
    is_active: false,
  });
  const [variantForm, setVariantForm] = useState({ value: "", color: "", initial_stock: "0" });
  const [addingVariant, setAddingVariant] = useState(false);
  const [uploadingColorImage, setUploadingColorImage] = useState(false);
  const [colorImageForm, setColorImageForm] = useState<{
    color: string;
    sort_order: string;
    is_primary: boolean;
    alt_text: string;
    file: File | null;
  }>({ color: "", sort_order: "0", is_primary: false, alt_text: "", file: null });

  useEffect(() => {
    Promise.all([getAdminProduct(Number(product_id)), getAdminCategories()]).then(([p, cats]) => {
      setProduct(p);
      setCategories(cats);
      setForm({
        name: p.name,
        slug: p.slug,
        price: String(p.price),
        description: p.description,
        category_id: String(p.category_id),
        is_active: p.is_active,
      });
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [product_id]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (!form.slug.trim()) {
        setError("El slug no puede estar vacío.");
        return;
      }
      const updated = await updateProduct(Number(product_id), {
        name: form.name,
        slug: form.slug.trim(),
        price: parseFloat(form.price),
        description: form.description,
        is_active: form.is_active,
        category_id: parseInt(form.category_id),
      });
      setProduct(updated);
      showToast("Producto actualizado.");
    } catch (e: any) {
      setError(formatApiError(e?.payload?.error ?? e?.message));
    } finally { setSaving(false); }
  }

  async function handleAddVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!variantForm.value.trim()) return;
    const isSizeColorSchema = (product?.category_variant_schema || "").toLowerCase() === "size_color";
    if (isSizeColorSchema && !variantForm.color.trim()) {
      showToast("El color es obligatorio para esta categoría.", false);
      return;
    }
    setAddingVariant(true);
    try {
      await addVariant(Number(product_id), {
        value: variantForm.value.trim(), color: variantForm.color.trim(),
        initial_stock: parseInt(variantForm.initial_stock) || 0,
      });
      const updated = await getAdminProduct(Number(product_id));
      setProduct(updated);
      setVariantForm({ value: "", color: "", initial_stock: "0" });
      showToast("Variante agregada.");
    } catch (e: any) {
      showToast(e?.payload?.error || "Error al agregar variante.", false);
    } finally { setAddingVariant(false); }
  }

  async function handleAddColorImage(e: React.FormEvent) {
    e.preventDefault();
    if (!colorImageForm.file) {
      showToast("Selecciona una imagen.", false);
      return;
    }
    if (!colorImageForm.color.trim()) {
      showToast("Selecciona un color.", false);
      return;
    }
    setUploadingColorImage(true);
    try {
      const fd = new FormData();
      fd.set("image", colorImageForm.file);
      fd.set("color", colorImageForm.color.trim());
      fd.set("sort_order", String(parseInt(colorImageForm.sort_order) || 0));
      fd.set("is_primary", colorImageForm.is_primary ? "1" : "0");
      if (colorImageForm.alt_text.trim()) fd.set("alt_text", colorImageForm.alt_text.trim());

      await createProductColorImage(Number(product_id), fd);
      const updated = await getAdminProduct(Number(product_id));
      setProduct(updated);
      setColorImageForm({ color: "", sort_order: "0", is_primary: false, alt_text: "", file: null });
      showToast("Imagen por color agregada.");
    } catch (e: any) {
      showToast(formatApiError(e?.payload?.error ?? e?.message), false);
    } finally {
      setUploadingColorImage(false);
    }
  }

  async function handleDeleteColorImage(img: AdminProductColorImage) {
    if (!confirm("¿Eliminar esta imagen?")) return;
    try {
      await deleteProductColorImage(Number(product_id), img.id);
      const updated = await getAdminProduct(Number(product_id));
      setProduct(updated);
      showToast("Imagen eliminada.");
    } catch (e: any) {
      showToast(formatApiError(e?.payload?.error ?? e?.message), false);
    }
  }

  if (loading) return <div className="text-zinc-400 text-sm">Cargando...</div>;
  if (!product) return <div className="text-red-500 text-sm">{error || "Producto no encontrado."}</div>;

  const leafCategories = categories.filter((c) => c.is_leaf);
  const rule = product.variant_rule;
  const allowedValues = rule?.allowed_values || [];
  const allowedColors = rule?.allowed_colors || [];
  const useSelectForValue = Boolean(rule?.use_select && allowedValues.length);
  const useSelectForColor = Boolean(allowedColors.length);
  const isSizeColor = (product.category_variant_schema || "").toLowerCase() === "size_color";

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <Link href="/admin/catalogo" className="hover:text-zinc-700">Catálogo</Link>
        <span>/</span>
        <Link href="/admin/catalogo/productos" className="hover:text-zinc-700">Productos</Link>
        <span>/</span>
        <span className="text-zinc-900">{product.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">{product.name}</h1>
        <span className={`text-xs px-2.5 py-0.5 rounded-full border ${
          product.is_active ? "bg-green-50 text-green-700 border-green-200" : "bg-zinc-100 text-zinc-500 border-zinc-200"
        }`}>
          {product.is_active ? "Activo" : "Inactivo"}
        </span>
      </div>

      {/* Product form */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-4">Datos del producto</p>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Nombre">
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT} required />
            </Field>
            <Field label="Precio (COP)">
              <input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={INPUT} required />
            </Field>
          </div>
          <Field label="Slug *">
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className={`${INPUT} font-mono text-xs`}
              required
              spellCheck={false}
            />
          </Field>
          <Field label="Categoría">
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className={INPUT}>
              {leafCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.department} / {c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Descripción">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={`${INPUT} h-20 resize-none`} />
          </Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 accent-red-500" />
            <span className="text-sm text-zinc-700">Producto activo (visible en tienda)</span>
          </label>
          {error && <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={saving}
            className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm py-2.5 px-6 rounded-lg transition-colors font-medium">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </div>

      {/* Variants */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-5">
        <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-4">Variantes ({product.variants.length})</p>

        {product.variants.length > 0 && (
          <table className="w-full text-xs mb-4">
            <thead>
              <tr className="text-zinc-400 border-b border-zinc-100">
                <th className="text-left py-2">Talla</th>
                <th className="text-left py-2">Color</th>
                <th className="text-right py-2">Stock</th>
                <th className="text-center py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((v) => (
                <tr key={v.id} className="border-b border-zinc-100">
                  <td className="py-2 font-mono text-zinc-700 font-medium">{v.value || "—"}</td>
                  <td className="py-2 text-zinc-600">{v.color || "—"}</td>
                  <td className="py-2 text-right">
                    <Link href="/admin/inventario"
                      className={`hover:underline font-medium ${v.stock <= 3 ? "text-red-600" : "text-zinc-600"}`}>
                      {v.stock} →
                    </Link>
                  </td>
                  <td className="py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full border text-xs ${
                      v.is_active ? "bg-green-50 text-green-700 border-green-200" : "bg-zinc-100 text-zinc-400 border-zinc-200"
                    }`}>
                      {v.is_active ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form onSubmit={handleAddVariant} className="border-t border-zinc-100 pt-4">
          <p className="text-xs text-zinc-500 font-medium mb-3">Agregar variante</p>
          <div className="grid grid-cols-3 gap-2">
            <Field label={`${rule?.label || "Talla"} *`}>
              {useSelectForValue ? (
                <select
                  value={variantForm.value}
                  onChange={(e) => setVariantForm({ ...variantForm, value: e.target.value })}
                  className={INPUT}
                  required
                >
                  <option value="">Seleccionar...</option>
                  {allowedValues.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={variantForm.value}
                  onChange={(e) => setVariantForm({ ...variantForm, value: e.target.value })}
                  className={INPUT}
                  placeholder="S, M, L..."
                  required
                />
              )}
            </Field>
            <Field label="Color">
              {useSelectForColor ? (
                <select
                  value={variantForm.color}
                  onChange={(e) => setVariantForm({ ...variantForm, color: e.target.value })}
                  className={INPUT}
                  disabled={!isSizeColor}
                >
                  <option value="">{isSizeColor ? "Seleccionar..." : "—"}</option>
                  {allowedColors.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={variantForm.color}
                  onChange={(e) => setVariantForm({ ...variantForm, color: e.target.value })}
                  className={INPUT}
                  placeholder="Negro..."
                  disabled={!isSizeColor}
                />
              )}
            </Field>
            <Field label="Stock inicial">
              <input type="number" min={0} value={variantForm.initial_stock}
                onChange={(e) => setVariantForm({ ...variantForm, initial_stock: e.target.value })}
                className={INPUT} />
            </Field>
          </div>
          <button type="submit" disabled={addingVariant}
            className="mt-3 text-xs px-4 py-2 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 text-zinc-700 rounded-lg transition-colors border border-zinc-200 font-medium">
            {addingVariant ? "Agregando..." : "+ Agregar variante"}
          </button>
        </form>
      </div>

      {/* Images by color (Django Admin parity for SIZE_COLOR) */}
      {isSizeColor && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5">
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-4">
            Imágenes por color ({product.color_images?.length || 0})
          </p>

          {(product.color_images?.length || 0) > 0 && (
            <div className="grid sm:grid-cols-2 gap-3 mb-5">
              {product.color_images.map((img) => (
                <div key={img.id} className="border border-zinc-200 rounded-xl p-3 flex gap-3">
                  <div className="w-16 h-16 bg-zinc-50 border border-zinc-200 rounded-lg overflow-hidden flex items-center justify-center">
                    {img.image_thumb_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.image_thumb_url} alt={img.alt_text || img.color} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[11px] text-zinc-400">Sin imagen</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate">
                        <p className="text-sm font-medium text-zinc-900 truncate">{img.color}</p>
                        <p className="text-xs text-zinc-500 truncate">{img.alt_text || "—"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {img.is_primary && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">
                            Principal
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteColorImage(img)}
                          className="text-xs px-2 py-1 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-700"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-400">Orden: {img.sort_order}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddColorImage} className="border-t border-zinc-100 pt-4 space-y-3">
            <p className="text-xs text-zinc-500 font-medium">Agregar imagen por color</p>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Color *">
                {useSelectForColor ? (
                  <select
                    value={colorImageForm.color}
                    onChange={(e) => setColorImageForm({ ...colorImageForm, color: e.target.value })}
                    className={INPUT}
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {allowedColors.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={colorImageForm.color}
                    onChange={(e) => setColorImageForm({ ...colorImageForm, color: e.target.value })}
                    className={INPUT}
                    placeholder="Negro..."
                    required
                  />
                )}
              </Field>
              <Field label="Orden">
                <input
                  type="number"
                  min={0}
                  value={colorImageForm.sort_order}
                  onChange={(e) => setColorImageForm({ ...colorImageForm, sort_order: e.target.value })}
                  className={INPUT}
                />
              </Field>
            </div>

            <Field label="Imagen *">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setColorImageForm({ ...colorImageForm, file: e.target.files?.[0] || null })}
                className="block w-full text-sm text-zinc-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-zinc-200 file:bg-white file:text-zinc-700 hover:file:bg-zinc-50"
                required
              />
            </Field>

            <Field label="Alt text (opcional)">
              <input
                type="text"
                value={colorImageForm.alt_text}
                onChange={(e) => setColorImageForm({ ...colorImageForm, alt_text: e.target.value })}
                className={INPUT}
                placeholder="Ej: Camiseta negra"
              />
            </Field>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={colorImageForm.is_primary}
                onChange={(e) => setColorImageForm({ ...colorImageForm, is_primary: e.target.checked })}
                className="w-4 h-4 accent-red-500"
              />
              <span className="text-sm text-zinc-700">Marcar como principal (para este color)</span>
            </label>

            <button
              type="submit"
              disabled={uploadingColorImage}
              className="text-xs px-4 py-2 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 text-zinc-700 rounded-lg transition-colors border border-zinc-200 font-medium"
            >
              {uploadingColorImage ? "Subiendo..." : "+ Agregar imagen"}
            </button>
          </form>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-zinc-500 mb-1 font-medium">{label}</label>
      {children}
    </div>
  );
}
