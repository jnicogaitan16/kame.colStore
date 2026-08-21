"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import HomeCtaButton from "@/components/home/HomeCtaButton";
import type { HomepagePromo } from "@/types/catalog";

type HomepagePromoWithOptimizedImages = HomepagePromo & {
  image_card_url?: string | null;
  image_thumb_url?: string | null;
  image_medium_url?: string | null;
  image_large_url?: string | null;
  show_text?: boolean | null;
  alt_text?: string | null;
  placement?: string | null;
};

const BLUR_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=";

const HERO_CONTAINER_CLASS = "mx-auto w-full max-w-6xl px-4";

const PROMO_EYEBROW_CLASS =
  "mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]";

const PROMO_TITLE_CLASS =
  "text-3xl font-semibold uppercase tracking-wide text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.42)] md:text-5xl";

const PROMO_FRAME_CLASS =
  "relative w-full aspect-[16/9] max-h-[min(56vw,420px)] md:aspect-[21/9] md:max-h-[480px]";

function isDevEnvironment(): boolean {
  return process.env.NODE_ENV !== "production";
}

function normalizeHref(href: string | null | undefined): string | null {
  const raw = (href || "").trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return null;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function normalizeImageSrc(src: string | null | undefined): string | null {
  const raw = (src || "").trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function uniqueUrls(...values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const value of values) {
    const url = String(value || "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

function buildPromoImageCandidates(promo: HomepagePromoWithOptimizedImages): string[] {
  return uniqueUrls(
    promo.image_card_url,
    promo.image,
    promo.image_large_url,
    promo.image_medium_url,
  );
}

function resolvePromoImageSrc(
  promo: HomepagePromoWithOptimizedImages,
  candidateIndex = 0
): string | null {
  const candidates = buildPromoImageCandidates(promo);
  return normalizeImageSrc(candidates[candidateIndex]);
}

function normalizePromoFallbackCopy(promo: HomepagePromoWithOptimizedImages): {
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string | null;
} {
  const title = String(promo.title || "").trim() || "Kame.col";
  const subtitle = String(promo.subtitle || "").trim();
  const ctaLabel = String(promo.cta_label || "").trim() || null;

  return {
    eyebrow: subtitle || "Colección destacada",
    title,
    description:
      "Esta promo sigue disponible aunque su imagen principal no haya cargado correctamente.",
    ctaLabel,
  };
}

type Props = {
  promos: HomepagePromoWithOptimizedImages[];
};

type PromoCardProps = {
  promo: HomepagePromoWithOptimizedImages;
  idx: number;
};

function PromoCard({ promo, idx }: PromoCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageCandidateIndex, setImageCandidateIndex] = useState(0);

  const isTop = String(promo.placement || "TOP").toUpperCase() === "TOP";
  const href = normalizeHref(promo.cta_url);
  const hasCta = !!href;

  const title = (promo.title || "").trim();
  const subtitle = (promo.subtitle || "").trim();
  const fallbackCopy = normalizePromoFallbackCopy(promo);
  const showText = promo.show_text !== false || imageFailed;

  const ctaLabelRaw = imageFailed ? fallbackCopy.ctaLabel : promo.cta_label;
  const ctaLabel = String(ctaLabelRaw || "").trim() || null;
  const showOverlay = showText || Boolean(ctaLabel);

  const eyebrow = imageFailed ? fallbackCopy.eyebrow : subtitle;
  const headline = imageFailed ? fallbackCopy.title : title;

  const imageCandidates = buildPromoImageCandidates(promo);
  const imageSrc = resolvePromoImageSrc(promo, imageCandidateIndex);
  const imageSizes = "(max-width: 768px) 100vw, 1280px";
  const imagePriority = isTop && idx === 0;

  const breakoutClass =
    "relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen";

  const handleImageError = () => {
    if (imageCandidateIndex < imageCandidates.length - 1) {
      setImageCandidateIndex((current) => current + 1);
      return;
    }
    if (!imageFailed) {
      setImageFailed(true);
      if (isDevEnvironment()) {
        console.warn(
          `[HomepagePromos] promo image failed: promoId=${promo.id} src=${imageSrc || ""}`
        );
      }
    }
  };

  const CardInner = (
    <div
      className={
        "group relative w-full overflow-hidden bg-neutral-100 transition-all duration-300"
      }
    >
      <div className={PROMO_FRAME_CLASS}>
        <div className="absolute inset-0 overflow-hidden">
          {imageSrc && !imageFailed ? (
            <Image
              src={imageSrc}
              alt={promo.alt_text || title || "Promo"}
              fill
              sizes={imageSizes}
              priority={imagePriority}
              unoptimized
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              onError={handleImageError}
              {...(idx === 0 ? {} : { loading: "lazy" as const })}
              className="promo-ken-burns object-cover object-center transition-transform duration-700 ease-out md:group-hover:scale-[1.05]"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  "radial-gradient(1000px 520px at 50% 0%, rgba(255,255,255,0.12), rgba(255,255,255,0) 52%), linear-gradient(135deg, rgba(24,24,27,1) 0%, rgba(9,9,11,1) 42%, rgba(17,24,39,1) 100%)",
              }}
            />
          )}
        </div>

        <div className="relative z-10 flex h-full w-full items-end py-10 md:py-12">
          <div className={HERO_CONTAINER_CLASS}>
            <div className="w-full">
              {showOverlay ? (
                <div className="max-w-lg">
                  {showText ? (
                    <>
                      {eyebrow ? (
                        <p
                          className={
                            imageFailed
                              ? "mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70"
                              : isTop
                                ? PROMO_EYEBROW_CLASS
                                : "mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]"
                          }
                        >
                          {eyebrow}
                        </p>
                      ) : null}

                      {headline ? (
                        <h3
                          className={
                            imageFailed
                              ? "text-2xl font-semibold text-white md:text-3xl"
                              : isTop
                                ? PROMO_TITLE_CLASS
                                : "text-2xl font-semibold uppercase tracking-wide text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.42)] md:text-3xl"
                          }
                        >
                          {headline}
                        </h3>
                      ) : null}

                      {imageFailed ? (
                        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/80 md:text-base">
                          {fallbackCopy.description}
                        </p>
                      ) : null}
                    </>
                  ) : null}

                  {ctaLabel ? (
                    <div className={showText ? "mt-6" : ""}>
                      <HomeCtaButton variant="overlay">
                        {ctaLabel}
                      </HomeCtaButton>
                    </div>
                  ) : imageFailed && !hasCta ? (
                    <div className={showText ? "mt-6" : ""}>
                      <HomeCtaButton variant="overlay">Promo disponible</HomeCtaButton>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={breakoutClass}>
      {hasCta ? (
        <Link
          href={href as string}
          className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
          aria-label={promo.cta_label?.trim() || `Ver más: ${title || "promo"}`}
        >
          {CardInner}
        </Link>
      ) : (
        CardInner
      )}
    </div>
  );
}

export default function HomepagePromosClient({ promos }: Props) {
  return (
    <section>
      <div className="flex flex-col gap-5 md:gap-8">
        {promos.map((promo, idx) => (
          <PromoCard key={promo.id} promo={promo} idx={idx} />
        ))}
      </div>
    </section>
  );
}
