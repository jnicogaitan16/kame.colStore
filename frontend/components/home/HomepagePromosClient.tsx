"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import type { HomepagePromo } from "@/types/catalog";

type HomepagePromoWithOptimizedImages = HomepagePromo & {
  image_thumb_url?: string | null;
  image_medium_url?: string | null;
  image_large_url?: string | null;
  show_text?: boolean | null;
  alt_text?: string | null;
};

const BLUR_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=";

const HERO_OVERLAY_CLASS =
  "absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10";

const HERO_CONTAINER_CLASS = "mx-auto w-full max-w-6xl px-4";

const HERO_SUBTITLE_CLASS =
  "mb-3 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold tracking-widest text-white/85";

const HERO_TITLE_CLASS = "text-3xl font-semibold text-white md:text-5xl";

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

  const isTop = true;
  const href = normalizeHref(promo.cta_url);
  const hasCta = !!href;

  const title = (promo.title || "").trim();
  const subtitle = (promo.subtitle || "").trim();
  const fallbackCopy = normalizePromoFallbackCopy(promo);
  const showText = promo.show_text !== false || imageFailed;
  const hasText =
    showText &&
    Boolean(
      imageFailed
        ? fallbackCopy.title || fallbackCopy.eyebrow || fallbackCopy.description
        : title || subtitle
    );

  const preferred = promo.image_large_url || promo.image_medium_url || promo.image;

  let imageSrc = normalizeImageSrc(preferred);

  if (imageSrc?.includes("/media/CACHE/") && promo.image) {
    imageSrc = normalizeImageSrc(promo.image);
  }

  const imageSizes = "100vw";
  const imagePriority = isTop && idx === 0;

  const breakoutClass =
    "relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen";

  const promoHeightClass = "min-h-[40vh] md:min-h-[44vh]";

  const handleImageError = () => {
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
        "promo-enter group relative w-full overflow-hidden " +
        "bg-black transition-all duration-300"
      }
    >
      <div className="absolute inset-0">
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
            className="object-cover transition-transform duration-300 group-hover:scale-[1.01]"
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

      <div className={`pointer-events-none ${HERO_OVERLAY_CLASS}`} />
      {imageFailed ? (
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.16),rgba(0,0,0,0.45))]" />
      ) : null}

      <div
        className={`relative w-full ${promoHeightClass} flex items-end py-10 md:py-12`}
      >
        <div className={HERO_CONTAINER_CLASS}>
          <div className="w-full">
            {hasText || hasCta ? (
              <div className="inline-block rounded-2xl border border-white/10 bg-black/25 px-5 py-4 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.28)]">
                {hasText ? (
                  <div>
                    {(imageFailed ? fallbackCopy.eyebrow : subtitle) ? (
                      <p
                        className={
                          isTop
                            ? HERO_SUBTITLE_CLASS
                            : "mb-3 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold tracking-widest text-white/85"
                        }
                      >
                        {imageFailed ? fallbackCopy.eyebrow : subtitle}
                      </p>
                    ) : null}

                    {(imageFailed ? fallbackCopy.title : title) ? (
                      <h3
                        className={
                          isTop
                            ? HERO_TITLE_CLASS
                            : "text-2xl font-semibold text-white md:text-3xl"
                        }
                      >
                        {imageFailed ? fallbackCopy.title : title}
                      </h3>
                    ) : null}

                    {imageFailed ? (
                      <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/80 md:text-base">
                        {fallbackCopy.description}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {hasCta ? (
                  <div className={hasText ? "mt-4" : ""}>
                    <span
                      className={
                        isTop
                          ? "text-base md:text-lg text-white/90 transition-all duration-300 group-hover:text-white"
                          : "text-base text-white/90 underline decoration-white/20 transition-all duration-300 group-hover:text-white group-hover:decoration-white/60"
                      }
                    >
                      {(imageFailed ? fallbackCopy.ctaLabel : promo.cta_label)?.trim() ||
                        "Ver más"}
                    </span>
                  </div>
                ) : imageFailed ? (
                  <div className="mt-4">
                    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/95">
                      Promo disponible
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
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
          className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
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
      <div className="flex flex-col gap-10">
        {promos.map((promo, idx) => (
          <PromoCard key={promo.id} promo={promo} idx={idx} />
        ))}
      </div>
    </section>
  );
}
