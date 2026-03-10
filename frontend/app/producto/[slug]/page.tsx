import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/api";
import { ProductDetailClient } from "./ProductDetailClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ slug: string }>;
}

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://kamecol.com";

function toAbsoluteHttpsUrl(inputUrl: string): string {
  const raw = String(inputUrl || "").trim();
  if (!raw) return new URL("/og/default.jpg", siteUrl).toString();

  try {
    // Make absolute against the public site URL (works for relative paths).
    const abs = new URL(raw, siteUrl).toString();

    // Enforce https for OG crawlers (iMessage/WhatsApp are picky).
    if (abs.startsWith("http://")) {
      return "https://" + abs.slice("http://".length);
    }

    return abs;
  } catch {
    return new URL("/og/default.jpg", siteUrl).toString();
  }
}

function truncate(text: string, max = 180): string {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

function pickPrimaryImageUrl(product: any): string | null {
  // Try common shapes: images[]; primary_image; image; thumbnail; media
  const candidates: Array<string | undefined | null> = [];

  const images = product?.images;
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    candidates.push(first?.url, first?.src, first?.image, first?.secure_url);
  }

  candidates.push(
    product?.primary_image,
    product?.primaryImage,
    product?.image,
    product?.image_url,
    product?.imageUrl,
    product?.thumbnail,
    product?.thumbnail_url,
    product?.cover,
    product?.cover_image
  );

  const media = product?.media;
  if (Array.isArray(media) && media.length > 0) {
    const first = media[0];
    candidates.push(first?.url, first?.src, first?.image, first?.secure_url);
  }

  const url = candidates.find((u) => typeof u === "string" && u.trim().length > 0);
  if (!url) return null;

  // Normalize relative urls so Next can resolve them against metadataBase.
  // If your backend already returns https absolute urls, we keep them.
  const u = url.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return u;
  return `/${u}`;
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
    const product: any = await getProductBySlug(slug);

    if (!product || product?.detail === "Not found" || product?.detail === "Not found.") {
      return {
        title: "Producto no encontrado | Kame.Col",
        description: "El producto no existe o no está disponible.",
        robots: { index: false, follow: false },
      };
    }

    const name = String(product?.name || product?.title || "Producto").trim();
    const descSource =
      product?.short_description || product?.shortDescription || product?.description || "";
    const description = truncate(descSource, 180) || "Producto en Kame.Col.";

    const primaryImage = pickPrimaryImageUrl(product) || "/og/default.jpg";
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
            alt: name,
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
            url: toAbsoluteHttpsUrl("/og/default.jpg"),
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
        images: [toAbsoluteHttpsUrl("/og/default.jpg")],
      },
    };
  }
}

export default async function ProductPage({ params }: PageProps) {
  const raw = (await params)?.slug;
  const slug = decodeURIComponent(String(raw || "")).trim();
  if (!slug) notFound();

  try {
    const product: any = await getProductBySlug(slug);

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
