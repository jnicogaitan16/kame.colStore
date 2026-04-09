/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { HomepageMarqueeProduct } from "@/lib/api";

import { useCartStore } from "@/store/cart";
import { ProductGallery } from "@/components/product/ProductGallery";
import SizeGuideDrawer from "@/components/product/SizeGuideDrawer";
import { Button } from "@/components/ui/Button";
import ShareButton from "@/components/ui/ShareButton";
import { ProductDiscoveryRail } from "@/components/product/ProductDiscoveryRail";

import type { ProductVariant, SizeGuide } from "@/types/catalog";
import { useTrackAddToCart, useTrackProductView } from "@/hooks/useTracking";

type VariantSchema =
  | "size_color"
  | "jean_size"
  | "shoe_size"
  | "no_variant"
  | string;

type GalleryImage = {
  url: string;
  thumb_url?: string | null;
  alt_text?: string | null;
};

type PDPViewModel = {
  id: number;
  name: string;
  slug: string;
  price: string;
  description?: string | null;
  sold_out?: boolean;
  stock_total?: number;
  category?: {
    slug?: string | null;
    variant_schema?: string | null;
    size_guide?: SizeGuide | null;
  } | null;
  variants?: ProductVariant[];
  variantSchema?: VariantSchema;
  requiresValue?: boolean;
  requiresColor?: boolean;
  valueOptions?: string[];
  colorOptions?: string[];
  primaryImage?: string | null;
  primaryThumb?: string | null;
  primaryMedium?: string | null;
  canonicalProductImage?: string | null;
  galleryImages?: GalleryImage[];
  firstAvailableVariantId?: number | null;
  initialDisplayVariantId?: number | null;
  variantsByColor?: Record<string, ProductVariant[]>;
  variantsByValue?: Record<string, ProductVariant[]>;
  variantByColorValue?: Record<string, ProductVariant>;
  variantGalleryImagesById?: Record<string, GalleryImage[]>;
  variantPrimaryImageById?: Record<string, string | null>;
};

interface ProductDetailClientProps {
  product: PDPViewModel;
  moreFromKame: HomepageMarqueeProduct[];
}

type SelectionState = {
  variantSchema: VariantSchema;
  requiresValue: boolean;
  requiresColor: boolean;
  valueOptions: string[];
  colorOptions: string[];
  selectedValue: string;
  selectedColor: string;
  selectedVariant: ProductVariant | null;
  displayVariant: ProductVariant | null;
  availableStock: number;
  canAdd: boolean;
  uiSoldOut: boolean;
  helperSelectionText: string;
  isInvalidCombo: boolean;
  isSizeSoldOut: (value: string) => boolean;
  isColorSoldOut: (color: string) => boolean;
  selectValue: (value: string) => void;
  selectColor: (color: string) => void;
};

const EMPTY_VARIANTS: ProductVariant[] = [];

function normalizeOption(value: unknown): string {
  return String(value || "").trim();
}

function normalizeOptionForCompare(value: unknown): string {
  return normalizeOption(value).toLowerCase();
}

function isSameOption(a: unknown, b: unknown): boolean {
  return normalizeOptionForCompare(a) === normalizeOptionForCompare(b);
}

function getCanonicalOption(options: string[], candidate: unknown): string {
  const normalizedCandidate = normalizeOptionForCompare(candidate);
  if (!normalizedCandidate) return "";

  const exact = options.find((option) => isSameOption(option, normalizedCandidate));
  return exact ?? normalizeOption(candidate);
}

function hasStock(variant: ProductVariant | null | undefined): boolean {
  return (variant?.stock ?? 0) > 0;
}

function buildVariantLabel(v: ProductVariant, variantSchema?: string): string {
  const schema = normalizeOptionForCompare(variantSchema);
  const parts: string[] = [];

  if (v.value) parts.push(v.value);
  if (v.color) parts.push(v.color);

  if (parts.length > 0) return parts.join(" / ");
  if (schema === "no_variant") return "";

  return `Variante #${v.id}`;
}


function getVariantForColorValue(
  product: PDPViewModel,
  color: string,
  value: string
): ProductVariant | null {
  const normalizedColor = normalizeOption(color);
  const normalizedValue = normalizeOption(value);

  if (!normalizedColor || !normalizedValue) return null;
  return product.variantByColorValue?.[`${normalizedColor}__${normalizedValue}`] ?? null;
}

