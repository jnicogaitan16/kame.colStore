import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCatalogo,
  getProductBySlug,
} from "@/lib/api";
import type { HomepageMarqueeProduct } from "@/lib/api";
import {
  getProductGalleryImages,
  getProductPrimaryImage,
  toAbsoluteProductMediaUrl,
} from "@/lib/product-media";
import { buildProductDetailPDPViewModel } from "@/lib/product-detail-normalize";
import { ProductDetailClient } from "./ProductDetailClient";

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

type DiscoveryProduct = HomepageMarqueeProduct & {
  categorySlug?: string | null;
  departmentSlug?: string | null;
  compareAtPrice?: number | string | null;
  imageUrl?: string | null;
};

const OG_DEFAULT_PATH = "/og/default.jpg";
const MIN_DISCOVERY_PRODUCTS_FOR_MARQUEE = 4;

const getCachedProductBySlug = cache(
  async (slug: string, options?: { next?: { revalidate?: number } }) => {
    return getProductBySlug(slug, options);
  }
);

const getCachedCatalogo = cache(async () => {
  return getCatalogo(
    { page: 1, page_size: 40 },
    { next: { revalidate: 300 } }
  );
});

function truncate(text: string, max = 180): string {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

function isNotFoundProduct(product: any): boolean {
  return !product || product?.detail === "Not found" || product?.detail === "Not found.";
}

function getCategorySlug(product: any): string | null {
  const candidate =
    product?.category?.slug ||
    product?.category_slug ||
    product?.categorySlug ||
    null;

  const value = String(candidate || "").trim();
  return value || null;
}

function getDepartmentSlug(product: any): string | null {
  const candidate =
    product?.category?.department?.slug ||
    product?.department?.slug ||
    product?.department_slug ||
    product?.departmentSlug ||
    null;

  const value = String(candidate || "").trim();
  return value || null;
}

function getCatalogItems(payload: any): any[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  return [];
}

function normalizeDiscoveryProduct(product: any): DiscoveryProduct | null {
  const id = product?.id;
  const slug = String(product?.slug || "").trim();
  const name = String(product?.name || product?.title || "").trim();
  const isActive = product?.is_active === true;

  if (id === null || id === undefined) return null;
  if (!slug) return null;
  if (!name) return null;
  if (!isActive) return null;

  const primaryImage = getProductPrimaryImage(product);

  return {
    id,
    slug,
    name,
    price: product?.price ?? null,
    compareAtPrice:
      product?.compare_at_price ??
      product?.compareAtPrice ??
      product?.original_price ??
      null,
    imageUrl: primaryImage || null,
    categorySlug: getCategorySlug(product),
    departmentSlug: getDepartmentSlug(product),
  };
}

function interleaveDiscoveryBuckets(
  sameCategory: DiscoveryProduct[],
  sameDepartment: DiscoveryProduct[],
  others: DiscoveryProduct[],
  maxItems = 8
): DiscoveryProduct[] {
  const result: DiscoveryProduct[] = [];
  const buckets = {
    sameCategory: [...sameCategory],
    sameDepartment: [...sameDepartment],
    others: [...others],
  };

  while (result.length < maxItems) {
    let appendedInRound = false;

    for (const key of ["sameCategory", "sameDepartment", "others"] as const) {
      const bucket = buckets[key];
      if (!bucket.length || result.length >= maxItems) continue;

      const lastCategory = result[result.length - 1]?.categorySlug || null;
      let nextIndex = bucket.findIndex((item) => item.categorySlug !== lastCategory);

      if (nextIndex < 0) {
        nextIndex = 0;
      }

      const [nextItem] = bucket.splice(nextIndex, 1);
      if (!nextItem) continue;

      result.push(nextItem);
      appendedInRound = true;
    }

    if (!appendedInRound) {
      break;
    }
  }

  return result.slice(0, maxItems);
}

function buildMoreFromKameProducts(
  currentProduct: any,
  catalogPayload: any
): DiscoveryProduct[] {
  const currentId = currentProduct?.id;
  const currentCategorySlug = getCategorySlug(currentProduct);
  const currentDepartmentSlug = getDepartmentSlug(currentProduct);
  const catalogItems = getCatalogItems(catalogPayload);
  const dedupe = new Set<string>();

  const sameCategory: DiscoveryProduct[] = [];
  const sameDepartment: DiscoveryProduct[] = [];
  const others: DiscoveryProduct[] = [];

  for (const rawProduct of catalogItems) {
    const normalized = normalizeDiscoveryProduct(rawProduct);
    if (!normalized) continue;
    if (normalized.id === currentId) continue;

    const dedupeKey = String(normalized.id);
    if (dedupe.has(dedupeKey)) continue;
    dedupe.add(dedupeKey);

    if (
      currentCategorySlug &&
      normalized.categorySlug &&
      normalized.categorySlug === currentCategorySlug
    ) {
      sameCategory.push(normalized);
      continue;
    }

    if (
      currentDepartmentSlug &&
      normalized.departmentSlug &&
      normalized.departmentSlug === currentDepartmentSlug
    ) {
      sameDepartment.push(normalized);
      continue;
    }

    others.push(normalized);
  }

  const curatedProducts = interleaveDiscoveryBuckets(
    sameCategory,
    sameDepartment,
    others,
    8
  );

  return curatedProducts.length >= MIN_DISCOVERY_PRODUCTS_FOR_MARQUEE
    ? curatedProducts
    : [];
}

function normalizeProductForClient(product: any) {
  const fallbackPrimaryImage = getProductPrimaryImage(product) || OG_DEFAULT_PATH;
  const fallbackGallery = getProductGalleryImages(product);

  const primaryImage =
    product?.primary_image ||
    product?.primaryImage ||
    fallbackPrimaryImage;

  const primaryThumb =
    product?.primary_thumb_url ||
    product?.primaryThumb ||
    product?.primary_medium_url ||
    product?.primaryMedium ||
    product?.primary_image ||
    product?.primaryImage ||
    fallbackGallery?.[0]?.thumb_url ||
    fallbackGallery?.[0]?.url ||
    primaryImage;

  const primaryMedium =
    product?.primary_medium_url ||
    product?.primaryMedium ||
    product?.primary_image ||
    product?.primaryImage ||
    fallbackGallery?.[0]?.url ||
    primaryImage;

  const normalizedGallery =
    Array.isArray(product?.galleryImages) && product.galleryImages.length > 0
      ? product.galleryImages
      : fallbackGallery;

  return {
    ...product,
    primaryImage,
    primaryThumb,
    primaryMedium,
    normalizedGallery,
  };
}

function buildProductMetadata(product: any, slug: string): Metadata {
  const name = String(product?.name || product?.title || "Producto").trim();
  const descSource = product?.short_description || product?.shortDescription || product?.description || "";
  const description = truncate(descSource, 180) || "Producto en Kame.Col.";
  const primaryImage = getProductPrimaryImage(product) || OG_DEFAULT_PATH;
  const ogImage = toAbsoluteProductMediaUrl(primaryImage, OG_DEFAULT_PATH);

  return {
    title: `${name} | Kame.Col`,
    description,
    openGraph: {
      type: "website",
      title: `${name} | Kame.Col`,
      description,
      url: `/producto/${encodeURIComponent(slug)}`,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${name} | Kame.Col`,
        },
      ],
    },
    other: {
      "og:type": "product",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} | Kame.Col`,
      description,
      images: [ogImage],
    },
  };
}

function buildEmptyMetadata(): Metadata {
  return {
    title: "Producto | Kame.Col",
    description: "Producto en Kame.Col.",
    robots: { index: false, follow: false },
  };
}

function buildNotFoundMetadata(): Metadata {
  return {
    title: "Producto no encontrado | Kame.Col",
    description: "El producto no existe o no está disponible en Kame.Col.",
    robots: { index: false, follow: false },
  };
}

function buildFallbackMetadata(slug: string): Metadata {
  return {
    title: "Producto | Kame.Col",
    description: "Producto en Kame.Col.",
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      title: "Producto | Kame.Col",
      description: "Producto en Kame.Col.",
      url: `/producto/${encodeURIComponent(slug)}`,
      images: [
        {
          url: toAbsoluteProductMediaUrl(OG_DEFAULT_PATH, OG_DEFAULT_PATH),
          width: 1200,
          height: 630,
          alt: "Kame.Col",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Producto | Kame.Col",
      description: "Producto en Kame.Col.",
      images: [toAbsoluteProductMediaUrl(OG_DEFAULT_PATH, OG_DEFAULT_PATH)],
    },
  };
}

function renderTemporaryApiFailure() {
  return (
    <section className="page-shell page-shell--pdp pdp-shell">
      <main className="mx-auto max-w-4xl px-4 py-10 md:py-14">
        <div className="rounded-2xl border border-zinc-900/8 bg-white/78 p-6 text-zinc-700 shadow-[0_16px_40px_rgba(24,24,27,0.06)] backdrop-blur-sm md:p-7">
          No pudimos cargar este producto (API no respondió). Intenta de nuevo en unos segundos.
        </div>
      </main>
    </section>
  );
}

function logPdpStageError(stage: string, slug: string, e: any) {
  console.error(`[PDP] ${stage}`, {
    slug,
    message: e?.message,
    status: e?.status,
    stack: e?.stack,
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const raw = (await params)?.slug;
  const slug = decodeURIComponent(String(raw || "")).trim();

  if (!slug) {
    return buildEmptyMetadata();
  }

  try {
    const product: any = await getCachedProductBySlug(slug, {
      next: { revalidate: 60 },
    });

    if (isNotFoundProduct(product)) {
      return buildNotFoundMetadata();
    }

    return buildProductMetadata(product, slug);
  } catch {
    return buildFallbackMetadata(slug);
  }
}

export default async function ProductPage({ params }: PageProps) {
  const raw = (await params)?.slug;
  const slug = decodeURIComponent(String(raw || "")).trim();

  if (!slug) notFound();

  let product: any;
  try {
    product = await getCachedProductBySlug(slug, {
      next: { revalidate: 60 },
    });
  } catch (e: any) {
    if (typeof e?.status === "number" && e.status === 404) {
      notFound();
    }

    logPdpStageError("fetch failed", slug, e);
    return renderTemporaryApiFailure();
  }

  if (isNotFoundProduct(product)) {
    notFound();
  }

  let normalizedProduct: any;
  try {
    normalizedProduct = normalizeProductForClient(product);
  } catch (e: any) {
    logPdpStageError("normalization failed", slug, e);
    return renderTemporaryApiFailure();
  }

  let productViewModel: any;
  try {
    // PDP contract: the normalizer is the single source of truth for
    // initial display variant, available-first resolution, gallery priority,
    // and sold-out semantics. This page must only orchestrate fetch -> normalize -> view model.
    productViewModel = buildProductDetailPDPViewModel(normalizedProduct);
  } catch (e: any) {
    logPdpStageError("view-model build failed", slug, e);
    return renderTemporaryApiFailure();
  }

  let moreFromKame: DiscoveryProduct[] = [];
  try {
    const catalogPayload = await getCachedCatalogo();
    moreFromKame = buildMoreFromKameProducts(normalizedProduct, catalogPayload);
  } catch (e: any) {
    logPdpStageError("more-from-kame build failed", slug, e);
    moreFromKame = [];
  }

  try {
    return (
      <ProductDetailClient
        product={productViewModel as any}
        moreFromKame={moreFromKame}
      />
    );
  } catch (e: any) {
    logPdpStageError("render failed", slug, e);
    return renderTemporaryApiFailure();
  }
}
