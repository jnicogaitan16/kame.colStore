"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import type { ProductImage as ProductImageType } from "@/types/catalog";
import SoldOutBadge from "@/components/badges/SoldOutBadge";
import "swiper/css";
import "swiper/css/pagination";

interface ProductGalleryProps {
  images: ProductImageType[];
  productName: string;
  soldOut: boolean;
}

export function ProductGallery({ images, productName, soldOut = false }: ProductGalleryProps) {
  const slides = useMemo(() => {
    if (!images?.length) return [];
    return images.filter((img) => img.image);
  }, [images]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  const goPrev = useCallback(() => {
    setLightboxIndex((i) => (i - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const goNext = useCallback(() => {
    setLightboxIndex((i) => (i + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxOpen, closeLightbox, goPrev, goNext]);

  if (slides.length === 0) {
    return (
      <div className="aspect-square w-full overflow-hidden rounded-2xl bg-neutral-950/40 border border-white/10">
        <div className="flex h-full items-center justify-center text-slate-400">
          <svg className="h-24 w-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-neutral-950/40 border border-white/10">
      <SoldOutBadge show={soldOut === true} variant="detail" />

      <Swiper
        modules={[Pagination]}
        spaceBetween={0}
        slidesPerView={1}
        pagination={{ clickable: true }}
        onSwiper={(sw) => setActiveIndex(sw.activeIndex ?? 0)}
        onSlideChange={(sw: SwiperType) => setActiveIndex(sw.activeIndex ?? 0)}
        className="k-gallery-swiper h-full w-full"
      >
        {slides.map((img, index) => (
          <SwiperSlide key={img.id}>
            <div className="relative w-full aspect-square">
              {(() => {
                const src = img.image ? `${img.image}?v=${img.id}` : null;
                if (!src) return null;

                return (
                  <img
                    key={src}
                    src={src}
                    alt={img.alt_text || productName}
                    loading={index === 0 ? "eager" : "lazy"}
                    // Hint to the browser that the first slide is the highest priority request
                    fetchPriority={index === 0 ? "high" : "auto"}
                    decoding="async"
                    className="h-full w-full object-contain cursor-zoom-in"
                    onClick={() => openLightbox(index === activeIndex ? activeIndex : index)}
                  />
                );
              })()}
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
      {lightboxOpen && slides.length > 0 && (
        <div
          className="fixed inset-0 z-[100] bg-black/90"
          role="dialog"
          aria-modal="true"
          aria-label="Imagen en pantalla completa"
          onClick={closeLightbox}
        >
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <div className="relative w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={closeLightbox}
                className="absolute left-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/55"
                aria-label="Cerrar"
              >
                ×
              </button>

              {slides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    className="absolute left-2 top-1/2 z-10 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/55"
                    aria-label="Anterior"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/55"
                    aria-label="Siguiente"
                  >
                    ›
                  </button>
                </>
              )}

              <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
                {(() => {
                  const img = slides[lightboxIndex];
                  const src = img?.image ? `${img.image}?v=${img.id}` : null;
                  if (!src) return null;
                  return (
                    <img
                      src={src}
                      alt={img.alt_text || productName}
                      decoding="async"
                      className="h-full w-full object-contain"
                      draggable={false}
                    />
                  );
                })()}
              </div>

              <div className="mt-3 text-center text-xs text-white/70">
                {lightboxIndex + 1}/{slides.length}
              </div>
            </div>
          </div>
        </div>
      )}
      <style jsx global>{`
        .k-gallery-swiper .swiper-pagination {
          bottom: 12px;
        }

        .k-gallery-swiper .swiper-pagination-bullet {
          width: 5px;
          height: 5px;
          margin: 0 5px !important;
          background: rgba(255, 255, 255, 0.22);
          opacity: 0.9;
          transition: transform 180ms ease, background-color 180ms ease, opacity 180ms ease;
        }

        .k-gallery-swiper .swiper-pagination-bullet-active {
          background: var(--accent);
          opacity: 1;
          transform: scale(1.2);
        }

        .k-gallery-swiper .swiper-pagination-bullet:hover {
          background: rgba(255, 255, 255, 0.32);
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
