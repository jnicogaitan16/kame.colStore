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

function buildVariantLabel(
  v: ProductVariant,
  variantSchema?: string
): string {
  const schema = String(variantSchema || "").trim().toLowerCase();
  const parts: string[] = [];
  if (v.value) parts.push(v.value);
  if (v.color) parts.push(v.color);

  if (parts.length > 0) {
    return parts.join(" / ");
  }

  if (schema === "no_variant") {
    return "";
  }

  return `Variante #${v.id}`;
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

const APPAREL_ORDER = ["S", "M", "L", "XL", "2XL"];
const SHOE_ORDER = ["36", "37", "38", "39", "40", "41", "42"];

function sortVariantValuesForSchema(
  values: string[],
  variantSchema: string,
  categorySlug?: string | null
): string[] {
  const cleaned = Array.from(
    new Set(values.map((v) => String(v || "").trim()).filter(Boolean))
  );

  let canonical: string[] = [];

  if (variantSchema === "size_color") {
    canonical = APPAREL_ORDER;
  } else if (variantSchema === "shoe_size") {
    canonical = SHOE_ORDER;
  } else if (variantSchema === "jean_size") {
    return cleaned.sort((a, b) => Number(a) - Number(b));
  } else {
    return cleaned.sort();
  }

  const orderMap = new Map(canonical.map((v, i) => [v, i]));
  const known = cleaned.filter((v) => orderMap.has(v));
  const unknown = cleaned.filter((v) => !orderMap.has(v));

  known.sort((a, b) => orderMap.get(a)! - orderMap.get(b)!);
  unknown.sort();

  return [...known, ...unknown];
}

export function ProductDetailClient({ product }: ProductDetailClientProps) {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);

  const variants = useMemo(() => product.variants ?? [], [product.variants]);

  const variantSchema = (product.category?.variant_schema || "size_color") as
    | "size_color"
    | "jean_size"
    | "shoe_size"
    | "no_variant"
    | string;


  const requiresValue =
    variantSchema === "size_color" ||
    variantSchema === "jean_size" ||
    variantSchema === "shoe_size";
  const requiresColor = variantSchema === "size_color";

  const hasValue = requiresValue && variants.some((v) => v.value);
  const hasColor = requiresColor && variants.some((v) => v.color);

  const valueOptions = useMemo(() => {
    const rawValues = variants
      .map((v) => v.value)
      .filter((v): v is string => Boolean(v && String(v).trim()));

    return sortVariantValuesForSchema(
      rawValues,
      variantSchema,
      product.category?.slug
    );
  }, [variants, variantSchema, product.category?.slug]);

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

  const findExactSizeColorVariant = (value: string, color: string) => {
    const normalizedValue = (value || "").trim();
    const normalizedColor = (color || "").trim();
    if (!normalizedValue || !normalizedColor) return null;

    return (
      variants.find(
        (v) =>
          (v.value || "").trim() === normalizedValue &&
          (v.color || "").trim() === normalizedColor
      ) ?? null
    );
  };

  const sizeExistsForSelectedColor = (value: string, color: string) => {
    return !!findExactSizeColorVariant(value, color);
  };

  const sizeInSelectedColorHasStock = (value: string, color: string) => {
    const match = findExactSizeColorVariant(value, color);
    return !!match && (match.stock ?? 0) > 0;
  };

  const colorExistsForSelectedValue = (color: string, value: string) => {
    return !!findExactSizeColorVariant(value, color);
  };

  const colorForSelectedValueHasStock = (color: string, value: string) => {
    const match = findExactSizeColorVariant(value, color);
    return !!match && (match.stock ?? 0) > 0;
  };

  const tallaDisponible = (val: string) => {
    if (!requiresValue) return (product.stock_total ?? 0) > 0;

    if (variantSchema === "size_color") {
      if (!selectedColor) return false;
      return sizeInSelectedColorHasStock(val, selectedColor);
    }

    if (variantSchema === "jean_size") {
      return variants.some((v: any) => v.value === val && (v.stock ?? 0) > 0);
    }

    return variants.some((v: any) => v.value === val && (v.stock ?? 0) > 0);
  };

  const colorDisponible = (color: string) => {
    if (!requiresColor) return true;

    if (!selectedValue) {
      return variants.some(
        (v: any) => v.color === color && (v.stock ?? 0) > 0
      );
    }

    return colorForSelectedValueHasStock(color, selectedValue);
  };

  const tallaAgotada = (val: string) => {
    if (!requiresValue) return (product.stock_total ?? 0) <= 0;

    if (variantSchema === "size_color") {
      if (!selectedColor) return true;
      if (!sizeExistsForSelectedColor(val, selectedColor)) return true;
      return !sizeInSelectedColorHasStock(val, selectedColor);
    }

    if (variantSchema === "jean_size") {
      return !variants.some((v: any) => v.value === val && (v.stock ?? 0) > 0);
    }

    return !variants.some((v: any) => v.value === val && (v.stock ?? 0) > 0);
  };

  const colorAgotado = (color: string) => {
    if (!requiresColor) return false;

    if (!selectedValue) {
      return !variants.some(
        (v: any) => v.color === color && (v.stock ?? 0) > 0
      );
    }

    if (!colorExistsForSelectedValue(color, selectedValue)) return true;
    return !colorForSelectedValueHasStock(color, selectedValue);
  };

  const pickNextValueForColor = (color: string) => {
    const normalizedColor = (color || "").trim();
    if (!normalizedColor) return "";

    // 1) Intentar mantener la talla actual si la combinación exacta existe
    if (selectedValue) {
      const exactMatch = variants.find(
        (v: any) =>
          v.color === normalizedColor &&
          v.value === selectedValue &&
          (v.stock ?? 0) > 0
      ) ?? null;

      if (exactMatch?.value) return exactMatch.value;

      const exactAnyStock = variants.find(
        (v) => v.color === normalizedColor && v.value === selectedValue
      ) ?? null;

      if (exactAnyStock?.value) return exactAnyStock.value;
    }

    // 2) Fallback: primera variante disponible de ese color
    const availableMatch =
      variants.find(
        (v: any) => v.color === normalizedColor && (v.stock ?? 0) > 0
      ) ?? null;

    if (availableMatch?.value) return availableMatch.value;

    // 3) Último fallback: cualquier variante de ese color
    const anyMatch = variants.find((v) => v.color === normalizedColor) ?? null;
    return anyMatch?.value ?? "";
  };

  const pickNextColorForValue = (val: string) => {
    const normalizedValue = (val || "").trim();
    if (!normalizedValue) return "";

    // 1) Intentar mantener el color actual si la combinación exacta existe
    if (selectedColor) {
      const exactMatch = variants.find(
        (v: any) =>
          v.value === normalizedValue &&
          v.color === selectedColor &&
          (v.stock ?? 0) > 0
      ) ?? null;

      if (exactMatch?.color) return exactMatch.color;

      const exactAnyStock = variants.find(
        (v) => v.value === normalizedValue && v.color === selectedColor
      ) ?? null;

      if (exactAnyStock?.color) return exactAnyStock.color;
    }

    // 2) Fallback: primera variante disponible de esa talla
    const availableMatch =
      variants.find(
        (v: any) => v.value === normalizedValue && (v.stock ?? 0) > 0
      ) ?? null;

    if (availableMatch?.color) return availableMatch.color;

    // 3) Último fallback: cualquier variante de esa talla
    const anyMatch = variants.find((v) => v.value === normalizedValue) ?? null;
    return anyMatch?.color ?? "";
  };

  const selectedVariant = useMemo(() => {
    if (!variants.length) return null;

    if (variantSchema === "no_variant") {
      return variants.length === 1 ? variants[0] : firstAvailableVariant ?? variants[0] ?? null;
    }

    if (variantSchema === "size_color") {
      if (!selectedValue || !selectedColor) return null;
      return (
        variants.find((v) => v.value === selectedValue && v.color === selectedColor) ??
        null
      );
    }

    if (variantSchema === "jean_size" || variantSchema === "shoe_size") {
      if (!selectedValue) return null;
      const available =
        variants.find((v: any) => v.value === selectedValue && (v.stock ?? 0) > 0) ?? null;
      return available ?? (variants.find((v) => v.value === selectedValue) ?? null);
    }

    return null;
  }, [variants, selectedValue, selectedColor, variantSchema, firstAvailableVariant]);

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

    if (variantSchema === "jean_size" || variantSchema === "shoe_size") {
      if (!selectedValue) return false;
      return !variants.some((v) => v.value === selectedValue);
    }

    return false;
  }, [variants, variantSchema, hasValue, hasColor, selectedValue, selectedColor, selectedVariant]);

  const displayVariant = useMemo(() => {
    if (!variants.length) return null;

    // Visual-only fallback order (do NOT affect cart):
    // - SIZE_COLOR: the gallery must respond to color, not size.
    //   1) exact selectedVariant
    //   2) any variant of the selected color (prefer one with images)
    //   3) first available by stock
    //   4) first variant
    // - Other schemas can keep the broader fallback behavior.
    if (variantSchema === "size_color") {
      const byColor = selectedColor ? findByColorPreferImages(selectedColor) : null;

      return (
        selectedVariant ??
        byColor ??
        firstAvailableVariant ??
        variants[0] ??
        null
      );
    }

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
  }, [
    variants,
    selectedVariant,
    selectedColor,
    selectedValue,
    firstAvailableVariant,
    variantSchema,
  ]);

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
          variantLabel: buildVariantLabel(v0, variantSchema),
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
        variantLabel: buildVariantLabel(variantToAdd, variantSchema),
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

    if (variantSchema === "size_color") {
      if (!selectedVariant) return true;
      return (selectedVariant.stock ?? 0) <= 0;
    }

    if (variantSchema === "jean_size" || variantSchema === "shoe_size") {
      if (!selectedValue) return true;
      if (!selectedVariant) return true;
      return (selectedVariant.stock ?? 0) <= 0;
    }

    return true;
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
                url={`/producto/${encodeURIComponent(product.slug)}`}
                ariaLabel="Compartir producto"
              />
            </div>
          </div>

          {/* Selectores */}
          <div className="mt-6 space-y-4">
            {!requiresValue && !requiresColor && sizeGuideTrigger && (
              <div className="flex items-center">
                {sizeGuideTrigger}
              </div>
            )}
            {((requiresValue && valueOptions.length > 0) ||
              (requiresColor && colorOptions.length > 0)) ? (
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
                            const soldOut = colorAgotado(color);
                            const selected = selectedColor === color;

                            return (
                              <button
                                key={color}
                                type="button"
                                className={
                                  "pdp-color-chip " +
                                  (selected ? "pdp-color-chip--selected " : "") +
                                  (soldOut ? "pdp-color-chip--disabled " : "")
                                }
                                disabled={soldOut}
                                onClick={() => {
                                  if (soldOut) return;
                                  setSelectedColor(color);
                                }}
                                aria-pressed={selected}
                                aria-disabled={soldOut}
                                title={soldOut ? `${color} (sold out)` : color}
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
                  {requiresValue && valueOptions.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="pdp-section-title">Talla</div>
                        {sizeGuideTrigger ? sizeGuideTrigger : null}
                      </div>

                      <div className="pdp-variant-section">
                        <div className="pdp-size-grid">
                          {valueOptions.map((val) => {
                            const available = tallaDisponible(val);
                            const soldOut = tallaAgotada(val);
                            const selected = selectedValue === val;
                            return (
                              <button
                                key={val}
                                type="button"
                                className={
                                  "pdp-size-item " +
                                  (selected ? "pdp-size-item--selected " : "") +
                                  (soldOut ? "pdp-size-item--disabled " : "")
                                }
                                disabled={soldOut}
                                onClick={() => {
                                  if (soldOut) return;
                                  setSelectedValue(val);
                                }}
                                aria-pressed={selected}
                                aria-disabled={soldOut}
                                title={soldOut ? `${val} (sold out)` : val}
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
              ) : selectedVariant ? (
                <span className="text-neutral-400">
                  Sold out
                </span>
              ) : (
                <span className="text-neutral-400">
                  {requiresColor ? "Selecciona una talla y color." : "Selecciona una talla."}
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
