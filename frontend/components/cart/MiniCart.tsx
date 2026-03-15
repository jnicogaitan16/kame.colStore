"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import DrawerShell from "@/components/drawer/DrawerShell";
import StockWarningChip from "@/components/cart/StockWarningChip";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/Button";
import { productPath } from "@/lib/routes";
import { getProductPrimaryImage } from "@/lib/product-media";

type MiniCartProps = {
  open?: boolean;
  onClose?: () => void;
};

type StockVisualState = {
  status: "low" | "over";
  message: string;
  detail?: string;
};

function parseFiniteNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (value == null) return NaN;
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeCartStockState(item: any, hint: any, warning: any): StockVisualState | null {
  const quantity = Number(item?.quantity || 0);

  if (warning) {
    const requestedRaw =
      warning?.requested ??
      warning?.qty ??
      warning?.quantity ??
      warning?.requested_total ??
      quantity;

    const availableRaw =
      warning?.available ??
      warning?.available_stock ??
      warning?.available_qty ??
      warning?.stock_available ??
      warning?.stock ??
      warning?.remaining;

    const requested = parseFiniteNumber(requestedRaw);
    const available = parseFiniteNumber(availableRaw);
    const hasAvailable = Number.isFinite(available);
    const safeRequested = Number.isFinite(requested) ? requested : quantity;
    const message =
      typeof warning?.message === "string" && warning.message.trim()
        ? warning.message.trim()
        : "Drop casi agotado";

    return {
      status: hasAvailable && available <= 1 ? "low" : "over",
      message,
      detail: hasAvailable
        ? `Pediste ${safeRequested}. Solo quedan ${available} en este drop.`
        : "La cantidad que pediste supera las unidades disponibles.",
    };
  }

  if (hint?.kind === "last_unit" && hint?.message) {
    return {
      status: "low",
      message: String(hint.message),
    };
  }

  return null;
}

// Block B: right-side drawer drag interaction.
// Candidate for future reuse once left/right drawer drag behavior is unified.
// Block B: drag handlers
const DRAG_THRESHOLD_PX = 12;
const HORIZONTAL_DOMINANCE_RATIO = 1.2;
const CLOSE_THRESHOLD_RATIO = 0.32;
const FAST_SWIPE_VELOCITY = 0.55;

