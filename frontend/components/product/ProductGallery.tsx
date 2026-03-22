"use client";

/** Galería PDP/catálogo. Usa --accent y clases globales desde globals.css; estilos locales del swiper en <style jsx>. */
import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import type { ProductImage as ProductImageType } from "@/types/catalog";
import { normalizeProductMediaUrl } from "@/lib/product-media";
import SoldOutBadge from "@/components/badges/SoldOutBadge";
import "swiper/css";
import "swiper/css/pagination";
import ImageViewerModal from "@/components/product/ImageViewerModal";

interface ProductGalleryProps {
  images: ProductImageType[];
  productName: string;
  soldOut?: boolean;
  variant?: "default" | "pdp";
}

export function ProductGallery({ images, productName, soldOut = false, variant = "default" }: ProductGalleryProps) {
  const slides = useMemo(() => {
    if (!images?.length) return [];

    return images
      .map((img) => {
        const url = img?.url ? normalizeProductMediaUrl(img.url) : "";
        const thumb = img?.thumb_url ?? img?.url ? normalizeProductMediaUrl(img.thumb_url ?? img.url) : "";
        return {
          ...img,
          url,
          // ensure we always have a usable thumb
          thumb_url: thumb || url,
        };
      })
      .filter((img) => Boolean(img.url));
  }, [images]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  const isPdp = variant === "pdp";

  const wrapperClass = isPdp
    ? "relative w-full pb-10"
    : "relative aspect-square w-full overflow-hidden rounded-2xl border border-zinc-900/8 bg-white/80 shadow-[0_12px_30px_rgba(24,24,27,0.06)]";

  const mediaFrameClass = isPdp
    ? "relative aspect-square w-full overflow-visible rounded-none border-0 bg-transparent shadow-none isolate pb-0"
    : "h-full w-full";

  const emptyClass = isPdp
    ? "aspect-square w-full overflow-hidden rounded-none bg-transparent border-0 shadow-none"
    : "aspect-square w-full overflow-hidden rounded-2xl border border-zinc-900/8 bg-white/80 shadow-[0_12px_30px_rgba(24,24,27,0.06)]";

  const imageClass = isPdp
    ? "object-contain cursor-zoom-in bg-transparent"
    : "object-contain cursor-zoom-in bg-transparent";

  if (slides.length === 0) {
    return (
      <div className={emptyClass}>
        <div className={`flex h-full items-center justify-center ${isPdp ? "text-zinc-500" : "text-zinc-400"}`}>
          <svg className="h-20 w-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <div className={mediaFrameClass} data-gallery-frame={isPdp ? "pdp" : "default"}>
        <SoldOutBadge show={soldOut === true} variant="detail" />

        <Swiper
          modules={[Pagination]}
          spaceBetween={0}
          slidesPerView={1}
          pagination={{ clickable: true }}
          onSwiper={(sw) => setActiveIndex(sw.activeIndex ?? 0)}
          onSlideChange={(sw: SwiperType) => setActiveIndex(sw.activeIndex ?? 0)}
          className={`k-gallery-swiper ${isPdp ? "k-gallery-swiper--pdp overflow-visible" : "h-full w-full"}`}
        >
          {slides.map((img, index) => (
            <SwiperSlide key={`${img.url}-${index}`}>
              <div className="relative w-full aspect-square bg-transparent">
                {(() => {
                  const baseSrc = (img.thumb_url ?? img.url) || null;
                  const src = baseSrc ? `${baseSrc}?v=${index}` : null;
                  if (!src) return null;

                  const alt = img.alt_text ?? productName ?? "Producto";

                  return (
                    <Image
                      key={src}
                      src={src}
                      alt={alt}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      priority={index === 0}
                      {...(index === 0 ? {} : { loading: "lazy" as const })}
                      className={imageClass}
                      onClick={() => openLightbox(index === activeIndex ? activeIndex : index)}
                    />
                  );
                })()}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      <ImageViewerModal
        open={lightboxOpen && slides.length > 0}
        onClose={closeLightbox}
        images={slides.map((img) => ({
          url: img.url,
          alt: img.alt_text ?? productName ?? "Producto",
        }))}
        index={lightboxIndex}
        setIndex={setLightboxIndex}
      />
      <style jsx global>{`
        .k-gallery-swiper,
        .k-gallery-swiper .swiper,
        .k-gallery-swiper .swiper-wrapper,
        .k-gallery-swiper .swiper-slide {
          background: transparent !important;
        }

        .k-gallery-swiper .swiper-pagination {
          bottom: 12px;
        }

        .k-gallery-swiper--pdp {
          height: 100%;
          width: 100%;
        }

        .k-gallery-swiper--pdp .swiper,
        .k-gallery-swiper--pdp .swiper-wrapper,
        .k-gallery-swiper--pdp .swiper-slide {
          height: 100%;
        }

        [data-gallery-frame="pdp"] .k-gallery-swiper--pdp .swiper-pagination {
          bottom: -34px;
          left: 0;
          right: 0;
          width: 100%;
        }

        [data-gallery-frame="pdp"] .k-gallery-swiper--pdp,
        [data-gallery-frame="pdp"] .k-gallery-swiper--pdp .swiper,
        [data-gallery-frame="pdp"] .k-gallery-swiper--pdp .swiper-wrapper,
        [data-gallery-frame="pdp"] .k-gallery-swiper--pdp .swiper-slide {
          overflow: visible !important;
        }

        .k-gallery-swiper .swiper-pagination-bullet {
          width: 5px;
          height: 5px;
          margin: 0 5px !important;
          background: rgba(39, 39, 42, 0.18);
          opacity: 0.9;
          transition: transform 180ms ease, background-color 180ms ease, opacity 180ms ease;
        }

        [data-gallery-frame="pdp"] .k-gallery-swiper--pdp .swiper-pagination-bullets {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .k-gallery-swiper .swiper-pagination-bullet-active {
          background: var(--accent);
          opacity: 1;
          transform: scale(1.2);
        }

        .k-gallery-swiper .swiper-pagination-bullet:hover {
          background: rgba(39, 39, 42, 0.30);
          opacity: 1;
        }

        [data-gallery-frame="pdp"] .k-gallery-swiper--pdp .swiper-pagination-bullet {
          margin-top: 0;
        }
      `}</style>
    </div>
  );
}
