"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, EffectFade } from "swiper/modules";

import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/effect-fade";

import type { HomepageBanner as HomepageBannerModel } from "@/types/catalog";

type HomepageBanner = HomepageBannerModel & {
  image_url?: string | null;
  image_hero_desktop_url?: string | null;
  image_hero_mobile_url?: string | null;
  image_medium_url?: string | null;
  image_large_url?: string | null;
  alt_text?: string | null;
  description?: string | null;
  show_text?: boolean | null;
};

function extractArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const payload = res as Record<string, unknown> | null | undefined;
  if (Array.isArray(payload?.results)) return payload.results as T[];
  if (Array.isArray(payload?.data)) return payload.data as T[];
  if (Array.isArray(payload?.banners)) return payload.banners as T[];
  return [];
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

function buildBannerImageCandidates(b: HomepageBanner): string[] {
  return uniqueUrls(
    b.image_hero_desktop_url,
    b.image_hero_mobile_url,
    b.image_large_url,
    b.image_medium_url,
    b.image,
    b.image_url,
  );
}

function HeroBannerImage({
  banner,
  alt,
  isActive,
  priority,
  onExhausted,
}: {
  banner: HomepageBanner;
  alt: string;
  isActive: boolean;
  priority: boolean;
  onExhausted: () => void;
}) {
  const candidates = useMemo(() => buildBannerImageCandidates(banner), [banner]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const src = candidates[candidateIndex] ?? "";

  const handleError = () => {
    if (candidateIndex < candidates.length - 1) {
      setCandidateIndex((current) => current + 1);
      return;
    }
    onExhausted();
  };

  if (!src) {
    return null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      loading={priority ? "eager" : "lazy"}
      onError={handleError}
      className={[
        "absolute inset-0 h-full w-full object-cover object-center",
        "transition-transform duration-[1200ms] ease-out",
        isActive ? "scale-[1.02]" : "scale-100",
      ].join(" ")}
      sizes="100vw"
    />
  );
}

function normalizeBannerHref(value: string | null | undefined): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return null;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function getFallbackCopy(banner: HomepageBanner): {
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string | null;
} {
  const title = String(banner.title || "").trim() || "Kame.col";
  const description =
    String(banner.description || "").trim() ||
    "Explora piezas premium con identidad visual sólida incluso cuando la media no está disponible.";
  const subtitle = String(banner.subtitle || "").trim();
  const ctaLabel = String(banner.cta_label || "").trim() || null;

  return {
    eyebrow: subtitle || "Colección destacada",
    title,
    description,
    ctaLabel,
  };
}

type HeroCarouselBannersProp = unknown;

const HERO_SECTION_CLASS =
  "page-shell page-shell--hero-overlay relative w-full overflow-hidden -mt-12 md:-mt-14";
const HERO_FRAME_CLASS =
  "hero-carousel-frame relative w-full aspect-[4/5] max-h-[92svh] sm:aspect-[16/9] sm:max-h-[min(72svh,720px)] lg:aspect-[21/9] lg:max-h-[640px]";
const HERO_CONTENT_CLASS =
  "absolute inset-0 z-10 mx-auto flex max-w-6xl items-center px-4 pt-16 pb-14 md:px-6 md:pt-20 md:pb-20";

export function HeroCarousel({ banners }: { banners: HeroCarouselBannersProp }) {
  const bannersArray: HomepageBanner[] = extractArray<HomepageBanner>(banners);

  const slides = useMemo(() => {
    const safe = Array.isArray(bannersArray) ? bannersArray : [];
    return safe.filter((b) => buildBannerImageCandidates(b).length > 0);
  }, [bannersArray]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [failedSlides, setFailedSlides] = useState<Record<number, true>>({});

  if (!slides.length) return null;

  const markSlideAsFailed = (slideId: number) => {
    setFailedSlides((current) => {
      if (current[slideId]) return current;
      return { ...current, [slideId]: true };
    });
  };

  return (
    <section className={HERO_SECTION_CLASS}>
      <Swiper
        modules={[Autoplay, Pagination, EffectFade]}
        effect="fade"
        fadeEffect={{ crossFade: true }}
        pagination={{ clickable: true }}
        autoplay={{ delay: 6000, disableOnInteraction: false }}
        loop={slides.length > 1}
        onSlideChange={(s) => setActiveIndex(s.realIndex)}
        className="hero-carousel-swiper w-full"
      >
        {slides.map((b, idx) => {
          const alt = b.alt_text || b.title || "Banner";
          const isActive = idx === activeIndex;
          const slideFailed = Boolean(failedSlides[b.id]);
          const href = normalizeBannerHref(b.cta_url);
          const fallbackCopy = getFallbackCopy(b);
          const showText = b.show_text !== false || slideFailed;

          const ctaLabel = slideFailed ? fallbackCopy.ctaLabel : b.cta_label;
          const slideAriaLabel = ctaLabel
            ? `${ctaLabel}: ${slideFailed ? fallbackCopy.title : b.title || alt}`
            : `Abrir ${slideFailed ? fallbackCopy.title : b.title || alt}`;

          const slideInner = (
            <div className={HERO_FRAME_CLASS}>
              <div
                className={[
                  "absolute inset-0",
                  isActive ? "opacity-100" : "opacity-0",
                  "transition-opacity duration-700",
                ].join(" ")}
              >
                {!slideFailed ? (
                  <>
                    <HeroBannerImage
                      banner={b}
                      alt={alt}
                      isActive={isActive}
                      priority={idx === 0}
                      onExhausted={() => markSlideAsFailed(b.id)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-black/6 via-transparent to-black/12" />
                  </>
                ) : (
                  <>
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "radial-gradient(1200px 620px at 50% 0%, rgba(255,255,255,0.55), rgba(255,255,255,0) 52%), linear-gradient(135deg, rgba(247,245,242,1) 0%, rgba(255,255,255,1) 38%, rgba(244,244,245,1) 100%)",
                      }}
                    />
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-14 bg-gradient-to-b from-black/8 via-black/4 to-transparent md:h-16" />
                  </>
                )}
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0)_58%)]" />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0)_28%,rgba(255,255,255,0)_72%,rgba(255,255,255,0.03)_100%)] opacity-55" />
                <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-10 bg-[linear-gradient(180deg,rgba(8,8,10,0.08)_0%,rgba(8,8,10,0.04)_45%,rgba(8,8,10,0)_100%)] md:h-12" />
                {slideFailed ? (
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(244,244,245,0.34))]" />
                ) : null}
              </div>

              <div className={HERO_CONTENT_CLASS}>
                <div
                  className={[
                    "max-w-xl",
                    "transition-all duration-700 ease-out",
                    isActive ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
                  ].join(" ")}
                >
                  {showText ? (
                    <div className="inline-flex max-w-lg flex-col rounded-2xl border border-white/35 bg-white/32 px-5 py-4 backdrop-blur-sm shadow-[0_12px_34px_rgba(24,24,27,0.08)] md:px-6 md:py-5">
                      {(slideFailed ? fallbackCopy.eyebrow : b.subtitle) ? (
                        <p className="mb-3 inline-flex w-fit rounded-full border border-zinc-900/8 bg-white/72 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-zinc-700">
                          {slideFailed ? fallbackCopy.eyebrow : b.subtitle}
                        </p>
                      ) : null}

                      {(slideFailed ? fallbackCopy.title : b.title) ? (
                        <h1 className="text-3xl font-bold tracking-[-0.02em] text-zinc-950 md:text-5xl">
                          {slideFailed ? fallbackCopy.title : b.title}
                        </h1>
                      ) : null}

                      {(slideFailed ? fallbackCopy.description : b.description) ? (
                        <p className="mt-4 text-sm leading-relaxed text-zinc-700 md:text-base">
                          {slideFailed ? fallbackCopy.description : b.description}
                        </p>
                      ) : null}

                      {slideFailed ? (
                        <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                          Media temporalmente no disponible
                        </p>
                      ) : null}

                      {ctaLabel ? (
                        <span className={href ? "mt-5 inline-flex w-fit items-center rounded-full border border-zinc-900/10 bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-zinc-800" : "mt-5 inline-flex w-fit items-center rounded-full border border-zinc-900/10 bg-white/78 px-4 py-2 text-sm font-semibold text-zinc-900"}>
                          {ctaLabel}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );

          return (
            <SwiperSlide key={b.id}>
              {href ? (
                <Link
                  href={href}
                  className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/30"
                  aria-label={slideAriaLabel}
                >
                  {slideInner}
                </Link>
              ) : (
                slideInner
              )}
            </SwiperSlide>
          );
        })}
      </Swiper>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-b from-transparent to-stone-50" />
    </section>
  );
}
