"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import { motion, useMotionValue, animate } from "framer-motion";
import { Zoom } from "swiper/modules";

import "swiper/css";
import "swiper/css/zoom";

type ImageViewerModalProps = {
  open: boolean;
  onClose: () => void;
  images: Array<{ url: string; alt?: string }>;
  /** current index controlled by parent */
  index: number;
  setIndex: (i: number) => void;
  /** optional future-proof (not required by current integration) */
  initialIndex?: number;
};

export default function ImageViewerModal({
  open,
  onClose,
  images,
  index,
  setIndex,
}: ImageViewerModalProps) {
  const total = images?.length || 0;

  // keep index in range even if images array changes
  const safeIndex = useMemo(() => {
    if (!total) return 0;
    return Math.min(Math.max(index, 0), total - 1);
  }, [index, total]);

  const swiperRef = useRef<SwiperType | null>(null);
  const [active, setActive] = useState<number>(safeIndex);

  // Zoom / gestures
  const [isZoomed, setIsZoomed] = useState(false);
  const lastTapRef = useRef<number>(0);
  const DOUBLE_TAP_MS = 260;

  // Swipe-down to close (only when not zoomed)
  const y = useMotionValue(0);

  const resetY = () => {
    animate(y, 0, { type: "spring", stiffness: 420, damping: 38 });
  };

  const toggleZoom = () => {
    const s: any = swiperRef.current as any;
    if (!s || !s.zoom) return;
    const scale = Number(s.zoom.scale ?? 1);
    if (scale > 1) s.zoom.out();
    else s.zoom.in();
  };

  const onTouchEndDoubleTap: React.TouchEventHandler<HTMLDivElement> = () => {
    const now = Date.now();
    const delta = now - lastTapRef.current;
    lastTapRef.current = now;
    if (delta > 0 && delta < DOUBLE_TAP_MS) toggleZoom();
  };

  // Keep local active index aligned with controlled index
  useEffect(() => {
    if (!open) return;
    setActive(safeIndex);
    setIsZoomed(false);
    resetY();
    // Ensure any previous zoom is cleared
    (swiperRef.current as any)?.zoom?.out?.();
  }, [open, safeIndex]);

  // If parent changes index, sync Swiper
  useEffect(() => {
    if (!open) return;
    const s = swiperRef.current;
    if (!s) return;
    if (s.activeIndex !== safeIndex) s.slideTo(safeIndex, 0);
  }, [open, safeIndex]);

  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !total) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black">
      {/* Close button (minimal, no header bar) */}
      <div className="absolute right-4 z-[210] pt-[calc(env(safe-area-inset-top)+12px)]">
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-white/70 hover:text-white/90 transition-colors"
          aria-label="Cerrar visor de imagen"
        >
          <span aria-hidden="true" className="text-xl font-light leading-none">×</span>
        </button>
      </div>

      {/* Swipe gallery */}
      <motion.div
        className="absolute inset-0 z-[205] pt-[calc(env(safe-area-inset-top)+56px)] pb-[calc(env(safe-area-inset-bottom)+24px)]"
        style={{ y }}
        drag={isZoomed ? false : "y"}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.15}
        onDragEnd={(_, info) => {
          // Close if pulled enough or fast enough
          if (info.offset.y > 120 || info.velocity.y > 800) {
            onClose();
            return;
          }
          resetY();
        }}
      >
        <Swiper
          key={`viewer-${total}`}
          initialSlide={safeIndex}
          slidesPerView={1}
          spaceBetween={0}
          modules={[Zoom]}
          zoom={{
            maxRatio: 3,
            minRatio: 1,
          }}
          allowTouchMove={!isZoomed}
          onSwiper={(s) => {
            swiperRef.current = s;

            // Track zoom state so we can lock slide swipe + disable swipe-down-to-close
            (s as any).on?.("zoomChange", (_swiper: any, scale: number) => {
              setIsZoomed(Number(scale) > 1);
            });
          }}
          onSlideChange={(s) => {
            // When changing slide, always reset zoom + gesture state
            (s as any).zoom?.out?.();
            setIsZoomed(false);
            resetY();

            const i = s.activeIndex;
            setActive(i);
            setIndex(i);
          }}
          style={{ height: "100%" }}
        >
          {images.map((img, idx) => (
            <SwiperSlide key={`${img.url}-${idx}`}>
              <div
                className="flex h-full w-full items-center justify-center px-3"
                onDoubleClick={toggleZoom}
                onTouchEnd={onTouchEndDoubleTap}
              >
                <div className="swiper-zoom-container flex h-full w-full items-center justify-center">
                  <img
                    src={img.url}
                    alt={img.alt || "Imagen producto"}
                    className="max-h-full max-w-full select-none object-contain"
                    draggable={false}
                  />
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </motion.div>

      {/* Dots */}
      {total > 1 ? (
        <div className="absolute bottom-5 left-0 right-0 z-[210] flex justify-center gap-2">
          {images.map((_, idx) => {
            const isActive = idx === active;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => swiperRef.current?.slideTo(idx)}
                className={
                  isActive
                    ? "h-2 w-2 rounded-full bg-white/85"
                    : "h-2 w-2 rounded-full bg-white/20"
                }
                aria-label={`Ir a imagen ${idx + 1}`}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