function getVariantsForColor(
  product: PDPViewModel,
  color: string
): ProductVariant[] {
  const normalizedColor = normalizeOption(color);
  if (!normalizedColor) return [];
  return product.variantsByColor?.[normalizedColor] ?? [];
}

function getVariantsForValue(
  product: PDPViewModel,
  value: string
): ProductVariant[] {
  const normalizedValue = normalizeOption(value);
  if (!normalizedValue) return [];
  return product.variantsByValue?.[normalizedValue] ?? [];
}

function pickFirstVariantWithImages(variants: ProductVariant[]): ProductVariant | null {
  return variants.find((variant) => (variant.images?.length ?? 0) > 0) ?? variants[0] ?? null;
}

function resolveDisplayVariant(params: {
  product: PDPViewModel;
  selectedVariant: ProductVariant | null;
  selectedColor: string;
  selectedValue: string;
  firstAvailableVariant: ProductVariant | null;
}): ProductVariant | null {
  const { product, selectedVariant, selectedColor, selectedValue, firstAvailableVariant } = params;
  const variants = product.variants ?? [];
  const variantSchema = (product.variantSchema ?? "size_color") as VariantSchema;

  if (!variants.length) return null;

  if (variantSchema === "size_color") {
    const exact =
      selectedColor && selectedValue
        ? getVariantForColorValue(product, selectedColor, selectedValue)
        : null;

    return (
      exact ??
      selectedVariant ??
      (selectedColor ? pickFirstVariantWithImages(getVariantsForColor(product, selectedColor)) : null) ??
      firstAvailableVariant ??
      variants[0] ??
      null
    );
  }

  return (
    selectedVariant ??
    (selectedColor ? pickFirstVariantWithImages(getVariantsForColor(product, selectedColor)) : null) ??
    (selectedValue ? pickFirstVariantWithImages(getVariantsForValue(product, selectedValue)) : null) ??
    firstAvailableVariant ??
    variants[0] ??
    null
  );
}

function formatPriceCOP(price: string): string {
  return `$${parseFloat(price).toLocaleString("es-CO")}`;
}

