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
  image_url?: string | null;
};

function normalizeBannerImage(b: HomepageBanner | null | undefined): string {
  return (b?.image_url ?? b?.image ?? "") || "";
}

export function HeroCarousel({ banners }: { banners: HomepageBanner[] }) {
  const slides = useMemo(
    () => (banners || []).filter((b) => normalizeBannerImage(b).length > 0),
    [banners]
  );

  const [activeIndex, setActiveIndex] = useState(0);

  if (!slides.length) return null;

  return (
    <section className="relative w-full overflow-hidden min-h-[70vh] md:min-h-[calc(100vh-72px)]">
      <Swiper
        modules={[Autoplay, Pagination, EffectFade]}
        effect="fade"
        fadeEffect={{ crossFade: true }}
        pagination={{ clickable: true }}
        autoplay={{ delay: 6000, disableOnInteraction: false }}
        loop={slides.length > 1}
        onSlideChange={(s) => setActiveIndex(s.realIndex)}
        className="w-full min-h-[70vh] md:min-h-[calc(100vh-72px)]"
      >
        {slides.map((b, idx) => {
          const img = normalizeBannerImage(b);
          const alt = b.alt_text || b.title || "Banner";
          const isActive = idx === activeIndex;
          const showText = b.show_text !== false;

          return (
            <SwiperSlide key={b.id}>
              <div className="relative w-full min-h-[70vh] md:min-h-[calc(100vh-72px)]">
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
                    className="object-cover"
                    sizes="100vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/35 to-black/75" />
                </div>

                <div className="relative z-10 mx-auto flex min-h-[70vh] md:min-h-[calc(100vh-72px)] max-w-6xl items-center px-4">
                  <div className="max-w-xl">
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
    </section>
  );
}