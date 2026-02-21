"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

import { useCartStore } from "@/store/cart";
import { ProductGallery } from "@/components/product/ProductGallery";
import { Button } from "@/components/ui/Button";
import SizeGuideDrawer from "@/components/product/SizeGuideDrawer";

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

  const findByColorPreferImages = (color: string) => {
    const c = (color || "").trim();
    if (!c) return null;
    const withImages = variants.find((v) => v.color === c && (v.images?.length ?? 0) > 0) ?? null;
    return withImages ?? (variants.find((v) => v.color === c) ?? null);
  };

  const findByValuePreferImages = (val: string) => {
    const v0 = (val || "").trim();
    if (!v0) return null;
    const withImages = variants.find((v) => v.value === v0 && (v.images?.length ?? 0) > 0) ?? null;
    return withImages ?? (variants.find((v) => v.value === v0) ?? null);
  };

  const defaultValue = (firstAvailableVariant?.value ?? firstWithValue) as string;
  const defaultColor = (firstAvailableVariant?.color ?? firstWithColor) as string;

  const [selectedValue, setSelectedValue] = useState<string>(() => defaultValue);
  const [selectedColor, setSelectedColor] = useState<string>(() => defaultColor);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  const resolveSizeGuideKey = (slug?: string) => {
    if (!slug) return null;

    if (slug === "camisetas") return "oversize" as const;
    if (slug === "hoodies") return "hoodie" as const;
    if (slug === "cuadros") return "frame_20x30" as const;

    return null;
  };

  const sizeGuideKey = resolveSizeGuideKey(product.category?.slug);

  const sizeGuideTrigger = sizeGuideKey ? (
    <button
      type="button"
      onClick={() => setSizeGuideOpen(true)}
      aria-label="Abrir guía de medidas"
      className="inline-flex items-center gap-1 text-xs font-medium text-sky-300/90 underline underline-offset-4 decoration-white/15 hover:text-sky-200 hover:decoration-white/30"
    >
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[10px] leading-none text-neutral-200/90">
        ?
      </span>
      <span className="tracking-normal">Guía de medidas</span>
    </button>
  ) : null;

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

  const selectedVariant = useMemo(() => {
    if (!variants.length) return null;

    // Only consider an "exact" match when both selectors are defined.
    if (!selectedValue || !selectedColor) return null;

    return (
      variants.find(
        (v) => v.value === selectedValue && v.color === selectedColor
      ) ?? null
    );
  }, [variants, selectedValue, selectedColor]);

  const displayVariant = useMemo(() => {
    if (!variants.length) return null;

    // UI-only fallback order (do NOT affect cart):
    // 1) exact selectedVariant (even if stock is 0)
    // 2) same color (prefer a variant of that color that has images)
    // 3) same value/size (prefer a variant of that value that has images)
    // 4) first available by stock
    // 5) first variant
    const byColor = selectedColor ? findByColorPreferImages(selectedColor) : null;
    const byValue = selectedValue ? findByValuePreferImages(selectedValue) : null;

    return (
      selectedVariant ??
      byColor ??
      byValue ??
      firstAvailableVariant ??
      variants[0] ??
      null
    );
  }, [variants, selectedVariant, selectedColor, selectedValue, firstAvailableVariant]);

  const isInvalidCombo =
    hasValue &&
    hasColor &&
    !!selectedValue &&
    !!selectedColor &&
    !selectedVariant;

  const primaryImage =
    displayVariant?.images?.find((i) => i.is_primary)?.image ??
    displayVariant?.images?.[0]?.image ??
    null;

  const galleryImages =
    displayVariant?.images?.length
      ? displayVariant.images
      : (((product as any).images as any[]) ?? []);

  const handleAddToCart = () => {
    const variantToAdd = selectedVariant ?? (variants.length === 1 ? variants[0] : null);
    if (!variantToAdd) return;
    if (isInvalidCombo) return;

    addItem(
      {
        variantId: variantToAdd.id,
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        variantLabel: buildVariantLabel(variantToAdd),
        price: product.price,
        imageUrl: primaryImage,
      },
      1
    );

    openCart();
  };

  const selectedOutOfStock =
    isInvalidCombo ||
    (selectedVariant ? (selectedVariant.stock ?? 0) <= 0 : (product.stock_total ?? 0) <= 0);

  const canAdd =
    !isInvalidCombo &&
    (selectedVariant ? (selectedVariant.stock ?? 0) > 0 : (product.stock_total ?? 0) > 0);
  const availableStock = selectedVariant
    ? (selectedVariant.stock ?? 0)
    : (product.stock_total ?? 0);

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
          <ProductGallery
            images={galleryImages}
            productName={product.name}
            soldOut={product.sold_out === true}
          />
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
            {product.category.slug === "cuadros" && sizeGuideTrigger && (
              <div className="flex items-center">
                {sizeGuideTrigger}
              </div>
            )}
            {/* Variantes: valor (talla) */}
            {hasValue && valueOptions.length > 0 && product.category.slug !== "cuadros" && (
              <div>
                <div className="flex items-center gap-2">
                  <label className="block text-sm font-medium text-neutral-200">Talla</label>
                  {sizeGuideTrigger}
                </div>

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
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-neutral-400">
              {isInvalidCombo ? (
                <span className="text-neutral-400">
                  Esta combinación no está disponible. Prueba otra talla o color.
                </span>
              ) : availableStock > 0 ? (
                <span>
                  Stock: {availableStock} disponible{availableStock !== 1 ? "s" : ""}
                </span>
              ) : (
                <span className="text-neutral-400">
                  No hay unidades disponibles por ahora.
                </span>
              )}
            </div>

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

            </section>
          ) : null}
        </div>
      </div>

      {sizeGuideKey && (
        <SizeGuideDrawer
          open={sizeGuideOpen}
          onClose={() => setSizeGuideOpen(false)}
          guideKey={sizeGuideKey}
        />
      )}
    </div>
  );
}
