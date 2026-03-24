import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/api";
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

const OG_DEFAULT_PATH = "/og/default.jpg";

const getCachedProductBySlug = cache(
  async (slug: string, options?: { next?: { revalidate?: number } }) => {
    return getProductBySlug(slug, options);
  }
);

function truncate(text: string, max = 180): string {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

function isNotFoundProduct(product: any): boolean {
  return !product || product?.detail === "Not found" || product?.detail === "Not found.";
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
    productViewModel = buildProductDetailPDPViewModel(normalizedProduct);
  } catch (e: any) {
    logPdpStageError("view-model build failed", slug, e);
    return renderTemporaryApiFailure();
  }

  try {
    return <ProductDetailClient product={productViewModel as any} />;
  } catch (e: any) {
    logPdpStageError("render failed", slug, e);
    return renderTemporaryApiFailure();
  }
}
