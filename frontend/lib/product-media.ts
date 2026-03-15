/**
 * Product media architecture (single source of truth)
 *
 * This module centralizes all decisions related to product media:
 * - URL normalization
 * - candidate image collection
 * - primary image resolution
 * - canonical gallery construction
 * - absolute URLs for metadata / OG
 *
 * Architectural rule:
 * The logic for selecting and normalizing product images MUST live only here:
 *   frontend/lib/product-media.ts
 *
 * It must NOT be reimplemented in:
 *   - types
 *   - UI cards
 *   - page.tsx (PDP server component)
 *   - API wrappers
 *
 * All consumers (PDP, cards, metadata, catalog views) must rely on the helpers
 * exported by this module to ensure the same image selection rules everywhere.
 */
import type { NormalizedProductGalleryImage } from "@/types/catalog";

const PUBLIC_SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://kamecol.com").replace(/\/$/, "");
const PUBLIC_BACKEND_URL =
  (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/$/, "") ||
  (process.env.DJANGO_API_BASE || "").replace(/\/$/, "") ||
  "";

const INVALID_MEDIA_HOST_PATTERNS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  ".local",
  "192.168.",
  "10.",
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
] as const;

function sanitizeAbsoluteUrl(value: string): string {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    if (INVALID_MEDIA_HOST_PATTERNS.some((pattern) => hostname.includes(pattern))) {
      return "";
    }

    if (url.protocol === "http:") {
      url.protocol = "https:";
    }

    return url.toString();
  } catch {
    return "";
  }
}

function pushNormalizedCandidate(
  value: string | null | undefined,
  bucket: NormalizedProductGalleryImage[],
  seen: Set<string>,
  meta?: { thumb_url?: string | null; alt_text?: string | null }
) {
  const normalized = normalizeProductMediaUrl(value);
  if (!normalized || seen.has(normalized)) return;

  const normalizedThumb = meta?.thumb_url ? normalizeProductMediaUrl(meta.thumb_url) || null : null;

  bucket.push({
    url: normalized,
    thumb_url: normalizedThumb,
    alt_text: meta?.alt_text ?? null,
  });
  seen.add(normalized);
}

function getObjectAltText(input: Record<string, unknown>): string | null {
  const candidates = [
    input.alt_text,
    input.altText,
    input.alt,
    input.label,
    input.name,
    input.title,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (trimmed) return trimmed;
    }
  }

  return null;
}

function getObjectThumbUrl(input: Record<string, unknown>): string | null {
  const candidates = [
    input.thumb_url,
    input.thumbUrl,
    input.thumbnail_url,
    input.thumbnailUrl,
    input.thumbnail,
    input.thumb,
    input.small,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return null;
}

function firstValidNormalizedImage(candidates: Array<string | null | undefined>): string | null {
  for (const candidate of candidates) {
    const normalized = normalizeProductMediaUrl(candidate);
    if (normalized) return normalized;
  }
  return null;
}

function appendGalleryCandidates(
  input: unknown,
  bucket: NormalizedProductGalleryImage[],
  seen: Set<string>
) {
  if (!input) return;

  if (typeof input === "string") {
    pushNormalizedCandidate(input, bucket, seen);
    return;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      appendGalleryCandidates(item, bucket, seen);
    }
    return;
  }

  if (typeof input !== "object") return;

  const record = input as Record<string, unknown>;
  const rawCandidates: Array<string | null | undefined> = [];
  collectProductImageCandidates(record, rawCandidates);

  const primary = firstValidNormalizedImage(rawCandidates);
  if (!primary) return;

  pushNormalizedCandidate(primary, bucket, seen, {
    thumb_url: getObjectThumbUrl(record),
    alt_text: getObjectAltText(record),
  });
}

export function normalizeProductMediaUrl(src?: string | null): string {
  const s = String(src || "").trim();
  if (!s) return "";

  if (s.startsWith("data:") || s.startsWith("blob:")) return "";

  if (s.startsWith("http://") || s.startsWith("https://")) {
    return sanitizeAbsoluteUrl(s);
  }

  if (s.startsWith("//")) {
    return sanitizeAbsoluteUrl(`https:${s}`);
  }

  const rel = s.startsWith("/") ? s : `/${s}`;

  if (rel.startsWith("/media/") || rel.startsWith("/api/media/")) {
    if (PUBLIC_BACKEND_URL) {
      return sanitizeAbsoluteUrl(`${PUBLIC_BACKEND_URL}${rel}`);
    }
    return sanitizeAbsoluteUrl(`${PUBLIC_SITE_URL}${rel}`);
  }

  if (rel.startsWith("/_next/") || rel.startsWith("/api/") || rel.startsWith("/admin/")) {
    return "";
  }

  return sanitizeAbsoluteUrl(`${PUBLIC_SITE_URL}${rel}`);
}

