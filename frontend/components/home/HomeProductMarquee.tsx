"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";

import type { HomepageMarqueeProduct } from "@/lib/api";
import { getProductCardImageCandidates } from "@/lib/product-media";
import { productPath } from "@/lib/routes";

type Props = {
  products: HomepageMarqueeProduct[];
};

type SafeMarqueeProduct = HomepageMarqueeProduct & {
  resolvedHref: string;
  resolvedImage: string | null;
  resolvedPrice: string | null;
};

type Measurements = {
  cycleWidth: number;
  viewportWidth: number;
};

type PointerState = {
  isDragging: boolean;
  pointerId: number | null;
  startX: number;
  lastX: number;
  lastTime: number;
  dragDistance: number;
};

type DragLockSnapshot = {
  overflow: string;
  overscrollBehavior: string;
  touchAction: string;
};

const AUTO_SPEED_PX_PER_SECOND = 22;
const INERTIA_DAMPING = 0.92;
const MAX_INERTIA_SPEED = 480;
const CLICK_CANCEL_THRESHOLD = 8;

function lockDocumentScroll(): DragLockSnapshot | null {
  if (typeof document === "undefined") return null;

  const body = document.body;
  const docEl = document.documentElement;

  const snapshot: DragLockSnapshot = {
    overflow: body.style.overflow,
    overscrollBehavior: docEl.style.overscrollBehavior,
    touchAction: body.style.touchAction,
  };

  body.style.overflow = "hidden";
  body.style.touchAction = "none";
  docEl.style.overscrollBehavior = "none";

  return snapshot;
}

function unlockDocumentScroll(snapshot: DragLockSnapshot | null) {
  if (typeof document === "undefined" || !snapshot) return;

  document.body.style.overflow = snapshot.overflow;
  document.body.style.touchAction = snapshot.touchAction;
  document.documentElement.style.overscrollBehavior = snapshot.overscrollBehavior;
}

function preventTouchScroll(event: TouchEvent) {
  event.preventDefault();
}

function enableDragScrollLock() {
  if (typeof document === "undefined") return;
  document.addEventListener("touchmove", preventTouchScroll, { passive: false });
}

function disableDragScrollLock() {
  if (typeof document === "undefined") return;
  document.removeEventListener("touchmove", preventTouchScroll);
}

