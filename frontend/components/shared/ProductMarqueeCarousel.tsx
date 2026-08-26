"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";

import type { HomepageMarqueeProduct } from "@/lib/api";
import { getProductCardImageCandidates } from "@/lib/product-media";
import { productPath } from "@/lib/routes";
import { trackProductClick } from "@/hooks/useTracking";

export type ProductMarqueeCarouselProps = {
  products: HomepageMarqueeProduct[];
  /** Home: aria-label en la section */
  ariaLabel?: string;
  /** PDP: aria-labelledby apuntando al título */
  ariaLabelledBy?: string;
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
  pointerDown: boolean;
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
const IMAGE_SIZES = "(max-width: 768px) 168px, 210px";

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

function isSoldOut(product: HomepageMarqueeProduct): boolean {
  if (product.sold_out) return true;
  const extended = product as HomepageMarqueeProduct & {
    is_available?: boolean | null;
    in_stock?: boolean | null;
    stock?: number | null;
    available_stock?: number | null;
  };
  if (extended.is_available === false) return true;
  if (extended.in_stock === false) return true;
  if (typeof extended.stock === "number" && extended.stock <= 0) return true;
  if (typeof extended.available_stock === "number" && extended.available_stock <= 0) {
    return true;
  }
  return false;
}

/**
 * Carrusel marquee infinito (home + PDP). Una sola implementación de drag, auto-scroll y clics.
 */
export default function ProductMarqueeCarousel({
  products,
  ariaLabel,
  ariaLabelledBy,
}: ProductMarqueeCarouselProps) {
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
    pointerDown: false,
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
        const candidates = getProductCardImageCandidates(product as Parameters<typeof getProductCardImageCandidates>[0]);
        const resolvedImage =
          candidates.find(
            (candidate) => typeof candidate === "string" && candidate.trim().length > 0
          ) ?? null;

        const displayName = String(product.name || (product as { title?: string }).title || "").trim();

        return {
          ...product,
          name: displayName || product.name,
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

      if (!pointerStateRef.current.isDragging && !pointerStateRef.current.pointerDown) {
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

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointerStateRef.current;
    if (pointer.isDragging) return;

    pointer.isDragging = true;
    suppressClickRef.current = true;
    dragLockSnapshotRef.current = lockDocumentScroll();
    enableDragScrollLock();
    viewportRef.current?.setPointerCapture?.(event.pointerId);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    pointerStateRef.current = {
      pointerDown: true,
      isDragging: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      lastTime: performance.now(),
      dragDistance: 0,
    };

    velocityRef.current = 0;
    suppressClickRef.current = false;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointerStateRef.current;
    if (!pointer.pointerDown || pointer.pointerId !== event.pointerId) return;

    const deltaFromStart = event.clientX - pointer.startX;
    if (!pointer.isDragging && Math.abs(deltaFromStart) > CLICK_CANCEL_THRESHOLD) {
      beginDrag(event);
    }
    if (!pointer.isDragging) return;

    event.preventDefault();

    const now = performance.now();
    const deltaX = event.clientX - pointer.lastX;
    const deltaTime = Math.max(now - pointer.lastTime, 1);

    positionRef.current += deltaX;
    pointer.dragDistance += Math.abs(deltaX);
    pointer.lastX = event.clientX;
    pointer.lastTime = now;

    const instantVelocity = (deltaX / deltaTime) * 1000;
    velocityRef.current = clampVelocity(instantVelocity * 0.35 + velocityRef.current * 0.65);

    normalizePosition(positionRef, measurementsRef.current.cycleWidth);
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(${positionRef.current}px, 0, 0)`;
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = pointerStateRef.current;
    if (!pointer.pointerDown || pointer.pointerId !== event.pointerId) return;

    if (pointer.isDragging) {
      viewportRef.current?.releasePointerCapture?.(event.pointerId);
      velocityRef.current = clampVelocity(velocityRef.current);
      disableDragScrollLock();
      unlockDocumentScroll(dragLockSnapshotRef.current);
      dragLockSnapshotRef.current = null;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    } else {
      suppressClickRef.current = false;
    }

    pointerStateRef.current = {
      pointerDown: false,
      isDragging: false,
      pointerId: null,
      startX: 0,
      lastX: 0,
      lastTime: 0,
      dragDistance: 0,
    };
  };

  const handleCardClickCapture = (
    event: React.MouseEvent<HTMLAnchorElement>,
    product: SafeMarqueeProduct
  ) => {
    if (suppressClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
      return;
    }
    trackProductClick({
      id: product.id,
      name: product.name,
      slug: product.slug,
    });
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
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-labelledby={ariaLabelledBy}
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
              data-marquee-clone={segmentIndex !== 1 ? "true" : undefined}
              aria-hidden={segmentIndex !== 1 ? true : undefined}
            >
              {segmentProducts.map((product, index) => {
                const showSoldOut = isSoldOut(product);
                const cardKey = `${segmentIndex}-${product.id}-${index}`;
                const isCloneSegment = segmentIndex !== 1;
                const productName = String(product.name || "").trim() || "Producto";

                return (
                  <div key={cardKey} className="home-marquee-item">
                    <Link
                      href={product.resolvedHref}
                      className="home-marquee-card"
                      aria-label={`Ver producto ${productName}`}
                      tabIndex={isCloneSegment ? -1 : undefined}
                      onClickCapture={(e) => handleCardClickCapture(e, product)}
                      draggable={false}
                    >
                      <div className="home-marquee-media">
                        {product.resolvedImage ? (
                          <Image
                            src={product.resolvedImage}
                            alt={productName}
                            fill
                            sizes={IMAGE_SIZES}
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
                        <p className="home-marquee-name">{productName}</p>
                        {product.discount?.has_discount ? (
                          <div className="home-marquee-price-row">
                            <span className="home-marquee-price home-marquee-price--discount">
                              {formatPrice(product.discount.discount_price)}
                            </span>
                            <span className="home-marquee-price home-marquee-price--original">
                              {product.resolvedPrice}
                            </span>
                            <span className="home-marquee-discount-label">
                              {product.discount.discount_label}
                            </span>
                          </div>
                        ) : product.resolvedPrice ? (
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
