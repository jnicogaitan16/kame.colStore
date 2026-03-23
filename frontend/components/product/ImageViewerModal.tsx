"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import { motion, useMotionValue, animate } from "framer-motion";

import "swiper/css";

import { normalizeProductMediaUrl } from "@/lib/product-media";

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

type ZoomState = {
  scale: number;
  x: number;
  y: number;
};

type TouchLike = {
  clientX: number;
  clientY: number;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.2;
const DOUBLE_TAP_MS = 260;
const TAP_MOVE_THRESHOLD = 10;

function sanitizeViewerImages(images: Array<{ url: string; alt?: string }>) {
  const seen = new Set<string>();

  return images.reduce<Array<{ url: string; alt?: string }>>((acc, img) => {
    const url = normalizeProductMediaUrl(String(img?.url ?? "").trim());
    if (!url) return acc;
    if (seen.has(url)) return acc;

    seen.add(url);
    acc.push({
      url,
      alt: img?.alt,
    });

    return acc;
  }, []);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getDistance(t1: TouchLike, t2: TouchLike) {
  const dx = t2.clientX - t1.clientX;
  const dy = t2.clientY - t1.clientY;
  return Math.hypot(dx, dy);
}

function getMidpoint(t1: TouchLike, t2: TouchLike) {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}

function getBounds(containerWidth: number, containerHeight: number, scale: number) {
  if (scale <= 1 || !containerWidth || !containerHeight) {
    return {
      maxX: 0,
      maxY: 0,
    };
  }

  // ensure no white borders by slightly overextending bounds
  const extra = 0.5; // prevents visible edges

  return {
    maxX: Math.max(0, ((containerWidth * scale) - containerWidth) / 2 + extra),
    maxY: Math.max(0, ((containerHeight * scale) - containerHeight) / 2 + extra),
  };
}

function clampZoomState(state: ZoomState, containerWidth: number, containerHeight: number): ZoomState {
  const scale = clamp(state.scale, MIN_SCALE, MAX_SCALE);
  const { maxX, maxY } = getBounds(containerWidth, containerHeight, scale);

  return {
    scale,
    x: clamp(state.x, -maxX, maxX),
    y: clamp(state.y, -maxY, maxY),
  };
}

function zoomAroundPoint(
  nextScale: number,
  focalX: number,
  focalY: number,
  current: ZoomState,
  containerWidth: number,
  containerHeight: number,
): ZoomState {
  const clampedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);

  if (!containerWidth || !containerHeight) {
    return {
      scale: clampedScale,
      x: 0,
      y: 0,
    };
  }

  if (clampedScale <= 1) {
    return {
      scale: 1,
      x: 0,
      y: 0,
    };
  }

  const offsetX = focalX - containerWidth / 2;
  const offsetY = focalY - containerHeight / 2;
  const scaleRatio = clampedScale / current.scale;

  const nextX = (current.x - offsetX) * scaleRatio + offsetX;
  const nextY = (current.y - offsetY) * scaleRatio + offsetY;

  return clampZoomState(
    {
      scale: clampedScale,
      x: nextX,
      y: nextY,
    },
    containerWidth,
    containerHeight,
  );
}

function ZoomableViewerImage({
  src,
  alt,
  active,
  onZoomChange,
  onPinchChange,
}: {
  src: string;
  alt: string;
  active: boolean;
  onZoomChange: (zoomed: boolean) => void;
  onPinchChange: (pinching: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastTapRef = useRef<number>(0);
  const tapRef = useRef<{
    startX: number;
    startY: number;
    moved: boolean;
  }>({
    startX: 0,
    startY: 0,
    moved: false,
  });
  const zoomStateRef = useRef<ZoomState>({ scale: 1, x: 0, y: 0 });
  const touchEventStampRef = useRef<{
    start: number;
    move: number;
    end: number;
  }>({
    start: -1,
    move: -1,
    end: -1,
  });

  const pinchRef = useRef<{
    startDistance: number;
    startScale: number;
    focalX: number;
    focalY: number;
  } | null>(null);

  const panRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [zoomState, setZoomState] = useState<ZoomState>({ scale: 1, x: 0, y: 0 });
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [isGestureActive, setIsGestureActive] = useState(false);

  const commitZoomState = useCallback(
    (next: ZoomState) => {
      zoomStateRef.current = next;
      setZoomState(next);
      onZoomChange(next.scale > 1.01);
    },
    [onZoomChange],
  );

  const getContainerSize = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    return {
      width: rect?.width ?? 0,
      height: rect?.height ?? 0,
      left: rect?.left ?? 0,
      top: rect?.top ?? 0,
    };
  }, []);

  const resetZoom = useCallback(() => {
    pinchRef.current = null;
    panRef.current = null;
    tapRef.current.moved = false;
    lastTapRef.current = 0;
    touchEventStampRef.current.start = -1;
    touchEventStampRef.current.move = -1;
    touchEventStampRef.current.end = -1;
    setIsPointerDown(false);
    onPinchChange(false);
    setIsGestureActive(false);
    commitZoomState({ scale: 1, x: 0, y: 0 });
  }, [commitZoomState, onPinchChange]);

  useEffect(() => {
    if (!active) {
      resetZoom();
    }
  }, [active, resetZoom]);

  useEffect(() => {
    resetZoom();
  }, [src, resetZoom]);

  const handleDoubleTap = useCallback(
    (clientX: number, clientY: number) => {
      const { width, height, left, top } = getContainerSize();
      const current = zoomStateRef.current;

      if (current.scale > 1.01) {
        resetZoom();
        return;
      }

      const focalX = clientX - left;
      const focalY = clientY - top;

      const next = zoomAroundPoint(
        DOUBLE_TAP_SCALE,
        focalX || width / 2,
        focalY || height / 2,
        current,
        width,
        height,
      );

      commitZoomState(next);
    },
    [commitZoomState, getContainerSize, resetZoom],
  );

  const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (touchEventStampRef.current.start === e.timeStamp) {
      return;
    }
    touchEventStampRef.current.start = e.timeStamp;

    if (e.touches.length === 2) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const midpoint = getMidpoint(t1, t2);
      const { left, top } = getContainerSize();

      pinchRef.current = {
        startDistance: getDistance(t1, t2),
        startScale: zoomStateRef.current.scale,
        focalX: midpoint.x - left,
        focalY: midpoint.y - top,
      };

      tapRef.current.moved = true;
      panRef.current = null;
      onPinchChange(true);
      setIsGestureActive(true);
      onZoomChange(true);
      return;
    }

    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    tapRef.current.startX = touch.clientX;
    tapRef.current.startY = touch.clientY;
    tapRef.current.moved = false;

    if (zoomStateRef.current.scale > 1.01) {
      panRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        originX: zoomStateRef.current.x,
        originY: zoomStateRef.current.y,
      };
      setIsGestureActive(true);
    }
  };

  const handleTouchMove: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (touchEventStampRef.current.move === e.timeStamp) {
      return;
    }
    touchEventStampRef.current.move = e.timeStamp;

    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      e.stopPropagation();

      const [t1, t2] = [e.touches[0], e.touches[1]];
      const distance = getDistance(t1, t2);
      const midpoint = getMidpoint(t1, t2);

      const { width, height, left, top } = getContainerSize();

      const nextScale = pinchRef.current.startScale * (distance / pinchRef.current.startDistance);

      const focalX = midpoint.x - left;
      const focalY = midpoint.y - top;

      const next = zoomAroundPoint(
        nextScale,
        focalX,
        focalY,
        zoomStateRef.current,
        width,
        height,
      );

      commitZoomState(next);
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const moveX = Math.abs(touch.clientX - tapRef.current.startX);
      const moveY = Math.abs(touch.clientY - tapRef.current.startY);

      if (moveX > TAP_MOVE_THRESHOLD || moveY > TAP_MOVE_THRESHOLD) {
        tapRef.current.moved = true;
      }
    }

    if (e.touches.length !== 1 || !panRef.current || zoomStateRef.current.scale <= 1.01) {
      return;
    }

    e.preventDefault();

    const touch = e.touches[0];
    const { width, height } = getContainerSize();

    const next = clampZoomState(
      {
        scale: zoomStateRef.current.scale,
        x: panRef.current.originX + (touch.clientX - panRef.current.startX),
        y: panRef.current.originY + (touch.clientY - panRef.current.startY),
      },
      width,
      height,
    );

    commitZoomState(next);
  };

  const handleTouchEnd: React.TouchEventHandler<HTMLDivElement> = (e) => {
    if (touchEventStampRef.current.end === e.timeStamp) {
      return;
    }
    touchEventStampRef.current.end = e.timeStamp;

    if (e.touches.length < 2) {
      pinchRef.current = null;
      onPinchChange(false);
    }

    if (e.touches.length === 0) {
      const now = Date.now();
      const shouldHandleDoubleTap = !tapRef.current.moved && zoomStateRef.current.scale <= 1.01;

      panRef.current = null;
      setIsGestureActive(false);

      const { width, height } = getContainerSize();
      const clamped = clampZoomState(zoomStateRef.current, width, height);

      if (clamped.scale <= 1.01) {
        commitZoomState({ scale: 1, x: 0, y: 0 });
      } else {
        commitZoomState(clamped);
      }

      if (shouldHandleDoubleTap) {
        const delta = now - lastTapRef.current;
        if (delta > 0 && delta < DOUBLE_TAP_MS) {
          const clientX = tapRef.current.startX;
          const clientY = tapRef.current.startY;
          lastTapRef.current = 0;
          e.preventDefault();
          e.stopPropagation();
          handleDoubleTap(clientX, clientY);
          tapRef.current.moved = false;
          return;
        }

        lastTapRef.current = now;
      } else {
        lastTapRef.current = 0;
      }

      tapRef.current.moved = false;
    }
  };

  const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (e.pointerType !== "mouse") return;
    if (zoomStateRef.current.scale <= 1.01) return;

    setIsPointerDown(true);
    setIsGestureActive(true);

    panRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: zoomStateRef.current.x,
      originY: zoomStateRef.current.y,
    };
  };

  const handlePointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (e.pointerType !== "mouse") return;
    if (!isPointerDown || !panRef.current || zoomStateRef.current.scale <= 1.01) return;

    const { width, height } = getContainerSize();

    const next = clampZoomState(
      {
        scale: zoomStateRef.current.scale,
        x: panRef.current.originX + (e.clientX - panRef.current.startX),
        y: panRef.current.originY + (e.clientY - panRef.current.startY),
      },
      width,
      height,
    );

    commitZoomState(next);
  };

  const handlePointerUp = useCallback(() => {
    if (isPointerDown) {
      setIsPointerDown(false);
    }
    setIsGestureActive(false);
    panRef.current = null;
  }, [isPointerDown]);

  return (
    <div
      ref={containerRef}
      className="viewer-zoom-shell"
      data-zoomed={zoomState.scale > 1.01 ? "true" : "false"}
      onTouchStartCapture={handleTouchStart}
      onTouchMoveCapture={handleTouchMove}
      onTouchEndCapture={handleTouchEnd}
      onTouchCancelCapture={handleTouchEnd}
      onDoubleClick={(e) => handleDoubleTap(e.clientX, e.clientY)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        touchAction: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <div
        className="viewer-zoom-stage"
        style={{
          transform: `translate3d(${zoomState.x}px, ${zoomState.y}px, 0) scale(${zoomState.scale})`,
          transition: isGestureActive ? "none" : "transform 240ms cubic-bezier(0.22, 1, 0.36, 1)",
          cursor: zoomState.scale > 1.01 ? (isPointerDown ? "grabbing" : "grab") : "zoom-in",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="viewer-zoom-image"
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            userSelect: "none",
          }}
        />
      </div>
    </div>
  );
}