function formatPrice(price: number | string | null | undefined): string | null {
  if (price === null || price === undefined || price === "") return null;

  const numeric = typeof price === "number" ? price : Number(price);
  if (!Number.isFinite(numeric)) return String(price);

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function clampVelocity(value: number): number {
  if (value > MAX_INERTIA_SPEED) return MAX_INERTIA_SPEED;
  if (value < -MAX_INERTIA_SPEED) return -MAX_INERTIA_SPEED;
  return value;
}

function normalizePosition(positionRef: { current: number }, cycleWidth: number) {
  if (!cycleWidth) return;

  while (positionRef.current <= -2 * cycleWidth) {
    positionRef.current += cycleWidth;
  }
  while (positionRef.current >= 0) {
    positionRef.current -= cycleWidth;
  }
}

export default function ProductDiscoveryRail({ products }: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const middleSegmentRef = useRef<HTMLDivElement | null>(null);
  const rafLoopRef = useRef<number | null>(null);
  const measurementsRef = useRef<Measurements>({
    cycleWidth: 0,
    viewportWidth: 0,
  });
  const positionRef = useRef(0);
  const velocityRef = useRef(0);
  const hasInitializedPositionRef = useRef(false);
  const suppressClickRef = useRef(false);
  const lastFrameTimeRef = useRef<number | null>(null);
  const pointerStateRef = useRef<PointerState>({
    isDragging: false,
    pointerId: null,
    startX: 0,
    lastX: 0,
    lastTime: 0,
    dragDistance: 0,
  });
  const dragLockSnapshotRef = useRef<DragLockSnapshot | null>(null);

  const safeProducts = useMemo<SafeMarqueeProduct[]>(() => {
    if (!Array.isArray(products)) return [];

    return products
      .filter((product): product is HomepageMarqueeProduct => {
        return Boolean(product && product.id && product.slug);
      })
      .map((product) => {
        const candidates = getProductCardImageCandidates(product as any);
        const resolvedImage =
          candidates.find(
            (candidate) => typeof candidate === "string" && candidate.trim().length > 0
          ) ?? null;

        return {
          ...product,
          resolvedHref: productPath(product.slug),
          resolvedImage,
          resolvedPrice: formatPrice(product.price),
        };
      });
  }, [products]);

  const repeatedProducts = useMemo(() => {
    if (safeProducts.length === 0) return [];
    return [safeProducts, safeProducts, safeProducts] as const;
  }, [safeProducts]);

  useEffect(() => {
    if (safeProducts.length === 0) return;

    const measure = () => {
      const cycleWidth = middleSegmentRef.current?.offsetWidth ?? 0;
      const viewportWidth = viewportRef.current?.offsetWidth ?? 0;

      measurementsRef.current = {
        cycleWidth,
        viewportWidth,
      };

      if (cycleWidth > 0 && !hasInitializedPositionRef.current) {
        positionRef.current = -cycleWidth;
        hasInitializedPositionRef.current = true;
        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(${positionRef.current}px, 0, 0)`;
        }
      } else if (cycleWidth > 0) {
        normalizePosition(positionRef, cycleWidth);
        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(${positionRef.current}px, 0, 0)`;
        }
      }
    };

    measure();

    const viewportObserver = new ResizeObserver(() => {
      measure();
    });
    const segmentObserver = new ResizeObserver(() => {
      measure();
    });

    if (viewportRef.current) viewportObserver.observe(viewportRef.current);
    if (middleSegmentRef.current) segmentObserver.observe(middleSegmentRef.current);

    return () => {
      viewportObserver.disconnect();
      segmentObserver.disconnect();
    };
  }, [safeProducts]);

  useEffect(() => {
    if (safeProducts.length === 0) return;

    const tick = (time: number) => {
      const lastTime = lastFrameTimeRef.current ?? time;
      const deltaMs = time - lastTime;
      lastFrameTimeRef.current = time;
      const deltaSeconds = Math.min(deltaMs, 32) / 1000;

      if (!pointerStateRef.current.isDragging) {
        positionRef.current -= AUTO_SPEED_PX_PER_SECOND * deltaSeconds;

        if (Math.abs(velocityRef.current) > 0.01) {
          positionRef.current += velocityRef.current * deltaSeconds;
          velocityRef.current *= Math.pow(INERTIA_DAMPING, deltaMs / 16.67);
          if (Math.abs(velocityRef.current) < 4) {
            velocityRef.current = 0;
          }
        }
      }

      normalizePosition(positionRef, measurementsRef.current.cycleWidth);
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${positionRef.current}px, 0, 0)`;
      }
      rafLoopRef.current = requestAnimationFrame(tick);
    };

    rafLoopRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafLoopRef.current !== null) {
        cancelAnimationFrame(rafLoopRef.current);
      }
      rafLoopRef.current = null;
      lastFrameTimeRef.current = null;
    };
  }, [safeProducts]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerStateRef.current = {
      isDragging: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      lastTime: performance.now(),
      dragDistance: 0,
    };

    velocityRef.current = 0;
    suppressClickRef.current = false;
    dragLockSnapshotRef.current = lockDocumentScroll();
    enableDragScrollLock();
    viewportRef.current?.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointerStateRef.current;
    if (!pointer.isDragging) return;
    event.preventDefault();

    const now = performance.now();
    const deltaX = event.clientX - pointer.lastX;
    const deltaTime = Math.max(now - pointer.lastTime, 1);

    positionRef.current += deltaX;
    pointer.dragDistance += Math.abs(event.clientX - pointer.startX) - pointer.dragDistance;
    pointer.lastX = event.clientX;
    pointer.lastTime = now;

    const instantVelocity = (deltaX / deltaTime) * 1000;
    velocityRef.current = clampVelocity(instantVelocity * 0.35 + velocityRef.current * 0.65);

    if (Math.abs(event.clientX - pointer.startX) > CLICK_CANCEL_THRESHOLD) {
      suppressClickRef.current = true;
    }

    normalizePosition(positionRef, measurementsRef.current.cycleWidth);
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(${positionRef.current}px, 0, 0)`;
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerStateRef.current.isDragging = false;
    pointerStateRef.current.pointerId = null;
    viewportRef.current?.releasePointerCapture?.(event.pointerId);
    velocityRef.current = clampVelocity(velocityRef.current);
    disableDragScrollLock();
    unlockDocumentScroll(dragLockSnapshotRef.current);
    dragLockSnapshotRef.current = null;
  };

  const handleCardClickCapture = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  useEffect(() => {
    return () => {
      disableDragScrollLock();
      unlockDocumentScroll(dragLockSnapshotRef.current);
      dragLockSnapshotRef.current = null;
    };
  }, []);

  if (safeProducts.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Selección destacada de productos"
      className="home-marquee-section"
      data-marquee-density="responsive"
    >
      <div
        ref={viewportRef}
        className="home-marquee-viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div ref={trackRef} className="home-marquee-track">
          {repeatedProducts.map((segmentProducts, segmentIndex) => (
            <div
              key={`segment-${segmentIndex}`}
              ref={segmentIndex === 1 ? middleSegmentRef : null}
              className="home-marquee-segment"
              aria-hidden={segmentIndex !== 1}
            >
              {segmentProducts.map((product, index) => {
                const showSoldOut = Boolean(product.sold_out);
                const cardKey = `${segmentIndex}-${product.id}-${index}`;

                return (
                  <div key={cardKey} className="home-marquee-item">
                    <Link
                      href={product.resolvedHref}
                      className="home-marquee-card"
                      aria-label={`Ver producto ${product.name}`}
                      onClickCapture={handleCardClickCapture}
                      draggable={false}
                    >
                      <div className="home-marquee-media">
                        {product.resolvedImage ? (
                          <Image
                            src={product.resolvedImage}
                            alt={product.name}
                            fill
                            sizes="(max-width: 768px) 168px, 210px"
                            className="home-marquee-image"
                            draggable={false}
                          />
                        ) : (
                          <div className="home-marquee-media home-marquee-media--fallback">
                            <span className="home-marquee-fallback-label">Kame.col</span>
                          </div>
                        )}

                        {showSoldOut ? (
                          <span className="home-marquee-soldout">Sold out</span>
                        ) : null}
                      </div>

                      <div className="home-marquee-meta">
                        <p className="home-marquee-name">{product.name}</p>
                        {product.resolvedPrice ? (
                          <p className="home-marquee-price">{product.resolvedPrice}</p>
                        ) : null}
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}