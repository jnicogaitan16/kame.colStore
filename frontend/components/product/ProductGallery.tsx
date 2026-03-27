"use client";

/** Galería PDP/catálogo. Usa --accent y clases globales desde globals.css; estilos locales del swiper en <style jsx>. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination } from "swiper/modules";
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

type TouchPointLike = {
  clientX: number;
  clientY: number;
};

type ZoomTransform = {
  scale: number;
  x: number;
  y: number;
};

const DEFAULT_ZOOM_STATE: ZoomTransform = {
  scale: 1,
  x: 0,
  y: 0,
};

export function ProductGallery({ images, productName, soldOut = false, variant = "default" }: ProductGalleryProps) {
  const slides = useMemo(() => {
    if (!images?.length) return [];

    const seen = new Set<string>();

    return images
      .map((img) => {
        const url = img?.url ? normalizeProductMediaUrl(img.url) : "";
        const thumb = img?.thumb_url ? normalizeProductMediaUrl(img.thumb_url) : "";

        return {
          ...img,
          url,
          thumb_url: thumb,
        };
      })
      .filter((img) => {
        if (!img.url) return false;
        if (seen.has(img.url)) return false;
        seen.add(img.url);
        return true;
      });
  }, [images]);

  const isPdp = variant === "pdp";

  const MIN_PDP_ZOOM = 1;
  const MAX_PDP_ZOOM = 3;
  const [pdpZoom, setPdpZoom] = useState<Record<number, ZoomTransform>>({});
  const gestureRef = useRef<{
    startX: number;
    startY: number;
    moved: boolean;
    pinchIndex: number | null;
    startDistance: number;
    startScale: number;
    panIndex: number | null;
    panStartX: number;
    panStartY: number;
    panOriginX: number;
    panOriginY: number;
    blockClickUntil: number;
  }>({
    startX: 0,
    startY: 0,
    moved: false,
    pinchIndex: null,
    startDistance: 0,
    startScale: 1,
    panIndex: null,
    panStartX: 0,
    panStartY: 0,
    panOriginX: 0,
    panOriginY: 0,
    blockClickUntil: 0,
  });
  const surfaceRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    setLightboxOpen(false);
    setLightboxIndex((current) => (slides.length === 0 ? 0 : Math.min(current, slides.length - 1)));
  }, [slides]);

  useEffect(() => {
    setPdpZoom({});
  }, [slides, variant]);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  const clamp = useCallback((value: number, min: number, max: number) => {
    return Math.min(Math.max(value, min), max);
  }, []);

  const getDistance = useCallback((touchA: TouchPointLike, touchB: TouchPointLike) => {
    const dx = touchB.clientX - touchA.clientX;
    const dy = touchB.clientY - touchA.clientY;
    return Math.hypot(dx, dy);
  }, []);

  const getZoomState = useCallback(
    (index: number) => {
      return pdpZoom[index] ?? DEFAULT_ZOOM_STATE;
    },
    [pdpZoom],
  );

  const clampZoomState = useCallback(
    (index: number, nextScale: number, nextX: number, nextY: number) => {
      const node = surfaceRefs.current[index];
      const width = node?.clientWidth ?? 0;
      const height = node?.clientHeight ?? 0;
      const scale = clamp(nextScale, MIN_PDP_ZOOM, MAX_PDP_ZOOM);

      if (!width || !height || scale <= 1) {
        return DEFAULT_ZOOM_STATE;
      }

      const maxX = Math.max(0, ((width * scale) - width) / 2);
      const maxY = Math.max(0, ((height * scale) - height) / 2);

      return {
        scale,
        x: clamp(nextX, -maxX, maxX),
        y: clamp(nextY, -maxY, maxY),
      };
    },
    [clamp],
  );

  const updateZoomState = useCallback(
    (index: number, nextScale: number, nextX: number, nextY: number) => {
      setPdpZoom((current) => ({
        ...current,
        [index]: clampZoomState(index, nextScale, nextX, nextY),
      }));
    },
    [clampZoomState],
  );

  const resetZoomState = useCallback((index: number) => {
    setPdpZoom((current) => ({
      ...current,
      [index]: DEFAULT_ZOOM_STATE,
    }));
  }, []);

  const handlePointerDown = useCallback((index: number, clientX: number, clientY: number) => {
    gestureRef.current.startX = clientX;
    gestureRef.current.startY = clientY;
    gestureRef.current.moved = false;

    const zoom = getZoomState(index);
    if (zoom.scale > 1) {
      gestureRef.current.panIndex = index;
      gestureRef.current.panStartX = clientX;
      gestureRef.current.panStartY = clientY;
      gestureRef.current.panOriginX = zoom.x;
      gestureRef.current.panOriginY = zoom.y;
    }
  }, [getZoomState]);

  const handlePointerMove = useCallback(
    (index: number, clientX: number, clientY: number) => {
      const deltaX = Math.abs(clientX - gestureRef.current.startX);
      const deltaY = Math.abs(clientY - gestureRef.current.startY);

      if (deltaX > 8 || deltaY > 8) {
        gestureRef.current.moved = true;
      }

      if (gestureRef.current.panIndex !== index) return;
      const zoom = getZoomState(index);
      if (zoom.scale <= 1) return;

      updateZoomState(
        index,
        zoom.scale,
        gestureRef.current.panOriginX + (clientX - gestureRef.current.panStartX),
        gestureRef.current.panOriginY + (clientY - gestureRef.current.panStartY),
      );
    },
    [getZoomState, updateZoomState],
  );

  const handlePointerRelease = useCallback((index: number) => {
    if (gestureRef.current.panIndex === index) {
      gestureRef.current.panIndex = null;
    }

    const zoom = getZoomState(index).scale;
    if (zoom <= 1.01) {
      resetZoomState(index);
    }
  }, [getZoomState, resetZoomState]);

  const handleTouchStart = useCallback(
    (index: number, e: React.TouchEvent<HTMLButtonElement>) => {
      if (!isPdp) return;

      if (e.touches.length === 2) {
        gestureRef.current.blockClickUntil = Date.now() + 320;
        gestureRef.current.pinchIndex = index;
        gestureRef.current.panIndex = null;
        gestureRef.current.moved = true;
        gestureRef.current.startDistance = getDistance(e.touches[0], e.touches[1]);
        gestureRef.current.startScale = getZoomState(index).scale;
        return;
      }

      if (e.touches.length === 1) {
        handlePointerDown(index, e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [getDistance, getZoomState, handlePointerDown, isPdp],
  );

  const handleTouchMove = useCallback(
    (index: number, e: React.TouchEvent<HTMLButtonElement>) => {
      if (!isPdp) return;

      if (e.touches.length === 2 && gestureRef.current.pinchIndex === index) {
        e.preventDefault();
        const nextDistance = getDistance(e.touches[0], e.touches[1]);
        const nextScale = gestureRef.current.startScale * (nextDistance / gestureRef.current.startDistance);
        const current = getZoomState(index);
        updateZoomState(index, nextScale, current.x, current.y);
        return;
      }

      if (e.touches.length === 1) {
        const zoom = getZoomState(index);
        if (zoom.scale > 1) {
          e.preventDefault();
        }
        handlePointerMove(index, e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [getDistance, getZoomState, handlePointerMove, isPdp, updateZoomState],
  );

  const handleTouchEnd = useCallback(
    (index: number, e: React.TouchEvent<HTMLButtonElement>) => {
      if (!isPdp) return;

      if (e.touches.length < 2) {
        gestureRef.current.pinchIndex = null;
      }

      if (e.touches.length === 0) {
        handlePointerRelease(index);
      }
    },
    [handlePointerRelease, isPdp],
  );

  const handleImageInteraction = useCallback(
    (index: number) => {
      const now = Date.now();
      if (now < gestureRef.current.blockClickUntil) return;
      if (gestureRef.current.moved) {
        gestureRef.current.moved = false;
        return;
      }

      openLightbox(index);
    },
    [openLightbox],
  );

  const wrapperClass = isPdp
    ? "relative w-full pb-10"
    : "relative aspect-square w-full overflow-hidden bg-transparent";

  const mediaFrameClass = isPdp
    ? "relative aspect-square w-full overflow-visible rounded-none border-0 bg-transparent shadow-none isolate pb-0"
    : "relative aspect-square h-full w-full overflow-hidden bg-transparent";

  const emptyClass = isPdp
    ? "aspect-square w-full overflow-hidden rounded-none bg-transparent border-0 shadow-none"
    : "aspect-square w-full overflow-hidden bg-transparent";

  const imageClass = isPdp
    ? "object-contain cursor-zoom-in bg-transparent transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
    : "object-contain object-center cursor-zoom-in bg-transparent";

  const allowSwiperTouch = !isPdp || Object.values(pdpZoom).every((zoom) => (zoom?.scale ?? 1) <= 1.01);

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
        <div
          className="pointer-events-none absolute inset-0 z-[3]"
          aria-hidden="true"
          data-gallery-soldout-overlay={soldOut === true ? "true" : "false"}
        >
          <div className="absolute top-2 left-2 md:top-3 md:left-3">
            <div className="k-gallery-soldout-badge-wrap k-gallery-soldout-badge-wrap--left">
              <SoldOutBadge show={soldOut === true} variant="detail" />
            </div>
          </div>
        </div>

        <Swiper
          modules={[Pagination]}
          spaceBetween={0}
          slidesPerView={1}
          pagination={{ clickable: true }}
          allowTouchMove={allowSwiperTouch}
          className={`k-gallery-swiper relative z-[1] ${isPdp ? "k-gallery-swiper--pdp overflow-visible" : "h-full w-full"}`}
        >
          {slides.map((img, index) => {
            const src = img.url || img.thumb_url || null;
            if (!src) return null;

            const alt = img.alt_text ?? productName ?? "Producto";
            const zoom = getZoomState(index);
            const imageSizes = isPdp ? "100vw" : "(max-width: 768px) 100vw, 50vw";
            const unoptimizedImage = isPdp;

            return (
              <SwiperSlide key={`${img.url}-${index}`}>
                <div className="relative flex w-full aspect-square items-center justify-center bg-transparent">
                  <button
                    ref={(node) => {
                      surfaceRefs.current[index] = node;
                    }}
                    type="button"
                    className={`group relative flex h-full w-full items-center justify-center overflow-hidden bg-transparent text-left ${isPdp ? "k-gallery-pdp-surface gallery-zoomable-surface" : ""}`}
                    aria-label={`Ampliar imagen ${index + 1} de ${slides.length}`}
                    data-pressed={isPdp && zoom.scale > 1 ? "true" : "false"}
                    onPointerDown={(e) => handlePointerDown(index, e.clientX, e.clientY)}
                    onPointerMove={(e) => handlePointerMove(index, e.clientX, e.clientY)}
                    onPointerUp={() => handlePointerRelease(index)}
                    onPointerCancel={() => handlePointerRelease(index)}
                    onPointerLeave={() => handlePointerRelease(index)}
                    onTouchStart={(e) => handleTouchStart(index, e)}
                    onTouchMove={(e) => handleTouchMove(index, e)}
                    onTouchEnd={(e) => handleTouchEnd(index, e)}
                    onTouchCancel={(e) => handleTouchEnd(index, e)}
                    onClick={() => handleImageInteraction(index)}
                  >
                    <span
                      className={`absolute inset-0 ${isPdp ? "gallery-zoomable-press" : ""}`}
                      style={
                        isPdp
                          ? {
                              transform: `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.scale})`,
                              transformOrigin: "center center",
                              transition:
                                gestureRef.current.panIndex === index || gestureRef.current.pinchIndex === index
                                  ? "none"
                                  : "transform 220ms cubic-bezier(0.22,1,0.36,1)",
                            }
                          : undefined
                      }
                    >
                      <Image
                        key={src}
                        src={src}
                        alt={alt}
                        fill
                        sizes={imageSizes}
                        quality={95}
                        unoptimized={unoptimizedImage}
                        priority={index === 0}
                        {...(index === 0 ? {} : { loading: "lazy" as const })}
                        className={imageClass}
                      />
                    </span>
                  </button>
                </div>
              </SwiperSlide>
            );
          })}
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

        .k-gallery-soldout-badge-wrap {
          display: inline-flex;
          align-items: flex-start;
          justify-content: flex-start;
          width: clamp(96px, 24vw, 148px);
          min-height: 40px;
          opacity: 1;
          transform: translateZ(0);
          will-change: opacity, transform;
        }

        .k-gallery-soldout-badge-wrap--left {
          transform-origin: top left;
        }

        [data-gallery-soldout-overlay="false"] .k-gallery-soldout-badge-wrap {
          opacity: 0;
        }

        .k-gallery-soldout-badge-wrap :global(img),
        .k-gallery-soldout-badge-wrap :global(svg),
        .k-gallery-soldout-badge-wrap :global(canvas) {
          display: block;
          width: 100%;
          height: auto;
          object-fit: contain;
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

        [data-gallery-frame="pdp"] .k-gallery-soldout-badge-wrap {
          width: clamp(92px, 22vw, 140px);
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
        .k-gallery-pdp-surface {
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }

        .k-gallery-pdp-surface:focus-visible {
          outline: none;
          box-shadow: inset 0 0 0 1px rgba(24, 24, 27, 0.12);
        }
      `}</style>
    </div>
  );
}
