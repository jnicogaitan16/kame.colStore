"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, EffectFade } from "swiper/modules";

import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/effect-fade";

import type { HomepageBanner as HomepageBannerModel } from "@/types/catalog";

type HomepageBanner = HomepageBannerModel & {
  // El serializer puede devolver "image_url" además de "image".
  image_url?: string | null;
};

function normalizeBannerImage(b: HomepageBanner | null | undefined): string {
  // Soporta varios nombres por si el serializer devuelve "image" o "image_url".
  // Algunos tipos vienen como `string | null`.
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
      <div className="relative w-full">
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
            const isActive = idx === activeIndex;

            const img = normalizeBannerImage(b);
            const alt = b.alt_text || b.title || "Kame.col";

            return (
              <SwiperSlide key={b.id}>
                <div className="relative w-full min-h-[70vh] md:min-h-[calc(100vh-72px)]">
                  {/* Imagen */}
                  <div
                    className={[
                      "absolute inset-0",
                      "hero-reveal",
                      isActive ? "is-active" : "",
                    ].join(" ")}
                  >
                    <Image
                      src={img}
                      alt={alt}
                      fill
                      priority={idx === 0}
                      className="object-cover"
                      sizes="100vw"
                    />
                    {/* Overlay oscuro para legibilidad */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/35 to-black/75" />
                  </div>

                  {/* Panel negro “Skeleton” (entra desde un lado) */}
                  <div
                    className={[
                      "absolute inset-y-0 left-0 w-[58%] max-w-[680px]",
                      "hero-skeleton-panel",
                      isActive ? "is-active" : "",
                    ].join(" ")}
                    aria-hidden
                  />

                  {/* Copy */}
                  <div className="relative z-10 mx-auto flex min-h-[70vh] md:min-h-[calc(100vh-72px)] max-w-6xl items-center px-4">
                    <div className="max-w-xl">
                      {b.subtitle ? (
                        <p className="mb-3 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold tracking-widest text-white/85">
                          {b.subtitle}
                        </p>
                      ) : null}

                      <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-5xl">
                        {b.title}
                      </h1>

                      {b.description ? (
                        <p className="mt-4 text-sm leading-relaxed text-white/80 md:text-base">
                          {b.description}
                        </p>
                      ) : null}

                      <div className="mt-6 flex flex-wrap gap-3">
                        {b.cta_label && b.cta_url ? (
                          <Link
                            href={b.cta_url}
                            className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"
                          >
                            {b.cta_label}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </SwiperSlide>
            );
          })}
        </Swiper>
      </div>
    </section>
  );
}