function MiniCart({ open, onClose }: MiniCartProps) {
  // Block D: cart-specific content and store bindings
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const stockWarningsByVariantId = useCartStore((s) => s.stockWarningsByVariantId);
  const stockHintsByVariantId = useCartStore((s) => s.stockHintsByVariantId);
  const [animateIn, setAnimateIn] = useState(false);

  // Block A: drawer control state
  const isOpen = Boolean(open);
  const close = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // Block B: lateral drag state
  const asideRef = useRef<HTMLElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [dragLockedAxis, setDragLockedAxis] = useState<"x" | "y" | null>(null);
  const dragStartTimeRef = useRef(0);

  // Block A: drawer control effects

  useEffect(() => {
    if (!isOpen) {
      setAnimateIn(false);
      return;
    }

    const frameId = requestAnimationFrame(() => setAnimateIn(true));
    return () => cancelAnimationFrame(frameId);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [close, isOpen]);

  // Block B: derived drag presentation state
  const panelWidth = asideRef.current?.offsetWidth ?? 0;
  const clampedDragX = Math.max(0, dragX);
  const dragProgress = panelWidth > 0 ? Math.min(clampedDragX / panelWidth, 1) : 0;
  const overlayOpacity = isOpen ? Math.max(0, 1 - dragProgress) : 0;
  const asideTranslateX = isOpen
    ? isDragging
      ? clampedDragX
      : animateIn
        ? 0
        : panelWidth || 0
    : panelWidth || 0;

  function resetDragState() {
    setIsDragging(false);
    setDragX(0);
    setStartX(0);
    setStartY(0);
    setDragLockedAxis(null);
  }

  function handleTouchStart(event: React.TouchEvent<HTMLElement>) {
    if (!isOpen) return;

    const touch = event.touches[0];
    setStartX(touch.clientX);
    setStartY(touch.clientY);
    setDragX(0);
    setDragLockedAxis(null);
    setIsDragging(false);
    dragStartTimeRef.current = performance.now();
  }

  function handleTouchMove(event: React.TouchEvent<HTMLElement>) {
    if (!isOpen) return;

    const touch = event.touches[0];
    const nextDeltaX = touch.clientX - startX;
    const nextDeltaY = touch.clientY - startY;
    const absDeltaX = Math.abs(nextDeltaX);
    const absDeltaY = Math.abs(nextDeltaY);

    if (!dragLockedAxis) {
      if (absDeltaX < DRAG_THRESHOLD_PX && absDeltaY < DRAG_THRESHOLD_PX) {
        return;
      }

      if (absDeltaX > absDeltaY * HORIZONTAL_DOMINANCE_RATIO && nextDeltaX > 0) {
        setDragLockedAxis("x");
        setIsDragging(true);
      } else {
        setDragLockedAxis("y");
        setIsDragging(false);
        return;
      }
    }

    if (dragLockedAxis !== "x") {
      return;
    }

    setIsDragging(true);
    setDragX(Math.max(0, nextDeltaX));
  }

  function handleTouchEnd() {
    if (!isOpen) {
      resetDragState();
      return;
    }

    if (dragLockedAxis !== "x") {
      resetDragState();
      return;
    }

    const elapsedMs = Math.max(performance.now() - dragStartTimeRef.current, 1);
    const velocity = clampedDragX / elapsedMs;
    const shouldCloseByDistance = panelWidth > 0 && clampedDragX > panelWidth * CLOSE_THRESHOLD_RATIO;
    const shouldCloseByVelocity = velocity > FAST_SWIPE_VELOCITY;

    if (shouldCloseByDistance || shouldCloseByVelocity) {
      resetDragState();
      close();
      return;
    }

    resetDragState();
  }

  function handleTouchCancel() {
    resetDragState();
  }

  // Block D: cart-specific derived values
  function totalItems() {
    return (items || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
  }

  function totalAmount() {
    return (items || []).reduce((acc, it) => {
      const price = typeof it.price === "number" ? it.price : parseFloat(String(it.price || 0));
      const qty = Number(it.quantity || 0);
      return acc + (Number.isFinite(price) ? price : 0) * (Number.isFinite(qty) ? qty : 0);
    }, 0);
  }

  // Block C: reusable drawer shell + Block D: cart-specific content
  return (
    <DrawerShell
      isOpen={isOpen}
      side="right"
      panelRef={asideRef}
      isDragging={isDragging}
      backdropOpacity={overlayOpacity}
      translateX={asideTranslateX}
      onClose={close}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      headerContent={
        <div className="drawer-header-row drawer-header-glass">
          <h2 className="type-card-title text-white/96">Carrito ({totalItems()})</h2>
          <button
            type="button"
            onClick={close}
            className="rounded p-2 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Cerrar carrito"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      }
      footerContent={
        items.length > 0 ? (
          <div className="mt-auto px-5 py-5 border-t border-white/10 drawer-glass-footer text-neutral-100">
            <div className="mb-4 flex items-baseline justify-between">
              <span className="type-ui-label text-white/60">Total</span>
              <span className="type-price text-white/96">${totalAmount().toLocaleString("es-CO")}</span>
            </div>
            <Link href="/checkout" onClick={close} className="block">
              <Button variant="primary" fullWidth>
                Ir al checkout
              </Button>
            </Link>
          </div>
        ) : null
      }
    >
      <div className="p-4">
        {items.length === 0 ? (
          <p className="type-ui-label py-8 text-center text-white/56">Tu carrito está vacío</p>
        ) : (
          <ul className="space-y-4">
            {items.map((item) => {
              const key = String(item.variantId);
              const stockHint = stockHintsByVariantId[key];
              const stockWarning = stockWarningsByVariantId[key];
              const stockState = normalizeCartStockState(item, stockHint, stockWarning);

              return (
                <li key={item.variantId} className="px-5 py-4 flex gap-3 border-b border-white/5">
                  <div className="relative w-16 h-16 shrink-0 overflow-hidden product-media-surface">
                    {(() => {
                      const p: any = (item as any)?.product || item;
                      const thumb = getProductPrimaryImage(p) || getProductPrimaryImage((item as any)?.product) || (item as any)?.imageUrl || "";
                      const alt = p?.name || (item as any)?.productName || "Producto";

                      return thumb ? (
                        <img
                          src={thumb}
                          alt={alt}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-white/40">
                          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                          </svg>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={productPath(item.productSlug)}
                      onClick={close}
                      className="card-premium-name block line-clamp-2 hover:text-white/90 hover:underline"
                    >
                      {item.productName}
                    </Link>
                    <p className="type-ui-label mt-1 text-white/56">{item.variantLabel}</p>

                    {stockState ? (
                      <div className="mt-2">
                        <StockWarningChip
                          status={stockState.status}
                          message={stockState.message}
                          detail={stockState.detail}
                          compact
                        />
                      </div>
                    ) : null}
                    <div className="mt-1 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const nextQty = item.quantity - 1;
                            updateQuantity(item.variantId, nextQty);
                          }}
                          className="pill w-8 h-8 p-0 bg-white/5 border border-white/10 hover:bg-white/10"
                        >
                          −
                        </button>
                        <span className="type-ui-label w-8 text-center text-white/78">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextQty = item.quantity + 1;
                            updateQuantity(item.variantId, nextQty);
                          }}
                          className="pill w-8 h-8 p-0 bg-white/5 border border-white/10 hover:bg-white/10"
                        >
                          +
                        </button>
                      </div>
                      <span className="type-price text-white/94">
                        ${(parseFloat(item.price) * item.quantity).toLocaleString("es-CO")}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.variantId)}
                    className="shrink-0 text-white/45 hover:text-red-500"
                    aria-label="Quitar del carrito"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DrawerShell>
  );
}

export default MiniCart;
export { MiniCart };