export function collectProductImageCandidates(
  input: unknown,
  bucket: Array<string | null | undefined>
): void {
  if (!input) return;

  if (typeof input === "string") {
    bucket.push(input);
    return;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      collectProductImageCandidates(item, bucket);
    }
    return;
  }

  if (typeof input !== "object") return;

  const record = input as Record<string, unknown>;
  bucket.push(
    typeof record.url === "string" ? record.url : undefined,
    typeof record.src === "string" ? record.src : undefined,
    typeof record.image === "string" ? record.image : undefined,
    typeof record.image_url === "string" ? record.image_url : undefined,
    typeof record.imageUrl === "string" ? record.imageUrl : undefined,
    typeof record.secure_url === "string" ? record.secure_url : undefined,
    typeof record.public_url === "string" ? record.public_url : undefined,
    typeof record.publicUrl === "string" ? record.publicUrl : undefined,
    typeof record.main_image === "string" ? record.main_image : undefined,
    typeof record.primary_image === "string" ? record.primary_image : undefined,
    typeof record.primaryImage === "string" ? record.primaryImage : undefined,
    typeof record.thumbnail === "string" ? record.thumbnail : undefined,
    typeof record.thumbnail_url === "string" ? record.thumbnail_url : undefined,
    typeof record.thumbnailUrl === "string" ? record.thumbnailUrl : undefined,
    typeof record.thumb === "string" ? record.thumb : undefined,
    typeof record.thumb_url === "string" ? record.thumb_url : undefined,
    typeof record.file === "string" ? record.file : undefined,
    typeof record.path === "string" ? record.path : undefined,
    typeof record.original === "string" ? record.original : undefined,
    typeof record.large === "string" ? record.large : undefined,
    typeof record.medium === "string" ? record.medium : undefined,
    typeof record.small === "string" ? record.small : undefined,
    typeof record.cover === "string" ? record.cover : undefined,
    typeof record.cover_image === "string" ? record.cover_image : undefined,
    typeof record.coverImage === "string" ? record.coverImage : undefined
  );
}

export function getProductPrimaryImage(product: unknown): string | null {
  const record = typeof product === "object" && product !== null ? (product as Record<string, unknown>) : null;
  if (!record) return null;

  const explicitCandidates: Array<string | null | undefined> = [];
  const productCandidates: Array<string | null | undefined> = [];
  const galleryCandidates: Array<string | null | undefined> = [];
  const variantCandidates: Array<string | null | undefined> = [];

  collectProductImageCandidates(record.primary_image, explicitCandidates);
  collectProductImageCandidates(record.primaryImage, explicitCandidates);
  collectProductImageCandidates(record.main_image, explicitCandidates);
  collectProductImageCandidates(record.image, explicitCandidates);
  collectProductImageCandidates(record.image_url, explicitCandidates);
  collectProductImageCandidates(record.imageUrl, explicitCandidates);

  collectProductImageCandidates(record.images, productCandidates);
  collectProductImageCandidates(record.product_images, productCandidates);
  collectProductImageCandidates(record.productImages, productCandidates);

  collectProductImageCandidates(record.gallery, galleryCandidates);
  collectProductImageCandidates(record.gallery_images, galleryCandidates);
  collectProductImageCandidates(record.galleryImages, galleryCandidates);
  collectProductImageCandidates(record.media, galleryCandidates);

  collectProductImageCandidates(record.color_images, variantCandidates);
  collectProductImageCandidates(record.colorImages, variantCandidates);
  collectProductImageCandidates(record.variant_images, variantCandidates);
  collectProductImageCandidates(record.variantImages, variantCandidates);
  collectProductImageCandidates(record.variant_image, variantCandidates);
  collectProductImageCandidates(record.variantImage, variantCandidates);
  collectProductImageCandidates(record.variants, variantCandidates);

  return (
    firstValidNormalizedImage(explicitCandidates) ||
    firstValidNormalizedImage(productCandidates) ||
    firstValidNormalizedImage(galleryCandidates) ||
    firstValidNormalizedImage(variantCandidates) ||
    null
  );
}

export function getProductGalleryImages(product: unknown): NormalizedProductGalleryImage[] {
  const record = typeof product === "object" && product !== null ? (product as Record<string, unknown>) : null;
  if (!record) return [];

  const gallery: NormalizedProductGalleryImage[] = [];
  const seen = new Set<string>();

  pushNormalizedCandidate(getProductPrimaryImage(record), gallery, seen);

  appendGalleryCandidates(record.images, gallery, seen);
  appendGalleryCandidates(record.gallery, gallery, seen);
  appendGalleryCandidates(record.gallery_images, gallery, seen);
  appendGalleryCandidates(record.galleryImages, gallery, seen);
  appendGalleryCandidates(record.media, gallery, seen);
  appendGalleryCandidates(record.product_images, gallery, seen);
  appendGalleryCandidates(record.productImages, gallery, seen);

  return gallery;
}

export function toAbsoluteProductMediaUrl(
  input?: string | null,
  fallbackPath = "/og/default.jpg"
): string {
  const normalizedInput = normalizeProductMediaUrl(input);
  if (normalizedInput) {
    return normalizedInput;
  }

  const normalizedFallback = normalizeProductMediaUrl(fallbackPath);
  if (normalizedFallback) {
    return normalizedFallback;
  }

  return sanitizeAbsoluteUrl(`${PUBLIC_SITE_URL}/og/default.jpg`) || "https://kamecol.com/og/default.jpg";
}