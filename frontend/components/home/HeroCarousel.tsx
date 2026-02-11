"use client";

import Image from "next/image";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";

import type { HomepageBanner } from "@/types/catalog";

interface HeroCarouselProps {
  banners: HomepageBanner[];
}

export function HeroCarousel({ banners }: HeroCarouselProps) {
  if (!banners?.length) return null;

  return (
    <section className="mb-10 overflow-hidden rounded-2xl bg-black text-white md:mb-14">
      <Swiper
        modules={[Autoplay, Pagination]}
        slidesPerView={1}
        centeredSlides
        loop={banners.length > 1}
        autoplay={{
          delay: 6000,
          disableOnInteraction: false,
        }}
        pagination={{ clickable: true }}
        className="w-full"
      >
        {banners.map((banner) => (
          <SwiperSlide key={banner.id}>
            <div className="relative h-[340px] w-full overflow-hidden bg-black md:h-[440px]">
              {banner.image && (
                <Image
                  src={banner.image}
                  alt={banner.alt_text || banner.title}
                  fill
                  priority
                  className="object-cover"
                  sizes="100vw"
                />
              )}

              {/* Overlay degradado para texto legible */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/0" />

              {/* Contenido */}
              <div className="relative z-10 flex h-full items-end px-5 pb-10 md:px-10">
                <div className="max-w-xl">
                  <p className="mb-2 text-xs font-semibold tracking-[0.25em] text-brand-200 uppercase">
                    KAME.COL
                  </p>
                  <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl lg:text-4xl">
                    {banner.title}
                  </h1>
                  {banner.subtitle && (
                    <p className="mt-1 text-sm font-medium uppercase tracking-[0.25em] text-slate-200">
                      {banner.subtitle}
                    </p>
                  )}
                  {banner.description && (
                    <p className="mt-3 text-sm text-slate-200 md:text-base">
                      {banner.description}
                    </p>
                  )}

                  {banner.cta_label && banner.cta_url && (
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link
                        href={banner.cta_url}
                        className="inline-flex items-center rounded-full bg-white px-6 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
                      >
                        {banner.cta_label}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}

