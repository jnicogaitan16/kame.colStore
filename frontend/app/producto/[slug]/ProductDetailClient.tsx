"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useCartStore } from "@/store/cart";
import { ProductGallery } from "@/components/product/ProductGallery";
import type { ProductDetail, ProductVariant } from "@/types/catalog";

interface ProductDetailClientProps {
  product: ProductDetail;
}

function buildVariantLabel(v: ProductVariant): string {
  const parts: string[] = [];
  if (v.value) parts.push(v.value);
  if (v.color) parts.push(v.color);
  return parts.join(" / ") || `Variante #${v.id}`;
}

export function ProductDetailClient({ product }: ProductDetailClientProps) {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);

  const variantsWithStock = useMemo(
    () => product.variants.filter((v) => v.stock > 0),
    [product.variants]
  );

  const hasValue = variantsWithStock.some((v) => v.value);
  const hasColor = variantsWithStock.some((v) => v.color);
  const valueOptions = useMemo(() => {
    const set = new Set<string>();
    variantsWithStock.forEach((v) => { if (v.value) set.add(v.value); });
    return Array.from(set);
  }, [variantsWithStock]);
  const colorOptions = useMemo(() => {
    const set = new Set<string>();
    variantsWithStock.forEach((v) => { if (v.color) set.add(v.color); });
    return Array.from(set);
  }, [variantsWithStock]);

  const firstWithValue = valueOptions[0] ?? "";
  const firstWithColor = colorOptions[0] ?? "";
  const [selectedValue, setSelectedValue] = useState<string>(firstWithValue);
  const [selectedColor, setSelectedColor] = useState<string>(firstWithColor);

  const finalVariant = useMemo(() => {
    return variantsWithStock.find(
      (v) =>
        (selectedValue ? v.value === selectedValue : true) &&
        (selectedColor ? v.color === selectedColor : true)
    ) ?? variantsWithStock[0] ?? null;
  }, [variantsWithStock, selectedValue, selectedColor]);

  const primaryImage = finalVariant?.images?.find((i) => i.is_primary)?.image
    ?? finalVariant?.images?.[0]?.image
    ?? null;

  const handleAddToCart = () => {
    if (!finalVariant) return;
    addItem({
      variantId: finalVariant.id,
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      variantLabel: buildVariantLabel(finalVariant),
      price: product.price,
      imageUrl: primaryImage,
    }, 1);
    openCart();
  };

  const canAdd = finalVariant && finalVariant.stock > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/" className="hover:text-brand-600">Inicio</Link>
        <span className="mx-2">/</span>
        <Link href={`/categoria/${product.category.slug}`} className="hover:text-brand-600">
          {product.category.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-800">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <ProductGallery
            images={finalVariant?.images ?? []}
            productName={product.name}
          />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">
            {product.name}
          </h1>
          <p className="mt-2 text-2xl font-semibold text-brand-600">
            ${parseFloat(product.price).toLocaleString("es-CO")}
          </p>
          {product.description && (
            <div className="mt-4 text-slate-600 whitespace-pre-wrap">
              {product.description}
            </div>
          )}

          {/* Variantes: valor (talla) */}
          {hasValue && valueOptions.length > 0 && (
            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-700">
                Talla
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {valueOptions.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSelectedValue(val)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                      selectedValue === val
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Variantes: color */}
          {hasColor && colorOptions.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700">
                Color
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                      selectedColor === color
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {finalVariant && (
            <p className="mt-2 text-sm text-slate-500">
              Stock: {finalVariant.stock} disponible{finalVariant.stock !== 1 ? "s" : ""}
            </p>
          )}

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!canAdd}
            className="mt-6 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto md:px-8"
          >
            {canAdd ? "Agregar al carrito" : "Sin stock"}
          </button>
        </div>
      </div>
    </div>
  );
}
