/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { getPrimaryImageUrl, normalizeMediaUrl } from "@/lib/api";

import { useCartStore } from "@/store/cart";
import { ProductGallery } from "@/components/product/ProductGallery";
import { Button } from "@/components/ui/Button";
import ShareButton from "@/components/ui/ShareButton";
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

  const variantSchema = (product.category?.variant_schema || "size_color") as
    | "size_color"
    | "jean_size"
    | "no_variant"
    | "dimension"
    | string;

  const requiresValue = variantSchema !== "no_variant";
  const requiresColor = variantSchema === "size_color";
  const colorOptional = variantSchema === "jean_size";

  const hasValue = requiresValue && variants.some((v) => v.value);
  const hasColor = requiresColor && variants.some((v) => v.color);

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
      className="pdp-guide-link-inline"
    >
      Guía de medidas
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
    if (!requiresValue) return (product.stock_total ?? 0) > 0;

    // jean_size: color opcional -> basta con que exista cualquier variante con esa talla y stock
    if (variantSchema === "jean_size") {
      return variants.some((v: any) => v.value === val && (v.stock ?? 0) > 0);
    }

    // size_color: depende de color seleccionado (si hay)
    return variants.some(
      (v: any) =>
        v.value === val &&
        (selectedColor ? v.color === selectedColor : true) &&
        (v.stock ?? 0) > 0
    );
  };

  const colorDisponible = (color: string) => {
    // Solo aplica a size_color
    if (!requiresColor) return true;

    return variants.some(
      (v: any) =>
        v.color === color &&
        (selectedValue ? v.value === selectedValue : true) &&
        (v.stock ?? 0) > 0
    );
  };

  const selectedVariant = useMemo(() => {
    if (!variants.length) return null;

    if (variantSchema === "no_variant") return null;

    // size_color: requiere value + color
    if (variantSchema === "size_color") {
      if (!selectedValue || !selectedColor) return null;
      return (
        variants.find((v) => v.value === selectedValue && v.color === selectedColor) ??
        null
      );
    }

    // jean_size: requiere value; color opcional
    if (variantSchema === "jean_size") {
      if (!selectedValue) return null;

      // If user selected a color, try exact match first
      if (selectedColor) {
        const exact = variants.find((v) => v.value === selectedValue && v.color === selectedColor) ?? null;
        if (exact) return exact;
      }

      // Otherwise, pick an available one (stock>0) for that value, else any
      const available = variants.find((v: any) => v.value === selectedValue && (v.stock ?? 0) > 0) ?? null;
      return available ?? (variants.find((v) => v.value === selectedValue) ?? null);
    }

    // dimension u otros: trata como requiere value (sin color)
    if (!selectedValue) return null;
    const available = variants.find((v: any) => v.value === selectedValue && (v.stock ?? 0) > 0) ?? null;
    return available ?? (variants.find((v) => v.value === selectedValue) ?? null);
  }, [variants, selectedValue, selectedColor, variantSchema]);

  const isInvalidCombo = useMemo(() => {
    if (!variants.length) return false;

    if (variantSchema === "no_variant") return false;

    if (variantSchema === "size_color") {
      return (
        hasValue &&
        hasColor &&
        !!selectedValue &&
        !!selectedColor &&
        !selectedVariant
      );
    }

    if (variantSchema === "jean_size") {
      if (!selectedValue) return false;

      // invalid if there is no variant for that value at all
      const anyForValue = variants.some((v) => v.value === selectedValue);
      if (!anyForValue) return true;

      // If a color is explicitly chosen, and no exact match exists, treat as invalid combo.
      if (selectedColor) {
        const exact = variants.some((v) => v.value === selectedValue && v.color === selectedColor);
        return !exact;
      }

      return false;
    }

    // dimension/others: invalid if selectedValue exists but no variant
    if (!selectedValue) return false;
    return !variants.some((v) => v.value === selectedValue);
  }, [variants, variantSchema, hasValue, hasColor, selectedValue, selectedColor, selectedVariant]);

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

  const img = useMemo(() => getPrimaryImageUrl(product as any), [product]);

  // Primary image for cart/UI: prefer selected/display variant, then fallback to product canonical image
  const primaryImage = getPrimaryImageUrl((displayVariant as any) || (product as any)) || img || null;

  const normalizeImages = (input: any): Array<{ url: string; thumb_url?: string | null; alt_text?: string | null }> => {
    const arr: any[] = Array.isArray(input) ? input : input ? [input] : [];

    return arr
      .map((img: any) => {
        // Case 1: already a URL string
        if (typeof img === "string") {
          const raw = img.trim();
          if (!raw) return null;
          const url = normalizeMediaUrl(raw);
          if (!url) return null;
          return { url, thumb_url: url };
        }

        // Case 2: object with different possible keys
        if (img && typeof img === "object") {
          const rawUrl = (img.url || img.image || img.src || img.image_url || "").toString().trim();

          const rawThumb = (
            img.thumb_url ||
            img.image_thumb ||
            img.thumbnail ||
            img.thumb ||
            img.thumbUrl ||
            rawUrl
          )
            .toString()
            .trim();

          const altTextRaw = (img.alt_text || img.altText || img.alt || "").toString().trim();

          if (!rawUrl) return null;

          const url = normalizeMediaUrl(rawUrl);
          if (!url) return null;

          const thumbNorm = normalizeMediaUrl(rawThumb || rawUrl);
          const thumb_url = thumbNorm || url;

          // Ensure we always return the ProductImage-ish contract
          return {
            ...img,
            url,
            thumb_url,
            alt_text: altTextRaw || null,
          };
        }

        return null;
      })
      .filter(Boolean) as Array<{ url: string; thumb_url?: string | null; alt_text?: string | null }>;
  };

  const galleryImages =
    displayVariant && (displayVariant as any).images
      ? normalizeImages((displayVariant as any).images)
      : normalizeImages((product as any).images);

  const handleAddToCart = () => {
    if (isInvalidCombo) return;

    // no_variant: no selector; if there is a single variant use it, otherwise allow product-level stock only.
    if (variantSchema === "no_variant") {
      const v0 = variants.length === 1 ? variants[0] : null;
      if (!v0) return;
      if ((product.stock_total ?? 0) <= 0) return;

      addItem(
        {
          variantId: v0.id,
          productId: product.id,
          productName: product.name,
          productSlug: product.slug,
          variantLabel: buildVariantLabel(v0),
          price: product.price,
          imageUrl: primaryImage,
        },
        1
      );

      openCart();
      return;
    }

    const variantToAdd = selectedVariant ?? (variants.length === 1 ? variants[0] : null);
    if (!variantToAdd) return;

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

  const selectedOutOfStock = useMemo(() => {
    if (isInvalidCombo) return true;

    if (variantSchema === "no_variant") {
      return (product.stock_total ?? 0) <= 0;
    }

    // If schema requires a selection, and no selectedVariant, treat as out-of-stock/disabled.
    if (variantSchema === "size_color") {
      if (!selectedVariant) return true;
      return (selectedVariant.stock ?? 0) <= 0;
    }

    // jean_size / dimension: require value; if no selectedValue yet, disable
    if (!selectedValue) return true;
    if (!selectedVariant) return true;
    return (selectedVariant.stock ?? 0) <= 0;
  }, [isInvalidCombo, variantSchema, product.stock_total, selectedVariant, selectedValue]);

  const canAdd = !selectedOutOfStock;

  const availableStock = useMemo(() => {
    if (variantSchema === "no_variant") return product.stock_total ?? 0;
    return selectedVariant ? (selectedVariant.stock ?? 0) : 0;
  }, [variantSchema, product.stock_total, selectedVariant]);

  const uiSoldOut = (product.sold_out === true) || selectedOutOfStock;

  return (
    <section className="mx-auto max-w-6xl pt-0 pb-6 md:pb-10">

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-10">
        <div>
          <div className="pdp-hero">
            <div className="pdp-hero-bleed">
              {Array.isArray(galleryImages) && galleryImages.length > 0 ? (
                <ProductGallery
                  images={galleryImages}
                  productName={product.name}
                  soldOut={uiSoldOut}
                  variant="pdp"
                />
              ) : img ? (
                <div className="aspect-square w-full bg-black/20">
                  <img
                    src={img}
                    alt={product?.name || "Producto"}
                    className="h-full w-full object-cover"
                    loading="eager"
                  />
                </div>
              ) : (
                <div className="aspect-square w-full bg-black/20">
                  <div className="flex h-full w-full items-center justify-center text-neutral-600">
                    {/* placeholder */}
                    Sin imagen
                  </div>
                </div>
              )}
            </div>



            <div className="pdp-hero-fade" />
          </div>
        </div>

        <div className="px-4 pt-4 md:px-6">
          {/* Header (arriba del fold) */}
          <div className="relative flex items-start gap-3">
            <div className="pr-12">
              <h1 className="text-2xl font-semibold tracking-tight text-neutral-100 md:text-3xl">
                {product.name}
              </h1>
              <p className="mt-1 text-2xl font-semibold text-cyan-400">
                ${parseFloat(product.price).toLocaleString("es-CO")}
              </p>
            </div>

            <div className="absolute right-0 top-0">
              <ShareButton
                title={`${product.name} | Kame.col`}
                url={typeof window !== "undefined" ? window.location.href : ""}
                ariaLabel="Compartir producto"
              />
            </div>
          </div>

          {/* Selectores */}
          <div className="mt-6 space-y-4">
            {product.category.slug === "cuadros" && sizeGuideTrigger && (
              <div className="flex items-center">
                {sizeGuideTrigger}
              </div>
            )}
            {( (requiresValue && valueOptions.length > 0 && variantSchema !== "no_variant" && product.category.slug !== "cuadros") ||
                (requiresColor && colorOptions.length > 0)
              ) ? (
              <div className="pdp-controls-grid">
                {/* Color (izquierda) */}
                <div>
                  {requiresColor && colorOptions.length > 0 ? (
                    <>
                      <div className="pdp-section-title md:justify-end">Color</div>
                      <div className="pdp-variant-section">
                        <div className="pdp-color-grid">
                          {colorOptions.map((color) => {
                            const available = colorDisponible(color);
                            const selected = selectedColor === color;
                            const disabled = !available;

                            return (
                              <button
                                key={color}
                                type="button"
                                className={
                                  "pdp-color-chip " +
                                  (selected ? "pdp-color-chip--selected " : "") +
                                  (disabled ? "pdp-color-chip--disabled " : "")
                                }
                                disabled={disabled}
                                onClick={() => setSelectedColor(color)}
                                aria-pressed={selected}
                                title={available ? color : `${color} (no disponible)`}
                              >
                                {color}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    // Keep grid alignment even when color isn't applicable
                    <div />
                  )}
                </div>

                {/* Talla (derecha) */}
                <div>
                  {requiresValue && valueOptions.length > 0 && variantSchema !== "no_variant" && product.category.slug !== "cuadros" ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="pdp-section-title">Talla</div>
                        {sizeGuideTrigger ? sizeGuideTrigger : null}
                      </div>

                      <div className="pdp-variant-section">
                        <div className="pdp-size-grid">
                          {valueOptions.map((val) => {
                            const available = tallaDisponible(val);
                            const selected = selectedValue === val;
                            const disabled = !available;
                            return (
                              <button
                                key={val}
                                type="button"
                                className={
                                  "pdp-size-item " +
                                  (selected ? "pdp-size-item--selected " : "") +
                                  (disabled ? "pdp-size-item--disabled " : "")
                                }
                                disabled={disabled}
                                onClick={() => setSelectedValue(val)}
                                aria-pressed={selected}
                                title={available ? val : `${val} (no disponible)`}
                              >
                                {val}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    // Keep grid alignment even when talla isn't applicable
                    <div />
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Stock + CTA */}
          <div className="mt-6">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
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
    </section>
  );
}
