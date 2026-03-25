

import {
  getProductGalleryImages,
  getProductPrimaryImage,
  normalizeProductMediaUrl,
} from "@/lib/product-media";
import type {
  NormalizedProductGalleryImage,
  ProductDetail,
  ProductDetailViewModel,
  ProductVariant,
  ProductVariantMatrix,
} from "@/types/catalog";

export type VariantSchema =
  | "size_color"
  | "jean_size"
  | "shoe_size"
  | "no_variant"
  | string;

export type PDPVariantOptions = {
  valueOptions: string[];
  colorOptions: string[];
  firstAvailableVariant: ProductVariant | null;
  initialDisplayVariant: ProductVariant | null;
  requiresValue: boolean;
  requiresColor: boolean;
};

export type PDPSelectionFlags = {
  hasVariants: boolean;
  hasValueOptions: boolean;
  hasColorOptions: boolean;
  hasAnyStock: boolean;
  isSingleVariantOnly: boolean;
};


export type ImageSourceLike = {
  image?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  image_large_url?: string | null;
  imageLargeUrl?: string | null;
  image_medium_url?: string | null;
  imageMediumUrl?: string | null;
  image_thumb_url?: string | null;
  imageThumbUrl?: string | null;
  primary_image?: string | null;
  primary_thumb_url?: string | null;
  primary_medium_url?: string | null;
  src?: string | null;
  url?: string | null;
  images?: unknown;
  galleryImages?: unknown;
  normalizedGallery?: unknown;
};

function getExplicitPrimaryImage(source: ImageSourceLike | null | undefined): string | null {
  if (!source) return null;

  return (
    normalizeProductMediaUrl(source.image_large_url ?? "") ||
    normalizeProductMediaUrl(source.imageLargeUrl ?? "") ||
    normalizeProductMediaUrl(source.image_medium_url ?? "") ||
    normalizeProductMediaUrl(source.imageMediumUrl ?? "") ||
    normalizeProductMediaUrl(source.primary_image ?? "") ||
    normalizeProductMediaUrl(source.image ?? "") ||
    normalizeProductMediaUrl(source.image_url ?? "") ||
    normalizeProductMediaUrl(source.imageUrl ?? "") ||
    normalizeProductMediaUrl(source.url ?? "") ||
    normalizeProductMediaUrl(source.src ?? "") ||
    null
  );
}

function getExplicitPrimaryThumb(source: ImageSourceLike | null | undefined): string | null {
  if (!source) return null;

  return (
    normalizeProductMediaUrl(source.primary_thumb_url ?? "") ||
    normalizeProductMediaUrl(source.image_thumb_url ?? "") ||
    normalizeProductMediaUrl(source.imageThumbUrl ?? "") ||
    normalizeProductMediaUrl(source.primary_medium_url ?? "") ||
    normalizeProductMediaUrl(source.image_medium_url ?? "") ||
    normalizeProductMediaUrl(source.imageMediumUrl ?? "") ||
    null
  );
}

function getExplicitPrimaryMedium(source: ImageSourceLike | null | undefined): string | null {
  if (!source) return null;

  return (
    normalizeProductMediaUrl(source.primary_medium_url ?? "") ||
    getExplicitPrimaryImage(source)
  );
}

export type PDPVariantLookupRecord = Record<string, ProductVariant[]>;
export type PDPVariantValueRecord = Record<string, ProductVariant>;
export type PDPVariantImageRecord = Record<string, NormalizedProductGalleryImage[]>;
export type PDPVariantPrimaryImageRecord = Record<string, string | null>;

export type PDPViewModel = ProductDetailViewModel &
  ProductDetail & {
    variantSchema: VariantSchema;
    valueOptions: string[];
    colorOptions: string[];
    firstAvailableVariant: ProductVariant | null;
    initialDisplayVariant: ProductVariant | null;
    firstAvailableVariantId: number | null;
    variantMatrix: ProductVariantMatrix;
    variantsByColor: PDPVariantLookupRecord;
    variantsByValue: PDPVariantLookupRecord;
    variantByColorValue: PDPVariantValueRecord;
    variantGalleryImagesById: PDPVariantImageRecord;
    variantPrimaryImageById: PDPVariantPrimaryImageRecord;
    requiresValue: boolean;
    requiresColor: boolean;
    flags: PDPSelectionFlags;
  };

const APPAREL_ORDER = ["S", "M", "L", "XL", "2XL"];
const SHOE_ORDER = ["36", "37", "38", "39", "40", "41", "42"];

export function normalizeOption(value: unknown): string {
  return String(value || "").trim();
}

