"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  type MouseEvent as ReactMouseEvent,
} from "react";

import type { HomepageMarqueeProduct } from "@/lib/api";
import {
  getProductCardImageCandidates,
  getProductPrimaryImage,
} from "@/lib/product-media";
import { productPath } from "@/lib/routes";
import { trackProductClick } from "@/hooks/useTracking";

type ProductDiscoveryRailProps = {
  title?: string;
  products: HomepageMarqueeProduct[];
};

type DiscoveryRailProduct = HomepageMarqueeProduct & {
  title?: string | null;
  is_available?: boolean | null;
  in_stock?: boolean | null;
  stock?: number | null;
  available_stock?: number | null;
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
const DRAG_MULTIPLIER = 1;
const INERTIA_DAMPING = 0.92;
const INERTIA_STOP_THRESHOLD = 4;
const CLICK_CANCEL_THRESHOLD = 6;

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

function formatPrice(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (typeof value === "string") {
    const normalized = Number(value);
    if (Number.isFinite(normalized)) {
      return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }).format(normalized);
    }

    const trimmed = value.trim();
    return trimmed || null;
  }

  return null;
}

function isSoldOut(product: DiscoveryRailProduct): boolean {
  if (product?.is_available === false) return true;
  if (product?.in_stock === false) return true;
  if (typeof product?.stock === "number" && product.stock <= 0) return true;
  if (
    typeof product?.available_stock === "number" &&
    product.available_stock <= 0
  ) {
    return true;
  }
  return false;
}

function getResolvedHref(product: HomepageMarqueeProduct): string {
  if (typeof product?.slug === "string" && product.slug.trim()) {
    return productPath(product.slug.trim());
  }

  return "/catalogo";
}

function getResolvedImage(product: HomepageMarqueeProduct): string | null {
  const candidates = getProductCardImageCandidates(product);

  if (Array.isArray(candidates)) {
    return candidates[0] || getProductPrimaryImage(product) || null;
  }

  if (typeof candidates === "string") {
    return candidates || getProductPrimaryImage(product) || null;
  }

  return getProductPrimaryImage(product) || null;
}

function normalizePosition(position: number, cycleWidth: number): number {
  if (!cycleWidth) {
    return position;
  }

  let next = position;

  while (next <= -2 * cycleWidth) {
    next += cycleWidth;
  }

  while (next > 0) {
    next -= cycleWidth;
  }

  return next;
}

