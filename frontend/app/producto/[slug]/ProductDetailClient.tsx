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

  const soldOutProduct = useMemo(
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

  const firstAvailableVariant = useMemo(
    () => variants.find((v: any) => (v.stock ?? 0) > 0) ?? null,
    [variants]
  );

  const defaultValue = (firstAvailableVariant?.value ?? firstWithValue) as string;
  const defaultColor = (firstAvailableVariant?.color ?? firstWithColor) as string;

  const [selectedValue, setSelectedValue] = useState<string>(() => defaultValue);
  const [selectedColor, setSelectedColor] = useState<string>(() => defaultColor);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const optionBase =
    "inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold tracking-wide text-neutral-200 transition-colors hover:bg-white/10 hover:border-white/20 focus:outline-none";

  const optionSelected =
    "bg-white/10 border-white/20 ring-2 ring-cyan-400/60 ring-offset-0";

  const optionMuted = "text-neutral-300";

  const optionUnavailable = "opacity-50 line-through";

  const optionClass = (isSelected: boolean, isAvailable: boolean) =>
    `${optionBase} ${isSelected ? optionSelected : ""} ${isAvailable ? "" : optionUnavailable}`;

  const tallaDisponible = (val: string) => {
    return variants.some(
      (v: any) =>
        v.value === val &&
        (selectedColor ? v.color === selectedColor : true) &&
        (v.stock ?? 0) > 0
    );
  };

  const colorDisponible = (color: string) => {
    return variants.some(
      (v: any) =>
        v.color === color &&
        (selectedValue ? v.value === selectedValue : true) &&
        (v.stock ?? 0) > 0
    );
  };

  const finalVariant = useMemo(() => {
    if (!variants.length) return null;

    const exact = variants.find(
      (v) =>
        (selectedValue ? v.value === selectedValue : true) &&
        (selectedColor ? v.color === selectedColor : true)
    );
    if (exact) return exact;

    // Fallbacks to avoid jumping to unrelated variants
    if (selectedColor) {
      const sameColor = variants.find((v) => v.color === selectedColor);
      if (sameColor) return sameColor;
    }

    if (selectedValue) {
      const sameValue = variants.find((v) => v.value === selectedValue);
      if (sameValue) return sameValue;
    }

    return variants[0];
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

  const selectedOutOfStock = !!finalVariant && (finalVariant.stock ?? 0) <= 0;
  const canAdd = !!finalVariant && (finalVariant.stock ?? 0) > 0;

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
          <ProductGallery images={galleryImages} productName={product.name} soldOut={selectedOutOfStock} />
        </div>

        <div>
          {/* Header (arriba del fold) */}
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-100 md:text-3xl">
            {product.name}
          </h1>
          <p className="mt-2 text-2xl font-semibold text-cyan-400">
            ${parseFloat(product.price).toLocaleString("es-CO")}
          </p>

          {/* Selectores */}
          <div className="mt-6 space-y-4">
            {/* Variantes: valor (talla) */}
            {hasValue && valueOptions.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-neutral-200">Talla</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {valueOptions.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSelectedValue(val)}
                      className={optionClass(selectedValue === val, tallaDisponible(val))}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Variantes: color */}
            {hasColor && colorOptions.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-neutral-200">Color</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={optionClass(selectedColor === color, colorDisponible(color)) + " " + optionMuted}
                    >
                      <span className="inline-flex items-center">
                        <span>{color}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stock + CTA */}
          <div className="mt-6">
            {finalVariant && (
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-neutral-400">
                {!selectedOutOfStock ? (
                  <span>
                    Stock: {finalVariant.stock} disponible{finalVariant.stock !== 1 ? "s" : ""}
                  </span>
                ) : (
                  <>
                    <span className="text-neutral-400">
                      No hay unidades disponibles por ahora. Prueba otra talla o color.
                    </span>
                  </>
                )}
              </div>
            )}

            <Button
              type="button"
              onClick={handleAddToCart}
              disabled={!canAdd}
              variant="primary"
              fullWidth
              className="rounded-xl disabled:bg-white/10 disabled:text-white/70 disabled:shadow-none"
            >
              {canAdd ? "Agregar al carrito" : "Sin stock"}
            </Button>
          </div>

          {/* Contenido inferior: Descripción */}
          {product.description ? (
            <section className="mt-8 border-t border-white/10 pt-6">
              <h2 className="text-sm font-semibold tracking-wide text-neutral-100">Descripción</h2>

              <div className={detailsExpanded ? "mt-3 whitespace-pre-wrap text-neutral-300" : "mt-3 whitespace-pre-wrap text-neutral-300 line-clamp-4"}>
                {product.description}
              </div>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setDetailsExpanded((v) => !v)}
                  className="text-sm font-semibold text-cyan-400 hover:text-cyan-300"
                >
                  {detailsExpanded ? "Ver menos" : "Ver más"}
                </button>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-100">Guía de tallas</p>
                    <p className="mt-1 text-sm text-neutral-400">
                      Revisa medidas recomendadas para elegir la talla ideal.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-sm font-semibold text-cyan-400 hover:text-cyan-300"
                    aria-label="Ver guía de tallas"
                  >
                    Ver guía
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