export function hasStock(variant: Pick<ProductVariant, "stock"> | null | undefined): boolean {
  return (variant?.stock ?? 0) > 0;
}

export function getProductVariantSchema(product: ProductDetail): VariantSchema {
  return (product.category?.variant_schema || "size_color") as VariantSchema;
}

export function sortVariantValuesForSchema(
  values: string[],
  variantSchema: VariantSchema
): string[] {
  const cleaned = Array.from(
    new Set(values.map((value) => normalizeOption(value)).filter(Boolean))
  );

  if (variantSchema === "jean_size") {
    return cleaned.sort((a, b) => Number(a) - Number(b));
  }

  const canonical =
    variantSchema === "size_color"
      ? APPAREL_ORDER
      : variantSchema === "shoe_size"
        ? SHOE_ORDER
        : null;

  if (!canonical) return cleaned.sort();

  const orderMap = new Map(canonical.map((value, index) => [value, index]));
  const known = cleaned.filter((value) => orderMap.has(value));
  const unknown = cleaned.filter((value) => !orderMap.has(value));

  known.sort((a, b) => orderMap.get(a)! - orderMap.get(b)!);
  unknown.sort();

  return [...known, ...unknown];
}

export function normalizeGalleryImages(input: unknown): NormalizedProductGalleryImage[] {
  const items = Array.isArray(input) ? input : input ? [input] : [];

  return items
    .map((image) => {
      if (typeof image === "string") {
        const raw = image.trim();
        if (!raw) return null;

        const url = normalizeProductMediaUrl(raw);
        if (!url) return null;

        return {
          url,
          thumb_url: null,
          alt_text: null,
        } satisfies NormalizedProductGalleryImage;
      }

      if (!image || typeof image !== "object") return null;

      const record = image as Record<string, unknown>;
      const rawUrl = normalizeOption(
        record.url ??
          record.image_large_url ??
          record.imageLargeUrl ??
          record.image_medium_url ??
          record.imageMediumUrl ??
          record.image ??
          record.src ??
          record.image_url ??
          ""
      );

      if (!rawUrl) return null;

      const url = normalizeProductMediaUrl(rawUrl);
      if (!url) return null;

      const rawThumb = normalizeOption(
        record.thumb_url ??
          record.image_thumb_url ??
          record.imageThumbUrl ??
          record.thumbnail_url ??
          record.thumbnailUrl ??
          record.thumbnail ??
          record.thumb ??
          record.thumbUrl ??
          record.small ??
          ""
      );

      const thumb_url = rawThumb ? normalizeProductMediaUrl(rawThumb) : null;
      const alt_text =
        normalizeOption(record.alt_text ?? record.altText ?? record.alt ?? "") ||
        null;

      return {
        url,
        thumb_url,
        alt_text,
      } satisfies NormalizedProductGalleryImage;
    })
    .filter(Boolean) as NormalizedProductGalleryImage[];
}

