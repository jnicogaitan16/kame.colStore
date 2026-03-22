"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, EffectFade } from "swiper/modules";

import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/effect-fade";

import type { HomepageBanner as HomepageBannerModel } from "@/types/catalog";

type HomepageBanner = HomepageBannerModel & {
  // Imagen optimizada (ImageKit) opcional
  image_url?: string | null;

  // Campos que pueden venir desde backend aunque el tipo base no los tenga aún
  alt_text?: string | null;
  description?: string | null;
  show_text?: boolean | null;
};

function extractArray<T>(res: any): T[] {
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray(res?.results)) return res.results as T[];
  // Some backends wrap payloads differently
  if (Array.isArray(res?.data)) return res.data as T[];
  if (Array.isArray(res?.banners)) return res.banners as T[];
  return [];
}

function normalizeBannerImage(b: HomepageBanner | null | undefined): string {
  return (b?.image_url ?? b?.image ?? "") || "";
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

// Home is its own overlay-hero family.
// It intentionally remains full-bleed behind the fixed navbar and must not inherit PDP safe-area behavior.
const HERO_SECTION_CLASS = "page-shell page-shell--hero-overlay relative w-full overflow-hidden min-h-[88svh] md:min-h-[100svh] -mt-12 md:-mt-14";
const HERO_SLIDE_CLASS = "w-full min-h-[88svh] md:min-h-[100svh]";
const HERO_CONTENT_CLASS = "relative z-10 mx-auto flex min-h-[88svh] md:min-h-[100svh] max-w-6xl items-center px-4 pt-16 pb-14 md:px-6 md:pt-20 md:pb-20";

export function HeroCarousel({ banners }: { banners: HeroCarouselBannersProp }) {
  const bannersArray: HomepageBanner[] = extractArray<HomepageBanner>(banners);

  const slides = useMemo(() => {
    const safe = Array.isArray(bannersArray) ? bannersArray : [];
    return safe.filter((b) => normalizeBannerImage(b).length > 0);
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
        className={HERO_SLIDE_CLASS}
      >
        {slides.map((b, idx) => {
          const img = normalizeBannerImage(b);
          const alt = b.alt_text || b.title || "Banner";
          const isActive = idx === activeIndex;
          const slideFailed = Boolean(failedSlides[b.id]);
          const href = normalizeBannerHref(b.cta_url);
          const fallbackCopy = getFallbackCopy(b);
          const showText = b.show_text !== false || slideFailed;

          return (
            <SwiperSlide key={b.id}>
              <div className={`relative ${HERO_SLIDE_CLASS}`}>
                <div
                  className={[
                    "absolute inset-0",
                    isActive ? "opacity-100" : "opacity-0",
                    "transition-opacity duration-700",
                  ].join(" ")}
                >
                  {!slideFailed ? (
                    <>
                      <Image
                        src={img}
                        alt={alt}
                        fill
                        priority={idx === 0}
                        unoptimized
                        onError={() => markSlideAsFailed(b.id)}
                        className={
                          "object-cover transition-transform duration-[1200ms] ease-out " +
                          (isActive ? "scale-[1.06]" : "scale-100")
                        }
                        sizes="100vw"
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/12" />
                      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-28 bg-gradient-to-b from-black/42 via-black/24 to-transparent md:h-32" />
                      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-16 bg-black/10 md:h-20" />
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
                      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-28 bg-gradient-to-b from-black/18 via-black/8 to-transparent md:h-32" />
                    </>
                  )}
                  {/* Premium highlights: soft top glow + subtle vertical sheen */}
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0)_58%)]" />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0)_28%,rgba(255,255,255,0)_72%,rgba(255,255,255,0.03)_100%)] opacity-55" />
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] h-24 bg-[linear-gradient(180deg,rgba(8,8,10,0.20)_0%,rgba(8,8,10,0.10)_45%,rgba(8,8,10,0)_100%)] md:h-28" />
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

                        {(slideFailed ? fallbackCopy.ctaLabel : b.cta_label) ? (
                          href ? (
                            <a
                              href={href}
                              className="mt-5 inline-flex w-fit items-center rounded-full border border-zinc-900/10 bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-zinc-800"
                            >
                              {slideFailed ? fallbackCopy.ctaLabel : b.cta_label}
                            </a>
                          ) : (
                            <span className="mt-5 inline-flex w-fit items-center rounded-full border border-zinc-900/10 bg-white/78 px-4 py-2 text-sm font-semibold text-zinc-900">
                              {slideFailed ? fallbackCopy.ctaLabel : b.cta_label}
                            </span>
                          )
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
      {/* Home-only bottom fade. Keep separate from PDP hero transitions. */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-b from-transparent to-stone-50" />
    </section>
  );
}