function useProductSelection(product: PDPViewModel): SelectionState {
  const variants = product.variants ?? EMPTY_VARIANTS;
  const variantSchema =
    (product.variantSchema ?? product.category?.variant_schema ?? "size_color") as VariantSchema;

  const requiresValue =
    product.requiresValue ??
    (variantSchema === "size_color" ||
      variantSchema === "jean_size" ||
      variantSchema === "shoe_size");
  const requiresColor = product.requiresColor ?? variantSchema === "size_color";

  const valueOptions = product.valueOptions ?? [];
  const colorOptions = product.colorOptions ?? [];

  const firstAvailableVariant = useMemo(() => {
    if (product.firstAvailableVariantId != null) {
      return (
        variants.find((variant) => variant.id === product.firstAvailableVariantId) ??
        null
      );
    }

    return variants.find(hasStock) ?? null;
  }, [product.firstAvailableVariantId, variants]);

  const initialDisplayVariant = useMemo(() => {
    if (product.initialDisplayVariantId != null) {
      return (
        variants.find((variant) => variant.id === product.initialDisplayVariantId) ??
        null
      );
    }

    if (product.firstAvailableVariantId != null) {
      return (
        variants.find((variant) => variant.id === product.firstAvailableVariantId) ??
        null
      );
    }

    if (variants.length === 1) {
      return variants[0] ?? null;
    }

    return firstAvailableVariant ?? variants[0] ?? null;
  }, [
    product.initialDisplayVariantId,
    product.firstAvailableVariantId,
    variants,
    firstAvailableVariant,
  ]);

  const defaultValue = getCanonicalOption(
    valueOptions,
    initialDisplayVariant?.value ?? valueOptions[0] ?? ""
  );
  const defaultColor = getCanonicalOption(
    colorOptions,
    initialDisplayVariant?.color ?? colorOptions[0] ?? ""
  );

  const [selectedValue, setSelectedValue] = useState(defaultValue);
  const [selectedColor, setSelectedColor] = useState(defaultColor);

  useEffect(() => {
    setSelectedValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    setSelectedColor(defaultColor);
  }, [defaultColor]);

  const selectedVariant = useMemo(() => {
    if (!variants.length) return null;

    if (variantSchema === "no_variant") {
      return variants.length === 1
        ? variants[0]
        : initialDisplayVariant ?? firstAvailableVariant ?? variants[0] ?? null;
    }

    if (variantSchema === "size_color") {
      if (!selectedValue || !selectedColor) return null;
      return getVariantForColorValue(product, selectedColor, selectedValue);
    }

    if (variantSchema === "jean_size" || variantSchema === "shoe_size") {
      if (!selectedValue) return null;

      return (
        getVariantsForValue(product, selectedValue).find(hasStock) ??
        getVariantsForValue(product, selectedValue)[0] ??
        null
      );
    }

    return null;
  }, [
    variants,
    variantSchema,
    initialDisplayVariant,
    firstAvailableVariant,
    product,
    selectedColor,
    selectedValue,
  ]);

  const hasValue = requiresValue && valueOptions.length > 0;
  const hasColor = requiresColor && colorOptions.length > 0;

  const isInvalidCombo = useMemo(() => {
    if (!variants.length) return false;
    if (variantSchema === "no_variant") return false;

    if (variantSchema === "size_color") {
      return hasValue && hasColor && !!selectedValue && !!selectedColor && !selectedVariant;
    }

    if (variantSchema === "jean_size" || variantSchema === "shoe_size") {
      if (!selectedValue) return false;
      return getVariantsForValue(product, selectedValue).length === 0;
    }

    return false;
  }, [
    variants,
    variantSchema,
    hasValue,
    hasColor,
    selectedValue,
    selectedColor,
    selectedVariant,
    product,
  ]);

  const displayVariant = useMemo(
    () =>
      resolveDisplayVariant({
        product,
        selectedVariant,
        selectedColor,
        selectedValue,
        firstAvailableVariant: firstAvailableVariant ?? initialDisplayVariant,
      }),
    [
      product,
      selectedVariant,
      selectedColor,
      selectedValue,
      firstAvailableVariant,
      initialDisplayVariant,
    ]
  );

  const helperSelectionText = useMemo(() => {
    if (variantSchema !== "size_color") {
      return requiresColor
        ? "Selecciona una talla y color."
        : "Selecciona una talla.";
    }

    if (!selectedColor) return "Selecciona un color.";
    if (!selectedValue) return "Selecciona una talla.";

    return "Selecciona otra talla o color.";
  }, [variantSchema, requiresColor, selectedColor, selectedValue]);

  const selectedOutOfStock = useMemo(() => {
    if (isInvalidCombo) return true;

    if (variantSchema === "no_variant") {
      return (product.stock_total ?? 0) <= 0;
    }

    return !hasStock(selectedVariant);
  }, [isInvalidCombo, variantSchema, product.stock_total, selectedVariant]);

  const availableStock = useMemo(() => {
    if (variantSchema === "no_variant") return product.stock_total ?? 0;
    return selectedVariant?.stock ?? 0;
  }, [variantSchema, product.stock_total, selectedVariant]);

  const isSizeSoldOut = (value: string) => {
    if (!requiresValue) return (product.stock_total ?? 0) <= 0;

    const normalizedValue = normalizeOption(value);

    if (variantSchema === "size_color") {
      if (!selectedColor) return true;
      const variant = getVariantForColorValue(product, selectedColor, normalizedValue);
      if (!variant) return true;
      return !hasStock(variant);
    }

    return !getVariantsForValue(product, normalizedValue).some(hasStock);
  };

  const isColorSoldOut = (color: string) => {
    if (!requiresColor) return false;
    return !getVariantsForColor(product, color).some(hasStock);
  };

  const selectColor = (color: string) => {
    if (isColorSoldOut(color)) return;
    if (isSameOption(selectedColor, color)) return;
    setSelectedColor(getCanonicalOption(colorOptions, color));
  };

  const selectValue = (value: string) => {
    if (isSizeSoldOut(value)) return;
    if (isSameOption(selectedValue, value)) return;
    setSelectedValue(getCanonicalOption(valueOptions, value));
  };

  return {
    variantSchema,
    requiresValue,
    requiresColor,
    valueOptions,
    colorOptions,
    selectedValue,
    selectedColor,
    selectedVariant,
    displayVariant,
    availableStock,
    canAdd: !selectedOutOfStock,
    uiSoldOut: product.sold_out === true,
    helperSelectionText,
    isInvalidCombo,
    isSizeSoldOut,
    isColorSoldOut,
    selectValue,
    selectColor,
  };
}