export function dedupeGalleryImages(
  images: NormalizedProductGalleryImage[]
): NormalizedProductGalleryImage[] {
  const seen = new Set<string>();
  const result: NormalizedProductGalleryImage[] = [];

  for (const image of images) {
    const url = normalizeOption(image.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push(image);
  }

  return result;
}


export function getPrimaryImageUrlFromSource(source: ImageSourceLike | null | undefined): string | null {
  if (!source) return null;
  return getExplicitPrimaryImage(source) || getProductPrimaryImage(source) || null;
}

export function getSourceImages(source: ImageSourceLike | null | undefined): unknown {
  if (!source) return [];
  return source.images ?? [];
}

export function resolveCanonicalProductImage(product: ProductDetail): string | null {
  return getExplicitPrimaryImage(product) || getProductPrimaryImage(product) || null;
}

export function resolveVariantPrimaryImage(variant: ProductVariant | null): string | null {
  if (!variant) return null;
  return getPrimaryImageUrlFromSource(variant);
}

export function resolveVariantGalleryImages(
  variant: ProductVariant | null
): NormalizedProductGalleryImage[] {
  if (!variant) return [];
  return dedupeGalleryImages(getProductGalleryImages(variant));
}

export function resolveProductGalleryImages(
  product: ProductDetail
): NormalizedProductGalleryImage[] {
  const explicitGallery = normalizeGalleryImages(
    (product as ProductDetail & {
      normalizedGallery?: unknown;
      galleryImages?: unknown;
    }).normalizedGallery ??
      (product as ProductDetail & {
        normalizedGallery?: unknown;
        galleryImages?: unknown;
      }).galleryImages ??
      []
  );

  if (explicitGallery.length > 0) {
    return dedupeGalleryImages(explicitGallery);
  }

  return dedupeGalleryImages(getProductGalleryImages(product));
}

export function buildVariantMatrix(variants: ProductVariant[]): ProductVariantMatrix {
  const byColor = new Map<string, ProductVariant[]>();
  const byValue = new Map<string, ProductVariant[]>();
  const byColorValue = new Map<string, ProductVariant>();

  for (const variant of variants) {
    const color = normalizeOption(variant.color);
    const value = normalizeOption(variant.value);

    if (color) {
      const colorList = byColor.get(color) ?? [];
      colorList.push(variant);
      byColor.set(color, colorList);
    }

    if (value) {
      const valueList = byValue.get(value) ?? [];
      valueList.push(variant);
      byValue.set(value, valueList);
    }

    if (color && value) {
      byColorValue.set(`${color}__${value}`, variant);
    }
  }

  return { byColor, byValue, byColorValue };
}

export function serializeVariantLookupMap(
  lookup: Map<string, ProductVariant[]>
): PDPVariantLookupRecord {
  const result: PDPVariantLookupRecord = {};

  lookup.forEach((value, key) => {
    result[key] = value;
  });

  return result;
}

export function serializeVariantValueMap(
  lookup: Map<string, ProductVariant>
): PDPVariantValueRecord {
  const result: PDPVariantValueRecord = {};

  lookup.forEach((value, key) => {
    result[key] = value;
  });

  return result;
}

export function buildVariantGalleryImagesById(
  variants: ProductVariant[]
): PDPVariantImageRecord {
  const result: PDPVariantImageRecord = {};

  for (const variant of variants) {
    result[String(variant.id)] = resolveVariantGalleryImages(variant);
  }

  return result;
}

export function buildVariantPrimaryImageById(
  variants: ProductVariant[]
): PDPVariantPrimaryImageRecord {
  const result: PDPVariantPrimaryImageRecord = {};

  for (const variant of variants) {
    result[String(variant.id)] = resolveVariantPrimaryImage(variant);
  }

  return result;
}

export function getVariantsForColor(
  matrix: ProductVariantMatrix,
  color: string
): ProductVariant[] {
  const normalizedColor = normalizeOption(color);
  if (!normalizedColor) return [];
  return matrix.byColor.get(normalizedColor) ?? [];
}

export function getVariantsForValue(
  matrix: ProductVariantMatrix,
  value: string
): ProductVariant[] {
  const normalizedValue = normalizeOption(value);
  if (!normalizedValue) return [];
  return matrix.byValue.get(normalizedValue) ?? [];
}

export function getVariantForColorValue(
  matrix: ProductVariantMatrix,
  color: string,
  value: string
): ProductVariant | null {
  const normalizedColor = normalizeOption(color);
  const normalizedValue = normalizeOption(value);

  if (!normalizedColor || !normalizedValue) return null;
  return matrix.byColorValue.get(`${normalizedColor}__${normalizedValue}`) ?? null;
}

export function colorHasAnyUsableVariant(
  matrix: ProductVariantMatrix,
  color: string
): boolean {
  return getVariantsForColor(matrix, color).some(hasStock);
}

export function getAvailableSizesForColor(
  matrix: ProductVariantMatrix,
  valueOptions: string[],
  color: string
): string[] {
  const normalizedColor = normalizeOption(color);
  if (!normalizedColor) return [];

  const colorVariants = getVariantsForColor(matrix, normalizedColor);

  return valueOptions.filter((value) =>
    colorVariants.some(
      (variant) => normalizeOption(variant.value) === value && hasStock(variant)
    )
  );
}

export function getExistingSizesForColor(
  matrix: ProductVariantMatrix,
  valueOptions: string[],
  color: string
): string[] {
  const normalizedColor = normalizeOption(color);
  if (!normalizedColor) return [];

  const colorVariants = getVariantsForColor(matrix, normalizedColor);

  return valueOptions.filter((value) =>
    colorVariants.some((variant) => normalizeOption(variant.value) === value)
  );
}

export function sizeExistsForSelectedColor(
  matrix: ProductVariantMatrix,
  value: string,
  color: string
): boolean {
  return !!getVariantForColorValue(matrix, color, value);
}

export function sizeInSelectedColorHasStock(
  matrix: ProductVariantMatrix,
  value: string,
  color: string
): boolean {
  return hasStock(getVariantForColorValue(matrix, color, value));
}

export function pickNextValueForColor(params: {
  matrix: ProductVariantMatrix;
  valueOptions: string[];
  color: string;
  selectedValue: string;
}): string {
  const { matrix, valueOptions, color, selectedValue } = params;
  const normalizedColor = normalizeOption(color);
  if (!normalizedColor) return "";

  const normalizedSelectedValue = normalizeOption(selectedValue);
  const availableSizes = getAvailableSizesForColor(
    matrix,
    valueOptions,
    normalizedColor
  );

  if (normalizedSelectedValue && availableSizes.includes(normalizedSelectedValue)) {
    return normalizedSelectedValue;
  }

  if (availableSizes.length > 0) return availableSizes[0];

  const existingSizes = getExistingSizesForColor(
    matrix,
    valueOptions,
    normalizedColor
  );

  if (normalizedSelectedValue && existingSizes.includes(normalizedSelectedValue)) {
    return normalizedSelectedValue;
  }

  return existingSizes[0] ?? "";
}

export function pickNextColorForValue(params: {
  matrix: ProductVariantMatrix;
  colorOptions: string[];
  value: string;
  selectedColor: string;
}): string {
  const { matrix, colorOptions, value, selectedColor } = params;
  const normalizedValue = normalizeOption(value);
  if (!normalizedValue) return "";

  if (selectedColor) {
    const exactMatch = getVariantForColorValue(matrix, selectedColor, normalizedValue);
    if (hasStock(exactMatch)) return selectedColor;
    if (exactMatch) return selectedColor;
  }

  const colorsWithStock = colorOptions.filter((color) =>
    hasStock(getVariantForColorValue(matrix, color, normalizedValue))
  );

  if (colorsWithStock.length > 0) return colorsWithStock[0];

  const existingColors = colorOptions.filter((color) =>
    Boolean(getVariantForColorValue(matrix, color, normalizedValue))
  );

  return existingColors[0] ?? "";
}

export function findVariantByColorPreferImages(
  variants: ProductVariant[],
  color: string
): ProductVariant | null {
  const normalizedColor = normalizeOption(color);
  if (!normalizedColor) return null;

  return (
    variants.find(
      (variant) =>
        normalizeOption(variant.color) === normalizedColor &&
        resolveVariantGalleryImages(variant).length > 0
    ) ??
    variants.find((variant) => normalizeOption(variant.color) === normalizedColor) ??
    null
  );
}

export function findVariantByValuePreferImages(
  variants: ProductVariant[],
  value: string
): ProductVariant | null {
  const normalizedValue = normalizeOption(value);
  if (!normalizedValue) return null;

  return (
    variants.find(
      (variant) =>
        normalizeOption(variant.value) === normalizedValue &&
        resolveVariantGalleryImages(variant).length > 0
    ) ??
    variants.find((variant) => normalizeOption(variant.value) === normalizedValue) ??
    null
  );
}

export function resolveInitialDisplayVariant(params: {
  variants: ProductVariant[];
  variantSchema: VariantSchema;
  firstAvailableVariant: ProductVariant | null;
}): ProductVariant | null {
  const { variants, variantSchema, firstAvailableVariant } = params;

  if (firstAvailableVariant) return firstAvailableVariant;
  if (!variants.length) return null;
  if (variants.length === 1) return variants[0] ?? null;

  if (variantSchema === "size_color") {
    return (
      variants.find(
        (variant) => resolveVariantGalleryImages(variant).length > 0
      ) ??
      variants[0] ??
      null
    );
  }

  return variants[0] ?? null;
}

export function resolveDisplayVariant(params: {
  variants: ProductVariant[];
  variantSchema: VariantSchema;
  selectedVariant: ProductVariant | null;
  selectedColor: string;
  selectedValue: string;
  firstAvailableVariant: ProductVariant | null;
  matrix: ProductVariantMatrix;
}): ProductVariant | null {
  const {
    variants,
    variantSchema,
    selectedVariant,
    selectedColor,
    selectedValue,
    firstAvailableVariant,
    matrix,
  } = params;

  if (!variants.length) return null;

  if (variantSchema === "size_color") {
    const exact =
      selectedColor && selectedValue
        ? getVariantForColorValue(matrix, selectedColor, selectedValue)
        : null;

    return (
      exact ??
      selectedVariant ??
      (selectedColor
        ? findVariantByColorPreferImages(variants, selectedColor)
        : null) ??
      firstAvailableVariant ??
      variants[0] ??
      null
    );
  }

  return (
    selectedVariant ??
    (selectedColor ? findVariantByColorPreferImages(variants, selectedColor) : null) ??
    (selectedValue ? findVariantByValuePreferImages(variants, selectedValue) : null) ??
    firstAvailableVariant ??
    variants[0] ??
    null
  );
}

export function resolveVariantOptions(product: ProductDetail): PDPVariantOptions {
  const variants = product.variants ?? [];
  const variantSchema = getProductVariantSchema(product);
  const requiresValue =
    variantSchema === "size_color" ||
    variantSchema === "jean_size" ||
    variantSchema === "shoe_size";
  const requiresColor = variantSchema === "size_color";

  const rawValues = variants
    .map((variant) => variant.value)
    .filter((value): value is string => Boolean(normalizeOption(value)));

  const valueOptions = sortVariantValuesForSchema(rawValues, variantSchema);
  const colorOptions = Array.from(
    new Set(
      variants
        .map((variant) => normalizeOption(variant.color))
        .filter(Boolean)
    )
  );

  const firstAvailableVariant = variants.find(hasStock) ?? null;
  const initialDisplayVariant = resolveInitialDisplayVariant({
    variants,
    variantSchema,
    firstAvailableVariant,
  });

  return {
    valueOptions,
    colorOptions,
    firstAvailableVariant,
    initialDisplayVariant,
    requiresValue,
    requiresColor,
  };
}

export function buildPDPFlags(params: {
  variants: ProductVariant[];
  valueOptions: string[];
  colorOptions: string[];
  firstAvailableVariant: ProductVariant | null;
}): PDPSelectionFlags {
  const { variants, valueOptions, colorOptions, firstAvailableVariant } = params;

  return {
    hasVariants: variants.length > 0,
    hasValueOptions: valueOptions.length > 0,
    hasColorOptions: colorOptions.length > 0,
    hasAnyStock: !!firstAvailableVariant,
    isSingleVariantOnly: variants.length === 1,
  };
}

export function buildProductDetailViewModel(
  product: ProductDetail,
  displayVariant?: ProductVariant | null
): ProductDetailViewModel & {
  primaryThumb: string | null;
  primaryMedium: string | null;
} {
  const canonicalProductImage = resolveCanonicalProductImage(product);
  const variantPrimaryImage = resolveVariantPrimaryImage(displayVariant ?? null);
  const variantGallery = resolveVariantGalleryImages(displayVariant ?? null);
  const productGallery = resolveProductGalleryImages(product);
  const galleryImages = variantGallery.length > 0 ? variantGallery : productGallery;
  const galleryPrimaryImage = galleryImages[0]?.url ?? null;
  const galleryPrimaryThumb = galleryImages[0]?.thumb_url ?? null;

  const explicitPrimaryThumb = getExplicitPrimaryThumb(product);
  const explicitPrimaryMedium = getExplicitPrimaryMedium(product);

  return {
    product,
    primaryImage: variantPrimaryImage || galleryPrimaryImage || canonicalProductImage,
    primaryThumb: explicitPrimaryThumb || galleryPrimaryThumb || null,
    primaryMedium:
      explicitPrimaryMedium ||
      galleryPrimaryImage ||
      variantPrimaryImage ||
      canonicalProductImage,
    canonicalProductImage,
    galleryImages,
  };
}

export function buildProductDetailPDPViewModel(
  product: ProductDetail
): PDPViewModel {
  const variants = product.variants ?? [];
  const variantSchema = getProductVariantSchema(product);
  const variantMatrix = buildVariantMatrix(variants);
  const {
    valueOptions,
    colorOptions,
    firstAvailableVariant,
    initialDisplayVariant,
    requiresValue,
    requiresColor,
  } = resolveVariantOptions(product);
  const baseViewModel = buildProductDetailViewModel(product, initialDisplayVariant);
  const variantsByColor = serializeVariantLookupMap(variantMatrix.byColor);
  const variantsByValue = serializeVariantLookupMap(variantMatrix.byValue);
  const variantByColorValue = serializeVariantValueMap(variantMatrix.byColorValue);
  const variantGalleryImagesById = buildVariantGalleryImagesById(variants);
  const variantPrimaryImageById = buildVariantPrimaryImageById(variants);

  return {
    ...product,
    ...baseViewModel,
    variantSchema,
    valueOptions,
    colorOptions,
    firstAvailableVariant,
    initialDisplayVariant,
    firstAvailableVariantId: firstAvailableVariant?.id ?? null,
    variantMatrix,
    variantsByColor,
    variantsByValue,
    variantByColorValue,
    variantGalleryImagesById,
    variantPrimaryImageById,
    requiresValue,
    requiresColor,
    flags: buildPDPFlags({
      variants,
      valueOptions,
      colorOptions,
      firstAvailableVariant,
    }),
  };
}