export function ProductDiscoveryRail({
  title = "Descubre más diseños",
  products,
}: ProductDiscoveryRailProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const middleSegmentRef = useRef<HTMLDivElement | null>(null);
  const rafLoopRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
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

  const safeProducts = useMemo<DiscoveryRailProduct[]>(() => {
    if (!Array.isArray(products)) {
      return [];
    }

    return products
      .filter((product): product is HomepageMarqueeProduct => Boolean(product))
      .map((product) => ({
        ...(product as DiscoveryRailProduct),
        resolvedHref: getResolvedHref(product),
        resolvedImage: getResolvedImage(product),
        resolvedPrice: formatPrice(product?.price ?? null),
      }))
      .filter((product) => {
        const hasId = product?.id !== null && product?.id !== undefined;
        const hasName = String(product?.name || product?.title || "").trim().length > 0;
        return hasId && hasName;
      });
  }, [products]);

  const repeatedProducts = useMemo(
    () => [safeProducts, safeProducts, safeProducts] as const,
    [safeProducts]
  );

  useEffect(() => {
    const track = trackRef.current;
    const viewport = viewportRef.current;
    const middleSegment = middleSegmentRef.current;

    if (!track || !viewport || !middleSegment || safeProducts.length === 0) {
      return undefined;
    }

    const applyTransform = () => {
      track.style.transform = `translate3d(${positionRef.current}px, 0, 0)`;
    };

    const updateMeasurements = () => {
      const cycleWidth = middleSegment.offsetWidth;
      const viewportWidth = viewport.offsetWidth;

      measurementsRef.current = {
        cycleWidth,
        viewportWidth,
      };

      if (!cycleWidth) {
        positionRef.current = 0;
        applyTransform();
        return;
      }

      if (!hasInitializedPositionRef.current) {
        positionRef.current = -cycleWidth;
        hasInitializedPositionRef.current = true;
      } else {
        positionRef.current = normalizePosition(positionRef.current, cycleWidth);
      }

      applyTransform();
    };

    updateMeasurements();

    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = new ResizeObserver(() => {
      updateMeasurements();
    });

    resizeObserverRef.current.observe(viewport);
    resizeObserverRef.current.observe(middleSegment);

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
    };
  }, [safeProducts]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || safeProducts.length === 0) {
      return undefined;
    }

    const applyTransform = () => {
      track.style.transform = `translate3d(${positionRef.current}px, 0, 0)`;
    };

    const tick = (now: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = now;
        rafLoopRef.current = window.requestAnimationFrame(tick);
        return;
      }

      const deltaMs = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;
      const deltaSeconds = Math.min(deltaMs / 1000, 0.05);
      const { cycleWidth } = measurementsRef.current;

      if (!pointerStateRef.current.isDragging && cycleWidth > 0) {
        positionRef.current -= AUTO_SPEED_PX_PER_SECOND * deltaSeconds;

        if (Math.abs(velocityRef.current) > INERTIA_STOP_THRESHOLD) {
          positionRef.current += velocityRef.current * deltaSeconds;
          velocityRef.current *= Math.pow(INERTIA_DAMPING, deltaMs / 16.67);
        } else {
          velocityRef.current = 0;
        }

        positionRef.current = normalizePosition(positionRef.current, cycleWidth);
        applyTransform();
      }

      rafLoopRef.current = window.requestAnimationFrame(tick);
    };

    rafLoopRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (rafLoopRef.current !== null) {
        window.cancelAnimationFrame(rafLoopRef.current);
      }
      rafLoopRef.current = null;
      lastFrameTimeRef.current = null;
    };
  }, [safeProducts]);

  useEffect(() => {
    return () => {
      if (rafLoopRef.current !== null) {
        window.cancelAnimationFrame(rafLoopRef.current);
      }
      resizeObserverRef.current?.disconnect();
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    pointerStateRef.current = {
      isDragging: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      lastTime: performance.now(),
      dragDistance: 0,
    };

    suppressClickRef.current = false;
    dragLockSnapshotRef.current = lockDocumentScroll();
    enableDragScrollLock();
    velocityRef.current = 0;
    viewport.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = pointerStateRef.current;
    const { cycleWidth } = measurementsRef.current;

    if (!state.isDragging || state.pointerId !== event.pointerId || !cycleWidth) {
      return;
    }
    event.preventDefault();

    const now = performance.now();
    const deltaX = event.clientX - state.lastX;
    const deltaTime = Math.max(now - state.lastTime, 1);

    positionRef.current += deltaX * DRAG_MULTIPLIER;
    positionRef.current = normalizePosition(positionRef.current, cycleWidth);
    velocityRef.current = (deltaX / deltaTime) * 1000;

    state.lastX = event.clientX;
    state.lastTime = now;
    state.dragDistance += Math.abs(deltaX);

    if (state.dragDistance > CLICK_CANCEL_THRESHOLD) {
      suppressClickRef.current = true;
    }

    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(${positionRef.current}px, 0, 0)`;
    }
  };

  const finishPointer = () => {
    const viewport = viewportRef.current;
    const state = pointerStateRef.current;

    if (viewport && state.pointerId !== null && viewport.hasPointerCapture(state.pointerId)) {
      viewport.releasePointerCapture(state.pointerId);
    }

    pointerStateRef.current = {
      isDragging: false,
      pointerId: null,
      startX: 0,
      lastX: 0,
      lastTime: 0,
      dragDistance: 0,
    };

    disableDragScrollLock();
    unlockDocumentScroll(dragLockSnapshotRef.current);
    dragLockSnapshotRef.current = null;

    if (suppressClickRef.current) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
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

  const handleClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    if (!suppressClickRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="pdp-discovery-block">
      <div className="pdp-discovery-title-row">
        <h2 id="pdp-discovery-title" className="pdp-label-refined text-zinc-500">
          {title}
        </h2>
      </div>

      <section
        className="home-marquee-section"
        aria-labelledby="pdp-discovery-title"
      >
        <div
          ref={viewportRef}
          className="home-marquee-viewport"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
          onClickCapture={handleClickCapture}
        >
          <div ref={trackRef} className="home-marquee-track" aria-label={title}>
            {repeatedProducts.map((segmentProducts, segmentIndex) => {
              const segmentRef = segmentIndex === 1 ? middleSegmentRef : undefined;

              return (
                <div
                  key={`segment-${segmentIndex}`}
                  ref={segmentRef}
                  className="home-marquee-segment"
                  role="list"
                  aria-label={segmentIndex === 1 ? title : undefined}
                  aria-hidden={segmentIndex !== 1}
                >
                  {segmentProducts.map((product, index) => {
                    const soldOut = isSoldOut(product);
                    const productName = String(
                      product?.name || product?.title || "Producto"
                    ).trim();
                    const productKey =
                      product?.id !== null && product?.id !== undefined
                        ? `${segmentIndex}-${String(product.id)}`
                        : `${segmentIndex}-${productName}-${index}`;

                    return (
                      <article
                        key={productKey}
                        className="home-marquee-item"
                        role="listitem"
                      >
                        <Link
                          href={product.resolvedHref}
                          className="home-marquee-card"
                          aria-label={`Ver producto ${productName}`}
                          onClick={() =>
                            trackProductClick({
                              id: product?.id ?? product.slug,
                              name: productName,
                              slug: String(product?.slug ?? "").trim(),
                            })
                          }
                        >
                          <div className="home-marquee-media">
                            {product.resolvedImage ? (
                              <Image
                                src={product.resolvedImage}
                                alt={productName}
                                fill
                                sizes="(max-width: 767px) 68vw, (max-width: 1023px) 38vw, 22vw"
                                className="home-marquee-image"
                              />
                            ) : (
                              <div
                                className="home-marquee-media home-marquee-media--fallback"
                                aria-hidden="true"
                              >
                                <span className="home-marquee-fallback-label">
                                  Kame.col
                                </span>
                              </div>
                            )}

                            {soldOut ? (
                              <span className="home-marquee-soldout">Sold out</span>
                            ) : null}
                          </div>

                          <div className="home-marquee-meta">
                            <h3 className="home-marquee-name">{productName}</h3>
                            {product.resolvedPrice ? (
                              <p className="home-marquee-price">
                                {product.resolvedPrice}
                              </p>
                            ) : null}
                          </div>
                        </Link>
                      </article>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}