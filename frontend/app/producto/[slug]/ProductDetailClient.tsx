"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

import { useCartStore } from "@/store/cart";
import { ProductGallery } from "@/components/product/ProductGallery";
import { Button } from "@/components/ui/Button";

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

function colorDotClass(color: string): string {
  const c = (color || "").trim().toLowerCase();
  // For dark UI: keep the pill dark, but the dot for "Blanco" must be visible.
  // Use white fill + subtle dark border + tiny shadow so it doesn't disappear.
  if (c === "blanco")
    return "bg-white border border-black/30 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]";
  if (c === "negro") return "bg-black border border-white/20";
  if (c === "beige") return "bg-[#d6c5a3] border border-white/20";
  if (c === "verde") return "bg-emerald-500/80 border border-white/20";
  if (c === "rojo") return "bg-red-500/80 border border-white/20";
  if (c === "café" || c === "cafe") return "bg-amber-800/80 border border-white/20";
  if (c === "azul") return "bg-sky-500/80 border border-white/20";
  return "bg-white/30 border border-white/20";
}

export function ProductDetailClient({ product }: ProductDetailClientProps) {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);

  const variants = useMemo(() => product.variants ?? [], [product.variants]);

  const soldOut = useMemo(
    () => variants.length > 0 && variants.every((v: any) => (v.stock ?? 0) <= 0),
    [variants]
  );

  const hasValue = variants.some((v) => v.value);
  const hasColor = variants.some((v) => v.color);

  const valueOptions = useMemo(() => {
    const set = new Set<string>();
    variants.forEach((v) => {
      if (v.value) set.add(v.value);
    });
    return Array.from(set);
  }, [variants]);

  const colorOptions = useMemo(() => {
    const set = new Set<string>();
    variants.forEach((v) => {
      if (v.color) set.add(v.color);
    });
    return Array.from(set);
  }, [variants]);

  const firstWithValue = valueOptions[0] ?? "";
  const firstWithColor = colorOptions[0] ?? "";
  const [selectedValue, setSelectedValue] = useState<string>(firstWithValue);
  const [selectedColor, setSelectedColor] = useState<string>(firstWithColor);

  const finalVariant = useMemo(() => {
    return (
      variants.find(
        (v) =>
          (selectedValue ? v.value === selectedValue : true) &&
          (selectedColor ? v.color === selectedColor : true)
      ) ??
      variants[0] ??
      null
    );
  }, [variants, selectedValue, selectedColor]);

  const primaryImage =
    finalVariant?.images?.find((i) => i.is_primary)?.image ??
    finalVariant?.images?.[0]?.image ??
    null;

  const galleryImages =
    finalVariant?.images?.length
      ? finalVariant.images
      : (((product as any).images as any[]) ?? []);

  const handleAddToCart = () => {
    if (!finalVariant) return;
    addItem(
      {
        variantId: finalVariant.id,
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        variantLabel: buildVariantLabel(finalVariant),
        price: product.price,
        imageUrl: primaryImage,
      },
      1
    );
    openCart();
  };

  const canAdd = !soldOut && !!finalVariant && finalVariant.stock > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <nav className="mb-4 text-sm text-neutral-400">
        <Link href="/" className="hover:text-white/90">
          Inicio
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/categoria/${product.category.slug}`}
          className="hover:text-white/90"
        >
          {product.category.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-neutral-100">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <ProductGallery images={galleryImages} productName={product.name} soldOut={soldOut} />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-neutral-100 md:text-3xl">
            {product.name}
          </h1>
          <p className="mt-2 text-2xl font-semibold text-sky-400">
            ${parseFloat(product.price).toLocaleString("es-CO")}
          </p>

          {product.description && (
            <div className="mt-4 whitespace-pre-wrap text-neutral-300">
              {product.description}
            </div>
          )}

          {/* Variantes: valor (talla) */}
          {hasValue && valueOptions.length > 0 && (
            <div className="mt-6">
              <label className="block text-sm font-medium text-neutral-200">
                Talla
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {valueOptions.map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSelectedValue(val)}
                    className={selectedValue === val ? "pill-active" : "pill"}
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
              <label className="block text-sm font-medium text-neutral-200">
                Color
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={selectedColor === color ? "pill-active" : "pill"}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden
                        className={["h-2.5 w-2.5 rounded-full", colorDotClass(color)].join(" ")}
                      />
                      <span>{color}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {finalVariant && (
            <p className="mt-2 text-sm text-neutral-400">
              Stock: {finalVariant.stock} disponible{finalVariant.stock !== 1 ? "s" : ""}
            </p>
          )}

          <div className="mt-6">
            <Button
              type="button"
              onClick={handleAddToCart}
              disabled={!canAdd}
              variant="primary"
              fullWidth
            >
              {canAdd ? "Agregar al carrito" : "Sin stock"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