function ProductMedia({
  productName,
  galleryImages,
  fallbackImage,
  soldOut,
}: {
  productName: string;
  galleryImages: GalleryImage[];
  fallbackImage: string | null;
  soldOut: boolean;
}) {
  return (
    <div className="pdp-hero relative z-0">
      <div className="pdp-hero-bleed pdp-no-top-wash relative z-0">
        {galleryImages.length > 0 ? (
          <ProductGallery
            images={galleryImages}
            productName={productName}
            soldOut={soldOut}
            variant="pdp"
          />
        ) : fallbackImage ? (
          <div className="aspect-square w-full bg-zinc-100">
            <img
              src={fallbackImage}
              alt={productName || "Producto"}
              className="h-full w-full object-cover"
              loading="eager"
            />
          </div>
        ) : (
          <div className="aspect-square w-full bg-zinc-100">
            <div className="flex h-full w-full items-center justify-center text-neutral-600">
              Sin imagen
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductHeader({ name, price, slug }: { name: string; price: string; slug: string }) {
  const displayName = name.toUpperCase();
  return (
    <div className="relative z-0 flex items-start gap-2.5">
      <div className="max-w-[24rem] pr-10 md:max-w-[25rem] md:pr-11">
        <h1 className="pdp-title max-w-[14ch] text-zinc-900 md:max-w-[15ch]">
          {displayName}
        </h1>
        <p className="pdp-price-refined mt-2.5">{formatPriceCOP(price)}</p>
      </div>

      <div className="absolute right-0 top-0 z-0 opacity-80 transition-opacity duration-200 hover:opacity-100">
        <ShareButton
          title={`${name} | Kame.Col`}
          url={`/producto/${encodeURIComponent(slug)}`}
          ariaLabel="Compartir producto"
        />
      </div>
    </div>
  );
}

function ProductSelectors({
  selection,
  sizeGuideTrigger,
}: {
  selection: SelectionState;
  sizeGuideTrigger: React.ReactNode;
}) {
  const {
    requiresValue,
    requiresColor,
    valueOptions,
    colorOptions,
    selectedValue,
    selectedColor,
    variantSchema,
    selectValue,
    selectColor,
    isSizeSoldOut,
    isColorSoldOut,
  } = selection;

  if (
    !((requiresValue && valueOptions.length > 0) ||
      (requiresColor && colorOptions.length > 0))
  ) {
    return !requiresValue && !requiresColor && sizeGuideTrigger ? (
      <div className="flex items-center">{sizeGuideTrigger}</div>
    ) : null;
  }

  return (
    <div className="mt-6 space-y-5">
      {!requiresValue && !requiresColor && sizeGuideTrigger && (
        <div className="flex items-center">{sizeGuideTrigger}</div>
      )}

      <div className="pdp-controls-grid gap-y-5">
        <div>
          {requiresColor && colorOptions.length > 0 ? (
            <>
              <div className="pdp-label-refined text-zinc-500/90">Color</div>
              <div className="pdp-variant-section mt-2.5">
                <div className="pdp-color-grid">
                  {colorOptions.map((color) => {
                    const selected = isSameOption(selectedColor, color);
                    const soldOut = !selected && isColorSoldOut(color);

                    return (
                      <button
                        key={color}
                        type="button"
                        className={
                          "ui-selectable-control pdp-color-chip pdp-variant-refined " +
                          (selected ? "ui-selectable-control--selected " : "") +
                          (soldOut ? "ui-selectable-control--disabled " : "")
                        }
                        disabled={soldOut}
                        onClick={() => selectColor(color)}
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
            <div />
          )}
        </div>

        <div>
          {requiresValue && valueOptions.length > 0 ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="pdp-label-refined text-zinc-500/90">Talla</div>
                {sizeGuideTrigger}
              </div>

              <div className="pdp-variant-section mt-2.5">
                <div className="pdp-size-grid">
                  {valueOptions.map((value) => {
                    const selected = isSameOption(selectedValue, value);
                    const soldOut = !selected && isSizeSoldOut(value);

                    return (
                      <button
                        key={value}
                        type="button"
                        className={
                          "ui-selectable-control pdp-size-item pdp-variant-refined " +
                          (selected ? "ui-selectable-control--selected " : "") +
                          (soldOut ? "ui-selectable-control--disabled " : "")
                        }
                        disabled={soldOut}
                        onClick={() => selectValue(value)}
                        aria-pressed={selected}
                        aria-disabled={soldOut}
                        title={soldOut ? `${value} (sold out)` : value}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div />
          )}
        </div>
      </div>

      {variantSchema === "no_variant" ? null : null}
    </div>
  );
}

function ProductPurchaseBox({
  availableStock,
  canAdd,
  helperSelectionText,
  isInvalidCombo,
  isSubmittingToCart,
  onAddToCart,
  selectedVariant,
  triggerRef,
}: {
  availableStock: number;
  canAdd: boolean;
  helperSelectionText: string;
  isInvalidCombo: boolean;
  isSubmittingToCart: boolean;
  onAddToCart: () => void;
  selectedVariant: ProductVariant | null;
  triggerRef: React.Ref<HTMLDivElement>;
}) {
  const availabilityMessage = (() => {
    if (isInvalidCombo) {
      return "Esta combinación no está disponible.";
    }

    if (availableStock > 0) {
      return availableStock <= 3 ? "Últimas unidades disponibles." : "Disponible para compra.";
    }

    if (selectedVariant) {
      return "Agotado";
    }

    return helperSelectionText;
  })();

  return (
    <div className="mt-6">
      <div className="pdp-description-refined mb-3.5 flex flex-wrap items-center gap-2 text-zinc-500">
        <span
          className={
            "pdp-description-refined " +
            (availableStock > 0 && !isInvalidCombo ? "text-zinc-600" : "text-zinc-500")
          }
        >
          {availabilityMessage}
        </span>
      </div>

      <div ref={triggerRef}>
        <Button
          type="button"
          onClick={onAddToCart}
          disabled={!canAdd || isSubmittingToCart}
          variant="primary"
          fullWidth
          className="pdp-cta-refined w-full"
        >
          {canAdd ? "Agregar al carrito" : "Sin stock"}
        </Button>
      </div>
    </div>
  );
}

function ProductDescription({
  description,
  expanded,
  onToggle,
}: {
  description?: string | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!description) return null;

  return (
    <section className="mt-8 border-t border-zinc-900/8 pt-5">
      <h2 className="pdp-label-refined text-zinc-500">Descripción</h2>

      <div
        className={
          expanded
            ? "pdp-description-refined mt-2.5 whitespace-pre-wrap text-zinc-700"
            : "pdp-description-refined mt-2.5 whitespace-pre-wrap text-zinc-700 line-clamp-4"
        }
      >
        {description}
      </div>

      <div className="mt-2.5">
        <button
          type="button"
          onClick={onToggle}
          className="pdp-label-refined text-zinc-600 transition-colors duration-200 hover:text-zinc-900"
        >
          {expanded ? "Ver menos" : "Ver más"}
        </button>
      </div>
    </section>
  );
}

export function ProductDetailClient({
  product,
  moreFromKame,
}: ProductDetailClientProps) {
  const addItem = useCartStore((state) => state.addItem);
  const trackAddToCartFn = useTrackAddToCart();

  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [isSubmittingToCart, setIsSubmittingToCart] = useState(false);
  const addToCartButtonRef = useRef<HTMLDivElement>(null);

  const selection = useProductSelection(product);
  const sizeGuide = product.category?.size_guide ?? null;

  // Tracking
  useTrackProductView({ id: product.id, name: product.name, slug: product.slug });

  const resolvedGalleryImages = useMemo(() => {
    const variantId = selection.displayVariant?.id;
    if (variantId == null) return product.galleryImages ?? [];
    return product.variantGalleryImagesById?.[String(variantId)] ?? product.galleryImages ?? [];
  }, [product, selection.displayVariant]);

  const resolvedPrimaryImage = useMemo(() => {
    const variantId = selection.displayVariant?.id;
    if (variantId == null) {
      return product.primaryImage ?? product.canonicalProductImage ?? null;
    }

    return (
      product.variantPrimaryImageById?.[String(variantId)] ??
      product.primaryImage ??
      product.canonicalProductImage ??
      null
    );
  }, [product, selection.displayVariant]);

  const sizeGuideTrigger = sizeGuide ? (
    <button
      type="button"
      onClick={() => setSizeGuideOpen(true)}
      aria-label="Abrir guía de medidas"
      className="pdp-guide-link-inline pdp-label-refined text-zinc-500"
    >
      Guía de medidas
    </button>
  ) : null;

  function getCartImageUrlForVariant(variantId: number | null | undefined): string | null {
    if (variantId != null) {
      const variantGallery = product.variantGalleryImagesById?.[String(variantId)] ?? [];
      const variantGalleryUrl = variantGallery[0]?.url ?? null;
      const variantPrimary = product.variantPrimaryImageById?.[String(variantId)] ?? null;

      return variantPrimary ?? variantGalleryUrl ?? product.primaryImage ?? resolvedPrimaryImage;
    }

    return product.primaryImage ?? resolvedPrimaryImage;
  }

  const triggerCartFlyAnimation = (imageUrl: string | null) => {
    if (typeof window === "undefined") return;

    const sourceRect = addToCartButtonRef.current?.getBoundingClientRect();
    if (!sourceRect) return;

    window.dispatchEvent(
      new CustomEvent("cart:fly-to-cart", {
        detail: {
          imageUrl,
          productId: product.id,
          variantId: selection.selectedVariant?.id ?? null,
          sourceRect: {
            top: sourceRect.top,
            left: sourceRect.left,
            width: sourceRect.width,
            height: sourceRect.height,
          },
        },
      })
    );
  };

  const handleAddToCart = () => {
    if (selection.isInvalidCombo || isSubmittingToCart) return;

    const variants = product.variants ?? EMPTY_VARIANTS;

    if (selection.variantSchema === "no_variant") {
      const variant = variants.length === 1 ? variants[0] : null;
      if (!variant) return;
      if ((product.stock_total ?? 0) <= 0) return;
      const cartImageUrl = getCartImageUrlForVariant(variant.id);

      setIsSubmittingToCart(true);
      trackAddToCartFn({ id: product.id, name: product.name, slug: product.slug, price: product.price }, { value: variant.value ?? undefined, color: variant.color ?? undefined });

      addItem(
        {
          variantId: variant.id,
          productId: product.id,
          productName: product.name,
          productSlug: product.slug,
          variantLabel: buildVariantLabel(variant, selection.variantSchema),
          price: product.price,
          imageUrl: cartImageUrl,
        },
        1
      );

      triggerCartFlyAnimation(cartImageUrl);
      window.setTimeout(() => setIsSubmittingToCart(false), 320);
      return;
    }

    const variantToAdd =
      selection.selectedVariant ?? (variants.length === 1 ? variants[0] : null);
    if (!variantToAdd) return;

    const cartImageUrl = getCartImageUrlForVariant(variantToAdd.id);

    setIsSubmittingToCart(true);
    trackAddToCartFn({ id: product.id, name: product.name, slug: product.slug, price: product.price }, { value: variantToAdd.value ?? undefined, color: variantToAdd.color ?? undefined });

    addItem(
      {
        variantId: variantToAdd.id,
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        variantLabel: buildVariantLabel(variantToAdd, selection.variantSchema),
        price: product.price,
        imageUrl: cartImageUrl,
      },
      1
    );

    triggerCartFlyAnimation(cartImageUrl);
    window.setTimeout(() => setIsSubmittingToCart(false), 320);
  };

  return (
    <section
      className="page-shell--pdp pdp-shell pdp-shell--hero relative z-0 mx-auto max-w-6xl pb-6 md:pb-10"
      data-pdp-layout="hero-media"
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-8">
        <ProductMedia
          productName={product.name}
          galleryImages={resolvedGalleryImages}
          fallbackImage={resolvedPrimaryImage}
          soldOut={selection.uiSoldOut}
        />

        <div className="pdp-content-start relative z-0 px-4 md:px-6 lg:pt-3">
          <ProductHeader
            name={product.name}
            price={product.price}
            slug={product.slug}
          />

          <ProductSelectors
            selection={selection}
            sizeGuideTrigger={sizeGuideTrigger}
          />

          <ProductPurchaseBox
            availableStock={selection.availableStock}
            canAdd={selection.canAdd}
            helperSelectionText={selection.helperSelectionText}
            isInvalidCombo={selection.isInvalidCombo}
            isSubmittingToCart={isSubmittingToCart}
            onAddToCart={handleAddToCart}
            selectedVariant={selection.selectedVariant}
            triggerRef={addToCartButtonRef}
          />

          <ProductDescription
            description={product.description}
            expanded={detailsExpanded}
            onToggle={() => setDetailsExpanded((value) => !value)}
          />
        </div>
      </div>

      {/* Keep discovery rail mounted directly in PDP flow without extra wrappers,
          so marquee drag, inertia, click capture, and effective width remain intact. */}
      {Array.isArray(moreFromKame) && moreFromKame.length > 0 ? (
        <ProductDiscoveryRail products={moreFromKame} />
      ) : null}

      {sizeGuide && (
        <SizeGuideDrawer
          open={sizeGuideOpen}
          onClose={() => setSizeGuideOpen(false)}
          guide={sizeGuide}
        />
      )}
    </section>
  );
}