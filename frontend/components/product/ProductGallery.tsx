"use client";

/** Galería PDP/catálogo. Usa --accent y clases globales desde globals.css; estilos locales del swiper en <style jsx>. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const DEFAULT_ZOOM: ZoomTransform = { scale: 1, x: 0, y: 0 };
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function dist(a: TouchPointLike, b: TouchPointLike) {
  return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
}

export function ProductGallery({ images, productName, soldOut = false, variant = "default" }: ProductGalleryProps) {
  const slides = useMemo(() => {
    if (!images?.length) return [];
    const seen = new Set<string>();
    return images
      .map((img) => ({
        ...img,
        url: img?.url ? normalizeProductMediaUrl(img.url) : "",
        thumb_url: img?.thumb_url ? normalizeProductMediaUrl(img.thumb_url) : "",
      }))
      .filter((img) => {
        if (!img.url) return false;
        if (seen.has(img.url)) return false;
        seen.add(img.url);
        return true;
      });
  }, [images]);

  const isPdp = variant === "pdp";

  // ── Refs for zero-re-render zoom during gestures ──
  const zoomRef = useRef<ZoomTransform>(DEFAULT_ZOOM);
  const zoomIndexRef = useRef<number | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const overlayImgRef = useRef<HTMLDivElement>(null);
  const sourceSpanRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const rafRef = useRef<number>(0);

  const gestureRef = useRef({
    startX: 0,
    startY: 0,
    moved: false,
    pinchIndex: null as number | null,
    startDistance: 0,
    startScale: 1,
    blockClickUntil: 0,
  });

  const surfaceRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [overlayVisible, setOverlayVisible] = useState(false);

  useEffect(() => {
    setLightboxOpen(false);
    setLightboxIndex((c) => (slides.length === 0 ? 0 : Math.min(c, slides.length - 1)));
  }, [slides]);

  // Block body scroll during fullscreen zoom
  useEffect(() => {
    if (!overlayVisible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [overlayVisible]);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  // ── Direct DOM updates (no React re-render) ──
  const applyZoomToDOM = useCallback(() => {
    const z = zoomRef.current;
    const overlay = overlayRef.current;
    const imgStage = overlayImgRef.current;
    const idx = zoomIndexRef.current;

    if (overlay) {
      const opacity = Math.min(0.85, (z.scale - 1) * 0.7);
      overlay.style.background = `rgba(0,0,0,${opacity})`;
    }

    if (imgStage) {
      imgStage.style.transform = `translate3d(${z.x}px, ${z.y}px, 0) scale(${z.scale})`;
    }

    // Source image hidden/shown via touchStart/touchEnd directly
  }, []);

  const scheduleApply = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(applyZoomToDOM);
  }, [applyZoomToDOM]);

  // ── Gesture handlers ──
  const handleTouchStart = useCallback(
    (index: number, e: React.TouchEvent<HTMLButtonElement>) => {
      if (!isPdp) return;

      if (e.touches.length === 2) {
        gestureRef.current.blockClickUntil = Date.now() + 320;
        gestureRef.current.pinchIndex = index;
        gestureRef.current.moved = true;
        gestureRef.current.startDistance = dist(e.touches[0], e.touches[1]);
        gestureRef.current.startScale = zoomRef.current.scale;
        zoomIndexRef.current = index;

        // Hide source image immediately
        const srcSpan = sourceSpanRefs.current[index];
        if (srcSpan) {
          srcSpan.style.transition = "none";
          srcSpan.style.opacity = "0";
        }

        // Show overlay immediately
        setOverlayVisible(true);

        // Disable transitions during gesture
        if (overlayRef.current) overlayRef.current.style.transition = "none";
        if (overlayImgRef.current) overlayImgRef.current.style.transition = "none";
        return;
      }

      if (e.touches.length === 1) {
        gestureRef.current.startX = e.touches[0].clientX;
        gestureRef.current.startY = e.touches[0].clientY;
        gestureRef.current.moved = false;
      }
    },
    [isPdp],
  );

  const handleTouchMove = useCallback(
    (index: number, e: React.TouchEvent<HTMLButtonElement>) => {
      if (!isPdp) return;

      if (e.touches.length === 2 && gestureRef.current.pinchIndex === index) {
        e.preventDefault();
        const nextDist = dist(e.touches[0], e.touches[1]);
        const nextScale = clamp(
          gestureRef.current.startScale * (nextDist / gestureRef.current.startDistance),
          MIN_ZOOM,
          MAX_ZOOM,
        );

        zoomRef.current = {
          scale: nextScale,
          x: zoomRef.current.x,
          y: zoomRef.current.y,
        };
        scheduleApply();
        return;
      }

      if (e.touches.length === 1) {
        const dx = Math.abs(e.touches[0].clientX - gestureRef.current.startX);
        const dy = Math.abs(e.touches[0].clientY - gestureRef.current.startY);
        if (dx > 8 || dy > 8) gestureRef.current.moved = true;
      }
    },
    [isPdp, scheduleApply],
  );

  const handleTouchEnd = useCallback(
    (index: number, e: React.TouchEvent<HTMLButtonElement>) => {
      if (!isPdp) return;

      if (e.touches.length < 2 && gestureRef.current.pinchIndex === index) {
        gestureRef.current.pinchIndex = null;
        zoomRef.current = DEFAULT_ZOOM;

        const overlay = overlayRef.current;
        const imgStage = overlayImgRef.current;
        const srcSpan = sourceSpanRefs.current[index];

        // Animate overlay image back to scale(1)
        if (imgStage) {
          imgStage.style.transition = "transform 280ms cubic-bezier(0.22,1,0.36,1)";
          imgStage.style.transform = "translate3d(0,0,0) scale(1)";

          // When animation ends: show source, remove overlay
          const onDone = () => {
            imgStage.removeEventListener("transitionend", onDone);
            if (srcSpan) {
              srcSpan.style.transition = "none";
              srcSpan.style.opacity = "1";
            }
            if (overlay) {
              overlay.style.transition = "none";
              overlay.style.background = "rgba(0,0,0,0)";
            }
            zoomIndexRef.current = null;
            setOverlayVisible(false);
          };
          imgStage.addEventListener("transitionend", onDone, { once: true });

          // Safety fallback in case transitionend doesn't fire
          setTimeout(onDone, 320);
        }

        // Fade overlay background during animation
        if (overlay) {
          overlay.style.transition = "background 280ms ease-out";
          overlay.style.background = "rgba(0,0,0,0)";
        }
      }
    },
    [isPdp],
  );

  const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window;

  const handleImageInteraction = useCallback(
    (index: number) => {
      const now = Date.now();
      if (now < gestureRef.current.blockClickUntil) return;
      if (gestureRef.current.moved) {
        gestureRef.current.moved = false;
        return;
      }
      // On touch devices the pinch-zoom replaces the lightbox
      if (isPdp && isTouchDevice) return;
      openLightbox(index);
    },
    [openLightbox, isPdp, isTouchDevice],
  );

  // ── Layout ──
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

  const overlaySlide = zoomIndexRef.current !== null ? slides[zoomIndexRef.current] : null;

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
          allowTouchMove={!overlayVisible}
          className={`k-gallery-swiper relative z-[1] ${isPdp ? "k-gallery-swiper--pdp overflow-visible" : "h-full w-full"}`}
        >
          {slides.map((img, index) => {
            const src = img.url || img.thumb_url || null;
            if (!src) return null;

            const alt = img.alt_text ?? productName ?? "Producto";
            const imageSizes = isPdp ? "100vw" : "(max-width: 768px) 100vw, 50vw";
            const unoptimizedImage = isPdp;

            return (
              <SwiperSlide key={`${img.url}-${index}`}>
                <div className="relative flex w-full aspect-square items-center justify-center bg-transparent">
                  <button
                    ref={(node) => { surfaceRefs.current[index] = node; }}
                    type="button"
                    className={`group relative flex h-full w-full items-center justify-center overflow-hidden bg-transparent text-left ${isPdp ? "k-gallery-pdp-surface gallery-zoomable-surface" : ""}`}
                    aria-label={`Ampliar imagen ${index + 1} de ${slides.length}`}
                    onTouchStart={(e) => handleTouchStart(index, e)}
                    onTouchMove={(e) => handleTouchMove(index, e)}
                    onTouchEnd={(e) => handleTouchEnd(index, e)}
                    onTouchCancel={(e) => handleTouchEnd(index, e)}
                    onClick={() => handleImageInteraction(index)}
                  >
                    <span
                      ref={(node) => { sourceSpanRefs.current[index] = node; }}
                      className={`absolute inset-0 ${isPdp ? "gallery-zoomable-press" : ""}`}
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

      {/* Fullscreen zoom overlay (Instagram-style) — DOM-driven, no re-renders */}
      {overlayVisible && typeof document !== "undefined" && overlaySlide?.url && createPortal(
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[200]"
          style={{
            pointerEvents: "none",
            background: "rgba(0,0,0,0)",
            willChange: "background",
          }}
        >
          <div
            ref={overlayImgRef}
            className="absolute inset-0 flex items-center justify-center"
            style={{
              pointerEvents: "none",
              transform: "translate3d(0,0,0) scale(1)",
              transformOrigin: "center center",
              willChange: "transform",
            }}
          >
            <img
              src={overlaySlide.url}
              alt={overlaySlide.alt_text ?? productName ?? "Producto"}
              className="max-w-full max-h-full object-contain"
              draggable={false}
            />
          </div>
        </div>,
        document.body,
      )}
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