export default function ImageViewerModal({
  open,
  onClose,
  images,
  index,
  setIndex,
}: ImageViewerModalProps) {
  const cleanImages = useMemo(() => sanitizeViewerImages(images || []), [images]);
  const total = cleanImages.length;
  const [mounted, setMounted] = useState(false);

  // keep index in range even if images array changes
  const safeIndex = useMemo(() => {
    if (!total) return 0;
    return Math.min(Math.max(index, 0), total - 1);
  }, [index, total]);

  const swiperRef = useRef<SwiperType | null>(null);
  const [active, setActive] = useState<number>(safeIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isPinching, setIsPinching] = useState(false);

  // Swipe-down to close (only when not zoomed)
  const y = useMotionValue(0);

  const resetY = useCallback(() => {
    animate(y, 0, { type: "spring", stiffness: 420, damping: 38 });
  }, [y]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Keep local active index aligned with controlled index
  useEffect(() => {
    if (!open) return;
    setActive(safeIndex);
    setIsZoomed(false);
    setIsPinching(false);
    resetY();
  }, [open, resetY, safeIndex]);

  // If parent changes index, sync Swiper
  useEffect(() => {
    if (!open) return;
    const s = swiperRef.current;
    if (!s) return;
    if (s.activeIndex !== safeIndex) s.slideTo(safeIndex, 0);
  }, [open, safeIndex]);

  useEffect(() => {
    if (!open || !mounted) return;

    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehavior;

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      html.style.overflow = prevHtmlOverflow;
      html.style.overscrollBehavior = prevHtmlOverscroll;
      body.style.overflow = prevBodyOverflow;
      body.style.overscrollBehavior = prevBodyOverscroll;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, mounted]);

  if (!open || !total || !mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[400] isolate bg-white"
      role="dialog"
      aria-modal="true"
      aria-label="Visor ampliado de producto"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-white" aria-hidden="true" />

      <div className="absolute right-4 top-0 z-[420] pt-[calc(env(safe-area-inset-top)+12px)]">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-zinc-900/8 bg-white text-zinc-700 shadow-[0_8px_24px_rgba(24,24,27,0.08)] transition-colors hover:bg-zinc-50 hover:text-zinc-950"
          aria-label="Cerrar visor de imagen"
        >
          <span aria-hidden="true" className="text-xl font-light leading-none">
            ×
          </span>
        </button>
      </div>

      <motion.div
        className="absolute inset-0 z-[410] bg-white pt-[calc(env(safe-area-inset-top)+56px)] pb-[calc(env(safe-area-inset-bottom)+24px)]"
        style={{ y, touchAction: "none" }}
        drag={isZoomed ? false : "y"}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.15}
        onClick={(e) => e.stopPropagation()}
        onDragEnd={(_, info) => {
          if (info.offset.y > 120 || info.velocity.y > 800) {
            onClose();
            return;
          }
          resetY();
        }}
      >
        <div className="flex h-full w-full items-center justify-center bg-white">
          <Swiper
            key={`viewer-${total}`}
            initialSlide={safeIndex}
            slidesPerView={1}
            spaceBetween={0}
            speed={280}
            threshold={6}
            longSwipesRatio={0.18}
            longSwipesMs={220}
            followFinger
            watchSlidesProgress
            allowTouchMove={!isZoomed && !isPinching}
            simulateTouch={!isZoomed && !isPinching}
            touchStartPreventDefault={false}
            passiveListeners={false}
            onSwiper={(s) => {
              swiperRef.current = s;
            }}
            onSlideChange={(s) => {
              setIsZoomed(false);
              setIsPinching(false);
              if (Math.abs(y.get()) > 0.5) {
                resetY();
              }

              const i = s.activeIndex;
              setActive(i);
              setIndex(i);
            }}
            style={{ height: "100%", width: "100%" }}
            nested
            resistanceRatio={isZoomed || isPinching ? 0 : 0.85}
          >
            {cleanImages.map((img, idx) => (
              <SwiperSlide key={`${img.url}-${idx}`}>
                <div className="viewer-slide-frame">
                  <ZoomableViewerImage
                    src={img.url}
                    alt={img.alt || "Imagen producto"}
                    active={idx === active}
                    onZoomChange={(zoomed) => {
                      if (idx === active) {
                        setIsZoomed(zoomed);
                      }
                    }}
                    onPinchChange={(pinching) => {
                      if (idx === active) {
                        setIsPinching(pinching);
                      }
                    }}
                  />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </motion.div>

      {total > 1 ? (
        <div
          className="absolute bottom-5 left-0 right-0 z-[420] flex justify-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {cleanImages.map((_, idx) => {
            const isActive = idx === active;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => swiperRef.current?.slideTo(idx)}
                className={
                  isActive
                    ? "h-2 w-2 rounded-full bg-zinc-950"
                    : "h-2 w-2 rounded-full bg-zinc-900/18"
                }
                aria-label={`Ir a imagen ${idx + 1}`}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );

  return createPortal(modal, document.body);
}