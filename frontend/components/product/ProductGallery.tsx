"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import type { ProductImage as ProductImageType } from "@/types/catalog";
import SoldOutBadge from "@/components/badges/SoldOutBadge";
import "swiper/css";
import "swiper/css/pagination";

interface ProductGalleryProps {
  images: ProductImageType[];
  productName: string;
  soldOut?: boolean;
}

export function ProductGallery({ images, productName, soldOut }: ProductGalleryProps) {
  const slides = useMemo(() => {
    if (!images?.length) return [];
    return images.filter((img) => img.image);
  }, [images]);

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
        className="k-gallery-swiper h-full w-full"
      >
        {slides.map((img) => (
          <SwiperSlide key={img.id}>
            <div className="relative w-full aspect-square">
              {(() => {
                const src = img.image ? `${img.image}?v=${img.id}` : null;
                if (!src) return null;

                return (
                  <Image
                    key={src}
                    src={src}
                    alt={img.alt_text || productName}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                );
              })()}
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
      <style jsx global>{`
        .k-gallery-swiper .swiper-pagination {
          bottom: 10px;
        }

        .k-gallery-swiper .swiper-pagination-bullet {
          width: 6px;
          height: 6px;
          margin: 0 4px !important;
          background: rgba(255, 255, 255, 0.30);
          opacity: 1;
          transition: transform 180ms ease, background-color 180ms ease, opacity 180ms ease;
        }

        .k-gallery-swiper .swiper-pagination-bullet-active {
          background: var(--accent);
          transform: scale(1.15);
        }

        .k-gallery-swiper .swiper-pagination-bullet:hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}
