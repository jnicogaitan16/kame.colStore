"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
import type { ProductImage as ProductImageType } from "@/types/catalog";
import "swiper/css";
import "swiper/css/pagination";

interface ProductGalleryProps {
  images: ProductImageType[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const slides = useMemo(() => {
    if (!images?.length) return [];
    return images.filter((img) => img.image);
  }, [images]);

  if (slides.length === 0) {
    return (
      <div className="aspect-square w-full overflow-hidden rounded-xl bg-slate-100">
        <div className="flex h-full items-center justify-center text-slate-400">
          <svg className="h-24 w-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <Swiper
      modules={[Pagination]}
      spaceBetween={0}
      slidesPerView={1}
      pagination={{ clickable: true }}
      className="aspect-square w-full overflow-hidden rounded-xl bg-slate-100"
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
  );
}
