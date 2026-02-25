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

type HeroCarouselBannersProp = unknown;

// Pull hero up behind the fixed navbar so the image starts at the very top.
// Navbar height: h-12 (mobile) / h-14 (md+)
export function HeroCarousel({ banners }: { banners: HeroCarouselBannersProp }) {
  const bannersArray: HomepageBanner[] = extractArray<HomepageBanner>(banners);

  const slides = useMemo(() => {
    const safe = Array.isArray(bannersArray) ? bannersArray : [];
    return safe.filter((b) => normalizeBannerImage(b).length > 0);
  }, [bannersArray]);

  const [activeIndex, setActiveIndex] = useState(0);

  if (!slides.length) return null;

  return (
    <section className="relative w-full overflow-hidden min-h-[70vh] md:min-h-[100vh] -mt-12 md:-mt-14">
      <Swiper
        modules={[Autoplay, Pagination, EffectFade]}
        effect="fade"
        fadeEffect={{ crossFade: true }}
        pagination={{ clickable: true }}
        autoplay={{ delay: 6000, disableOnInteraction: false }}
        loop={slides.length > 1}
        onSlideChange={(s) => setActiveIndex(s.realIndex)}
        className="w-full min-h-[70vh] md:min-h-[100vh]"
      >
        {slides.map((b, idx) => {
          const img = normalizeBannerImage(b);
          const alt = b.alt_text || b.title || "Banner";
          const isActive = idx === activeIndex;
          const showText = b.show_text !== false;

          return (
            <SwiperSlide key={b.id}>
              <div className="relative w-full min-h-[70vh] md:min-h-[100vh]">
                <div
                  className={[
                    "absolute inset-0",
                    isActive ? "opacity-100" : "opacity-0",
                    "transition-opacity duration-700",
                  ].join(" ")}
                >
                  <Image
                    src={img}
                    alt={alt}
                    fill
                    priority={idx === 0}
                    unoptimized
                    className={
                      "object-cover transition-transform duration-[1200ms] ease-out " +
                      (isActive ? "scale-[1.06]" : "scale-100")
                    }
                    sizes="100vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/35 to-black/75" />
                  {/* Premium highlights: soft top glow + subtle vertical sheen */}
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0)_55%)]" />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0)_30%,rgba(255,255,255,0)_70%,rgba(255,255,255,0.04)_100%)] opacity-70" />
                </div>

                <div className="relative z-10 mx-auto flex min-h-[70vh] md:min-h-[100vh] max-w-6xl items-center px-4 pt-14 md:pt-16">
                  <div
                    className={[
                      "max-w-xl",
                      "transition-all duration-700 ease-out",
                      isActive ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
                    ].join(" ")}
                  >
                    {showText ? (
                      <>
                        {b.subtitle ? (
                          <p className="mb-3 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold tracking-widest text-white/85">
                            {b.subtitle}
                          </p>
                        ) : null}

                        {b.title ? (
                          <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">
                            {b.title}
                          </h1>
                        ) : null}

                        {b.description ? (
                          <p className="mt-4 text-sm leading-relaxed text-white/80 md:text-base">
                            {b.description}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
      {/* Subtle fade at bottom so next section feels premium */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-black/70" />
    </section>
  );
}