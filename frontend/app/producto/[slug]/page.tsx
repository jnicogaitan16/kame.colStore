import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/api";
import { ProductDetailClient } from "./ProductDetailClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ slug: string }>;
}

const getCachedProductBySlug = cache(async (slug: string) => {
  return getProductBySlug(slug);
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kamecol.com";
const OG_DEFAULT_PATH = "/og/default.jpg";

const INVALID_IMAGE_PATTERNS = [
  "/media/cache/",
  "/_next/",
  "blob:",
  "data:",
  "localhost",
  "127.0.0.1",
];

function toAbsoluteHttpsUrl(inputUrl: string): string {
  const raw = String(inputUrl || "").trim();
  if (!raw) return new URL(OG_DEFAULT_PATH, siteUrl).toString();

  try {
    const abs = new URL(raw, siteUrl).toString();
    if (abs.startsWith("http://")) {
      return "https://" + abs.slice("http://".length);
    }
    return abs;
  } catch {
    return new URL(OG_DEFAULT_PATH, siteUrl).toString();
  }
}

function truncate(text: string, max = 180): string {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

function isLikelyPublicImageUrl(value: unknown): value is string {
  const raw = String(value || "").trim();
  if (!raw) return false;

  const normalized = raw.toLowerCase();
  if (!/(^https?:\/\/|^\/|^[a-z0-9].*\/(.+)\.(jpg|jpeg|png|webp|avif|gif)(\?.*)?$)/i.test(raw) &&
      !/\.(jpg|jpeg|png|webp|avif|gif)(\?.*)?$/i.test(raw)) {
    return false;
  }

  return !INVALID_IMAGE_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function collectImageCandidates(input: any, bucket: Array<string | null | undefined>) {
  if (!input) return;

  if (typeof input === "string") {
    bucket.push(input);
    return;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      collectImageCandidates(item, bucket);
    }
    return;
  }

  if (typeof input === "object") {
    bucket.push(
      input.url,
      input.src,
      input.image,
      input.image_url,
      input.imageUrl,
      input.secure_url,
      input.public_url,
      input.publicUrl,
      input.file,
      input.path,
      input.original,
      input.large,
      input.medium,
      input.small,
      input.thumbnail,
      input.thumbnail_url,
      input.thumbnailUrl,
      input.cover,
      input.cover_image,
      input.coverImage,
      input.primary,
      input.primary_image,
      input.primaryImage
    );
  }
}

function normalizeImageCandidate(rawValue: string): string | null {
  const raw = String(rawValue || "").trim();
  if (!isLikelyPublicImageUrl(raw)) return null;

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  if (raw.startsWith("/")) {
    return raw;
  }

  if (/^[a-z0-9].*\.(jpg|jpeg|png|webp|avif|gif)(\?.*)?$/i.test(raw)) {
    return `/${raw}`;
  }

  return null;
}

function pickPrimaryImageUrl(product: any): string | null {
  const candidates: Array<string | null | undefined> = [];

  collectImageCandidates(product?.primary_image, candidates);
  collectImageCandidates(product?.primaryImage, candidates);
  collectImageCandidates(product?.image, candidates);
  collectImageCandidates(product?.image_url, candidates);
  collectImageCandidates(product?.imageUrl, candidates);
  collectImageCandidates(product?.cover, candidates);
  collectImageCandidates(product?.cover_image, candidates);
  collectImageCandidates(product?.coverImage, candidates);
  collectImageCandidates(product?.thumbnail, candidates);
  collectImageCandidates(product?.thumbnail_url, candidates);
  collectImageCandidates(product?.thumbnailUrl, candidates);

  collectImageCandidates(product?.images, candidates);
  collectImageCandidates(product?.gallery, candidates);
  collectImageCandidates(product?.gallery_images, candidates);
  collectImageCandidates(product?.galleryImages, candidates);
  collectImageCandidates(product?.media, candidates);
  collectImageCandidates(product?.product_images, candidates);
  collectImageCandidates(product?.productImages, candidates);
  collectImageCandidates(product?.color_images, candidates);
  collectImageCandidates(product?.colorImages, candidates);
  collectImageCandidates(product?.variant_images, candidates);
  collectImageCandidates(product?.variantImages, candidates);
  collectImageCandidates(product?.variant_image, candidates);
  collectImageCandidates(product?.variantImage, candidates);
  collectImageCandidates(product?.default_image, candidates);
  collectImageCandidates(product?.defaultImage, candidates);

  const firstValid = candidates
    .map((candidate) => (typeof candidate === "string" ? normalizeImageCandidate(candidate) : null))
    .find((candidate) => Boolean(candidate));

  return firstValid || null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const raw = (await params)?.slug;
  const slug = decodeURIComponent(String(raw || "")).trim();

  if (!slug) {
    return {
      title: "Producto | Kame.Col",
      description: "Producto en Kame.Col.",
      robots: { index: false, follow: false },
    };
  }

  try {
    const product: any = await getCachedProductBySlug(slug);

    if (!product || product?.detail === "Not found" || product?.detail === "Not found.") {
      return {
        title: "Producto no encontrado | Kame.Col",
        description: "El producto no existe o no está disponible en Kame.Col.",
        robots: { index: false, follow: false },
      };
    }

    const name = String(product?.name || product?.title || "Producto").trim();
    const descSource =
      product?.short_description || product?.shortDescription || product?.description || "";
    const description = truncate(descSource, 180) || "Producto en Kame.Col.";

    const primaryImage = pickPrimaryImageUrl(product) || OG_DEFAULT_PATH;
    const ogImage = toAbsoluteHttpsUrl(primaryImage);

    return {
      title: `${name} | Kame.Col`,
      description,
      openGraph: {
        // Next.js Metadata typing does not include "product" as a valid OG type.
        // We keep a valid type here and override og:type via `other` below.
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
  } catch {
    // Temporary API failure: avoid indexing and show a safe preview.
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
            url: toAbsoluteHttpsUrl(OG_DEFAULT_PATH),
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
        images: [toAbsoluteHttpsUrl(OG_DEFAULT_PATH)],
      },
    };
  }
}

export default async function ProductPage({ params }: PageProps) {
  const raw = (await params)?.slug;
  const slug = decodeURIComponent(String(raw || "")).trim();
  if (!slug) notFound();

  try {
    const product: any = await getCachedProductBySlug(slug);

    // Defensive: some backends return a payload like { detail: "Not found" }
    if (!product || product?.detail === "Not found" || product?.detail === "Not found.") {
      notFound();
    }

    return <ProductDetailClient product={product} />;
  } catch (e: any) {
    // If backend answered 404, this is a true not-found.
    if (typeof e?.status === "number" && e.status === 404) {
      notFound();
    }

    // Otherwise, treat as temporary API failure.
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-white/80">
          No pudimos cargar este producto (API no respondió). Intenta de nuevo en unos segundos.
        </div>
      </main>
    );
  }
}
