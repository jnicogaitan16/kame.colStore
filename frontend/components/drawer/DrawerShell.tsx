"use client";

import { useEffect, useRef, useState, type AriaAttributes, type ReactNode, type Ref, type RefObject, type TouchEventHandler } from "react";
import Link from "next/link";

const DRAG_LOCK_THRESHOLD_PX = 10;
const CLOSE_DISTANCE_RATIO = 0.33;
const CLOSE_VELOCITY_PX_PER_MS = 0.35;
const CLOSE_ANIMATION_MS = 180;

type DrawerShellProps = {
  isOpen: boolean;
  side?: "left" | "right";
  ariaLabel?: string;
  ariaLabelledBy?: AriaAttributes["aria-labelledby"];
  bodyClassName?: string;
  panelClassName?: string;
  backdropClassName?: string;
  panelRef?: RefObject<HTMLElement | HTMLDivElement | null>;
  isDragging?: boolean;
  backdropOpacity?: number;
  translateX?: number;
  onClose: () => void;
  onTouchStart?: TouchEventHandler<HTMLElement | HTMLDivElement>;
  onTouchMove?: TouchEventHandler<HTMLElement | HTMLDivElement>;
  onTouchEnd?: TouchEventHandler<HTMLElement | HTMLDivElement>;
  onTouchCancel?: TouchEventHandler<HTMLElement | HTMLDivElement>;
  headerContent?: ReactNode;
  footerContent?: ReactNode;
  children: ReactNode;
};

export default function DrawerShell({
  isOpen,
  side = "left",
  ariaLabel,
  ariaLabelledBy,
  bodyClassName,
  panelClassName,
  backdropClassName,
  panelRef,
  isDragging = false,
  backdropOpacity = 1,
  translateX = 0,
  onClose,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
  headerContent,
  footerContent,
  children,
}: DrawerShellProps) {

  const internalPanelRef = useRef<HTMLElement | HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const gestureModeRef = useRef<"idle" | "pending" | "horizontal" | "vertical">("idle");
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const lastTouchXRef = useRef(0);
  const lastTouchTimeRef = useRef(0);

  const [internalIsDragging, setInternalIsDragging] = useState(false);
  const [internalTranslateX, setInternalTranslateX] = useState(0);
  const [internalBackdropOpacity, setInternalBackdropOpacity] = useState(1);

  const hasExternalGestureHandlers =
    Boolean(onTouchStart) || Boolean(onTouchMove) || Boolean(onTouchEnd) || Boolean(onTouchCancel);

  const resolvedPanelRef = (panelRef ?? internalPanelRef) as RefObject<HTMLElement | HTMLDivElement | null>;

  const getPanelWidth = () => {
    const width = resolvedPanelRef.current?.getBoundingClientRect().width ?? 0;
    if (width > 0) return width;
    if (typeof window !== "undefined") {
      return Math.min(window.innerWidth * 0.92, 420);
    }
    return 320;
  };

  const resetInternalGestureState = () => {
    gestureModeRef.current = "idle";
    dragStartXRef.current = 0;
    dragStartYRef.current = 0;
    lastTouchXRef.current = 0;
    lastTouchTimeRef.current = 0;
    setInternalIsDragging(false);
    setInternalTranslateX(0);
    setInternalBackdropOpacity(1);
  };

  useEffect(() => {
    if (!isOpen) {
      if (closeTimeoutRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      resetInternalGestureState();
      return;
    }

    resetInternalGestureState();
  }, [isOpen, side]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const beginInternalTouch: TouchEventHandler<HTMLElement | HTMLDivElement> = (event) => {
    if (!isOpen || hasExternalGestureHandlers) return;

    const touch = event.touches[0];
    if (!touch) return;

    gestureModeRef.current = "pending";
    dragStartXRef.current = touch.clientX;
    dragStartYRef.current = touch.clientY;
    lastTouchXRef.current = touch.clientX;
    lastTouchTimeRef.current = event.timeStamp;
    setInternalIsDragging(false);
    setInternalTranslateX(0);
    setInternalBackdropOpacity(1);
  };

  const moveInternalTouch: TouchEventHandler<HTMLElement | HTMLDivElement> = (event) => {
    if (!isOpen || hasExternalGestureHandlers) return;

    const touch = event.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - dragStartXRef.current;
    const deltaY = touch.clientY - dragStartYRef.current;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (gestureModeRef.current === "pending") {
      if (absX < DRAG_LOCK_THRESHOLD_PX && absY < DRAG_LOCK_THRESHOLD_PX) {
        return;
      }

      if (absY > absX) {
        gestureModeRef.current = "vertical";
        setInternalIsDragging(false);
        return;
      }

      gestureModeRef.current = "horizontal";
      setInternalIsDragging(true);
    }

    if (gestureModeRef.current !== "horizontal") {
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    const panelWidth = getPanelWidth();
    const clampedTranslate =
      side === "left"
        ? Math.max(-panelWidth, Math.min(0, deltaX))
        : Math.min(panelWidth, Math.max(0, deltaX));

    lastTouchXRef.current = touch.clientX;
    lastTouchTimeRef.current = event.timeStamp;
    setInternalTranslateX(clampedTranslate);
    setInternalBackdropOpacity(Math.max(0, 1 - Math.abs(clampedTranslate) / panelWidth));
  };

  const finishInternalTouch = () => {
    if (!isOpen || hasExternalGestureHandlers) return;

    const mode = gestureModeRef.current;
    const panelWidth = getPanelWidth();
    const currentTranslateX = internalTranslateX;
    const distance = Math.abs(currentTranslateX);
    const elapsed = Math.max(1, performance.now() - lastTouchTimeRef.current);
    const deltaSinceLast = currentTranslateX - (side === "left" ? Math.min(0, lastTouchXRef.current - dragStartXRef.current) : Math.max(0, lastTouchXRef.current - dragStartXRef.current));
    const velocity = deltaSinceLast / elapsed;

    if (mode !== "horizontal") {
      resetInternalGestureState();
      return;
    }

    const shouldCloseByDistance = distance >= panelWidth * CLOSE_DISTANCE_RATIO;
    const shouldCloseByVelocity =
      side === "left"
        ? velocity <= -CLOSE_VELOCITY_PX_PER_MS
        : velocity >= CLOSE_VELOCITY_PX_PER_MS;

    if (shouldCloseByDistance || shouldCloseByVelocity) {
      setInternalIsDragging(false);
      setInternalTranslateX(side === "left" ? -panelWidth : panelWidth);
      setInternalBackdropOpacity(0);
      gestureModeRef.current = "idle";

      if (closeTimeoutRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(closeTimeoutRef.current);
      }

      if (typeof window !== "undefined") {
        closeTimeoutRef.current = window.setTimeout(() => {
          closeTimeoutRef.current = null;
          onClose();
        }, CLOSE_ANIMATION_MS);
      } else {
        onClose();
      }

      return;
    }

    resetInternalGestureState();
  };

  const panelSideClass = side === "left" ? "drawer-panel-left" : "drawer-panel-right";
  const resolvedIsDragging = hasExternalGestureHandlers ? isDragging : internalIsDragging;
  const resolvedTranslateX = hasExternalGestureHandlers ? translateX : internalTranslateX;
  const resolvedBackdropOpacity = hasExternalGestureHandlers ? backdropOpacity : internalBackdropOpacity;
  const resolvedOnTouchStart = hasExternalGestureHandlers ? onTouchStart : beginInternalTouch;
  const resolvedOnTouchMove = hasExternalGestureHandlers ? onTouchMove : moveInternalTouch;
  const resolvedOnTouchEnd = hasExternalGestureHandlers ? onTouchEnd : finishInternalTouch;
  const resolvedOnTouchCancel = hasExternalGestureHandlers ? onTouchCancel : finishInternalTouch;
  const panelTransitionClass = resolvedIsDragging ? "drawer-panel-drag-active" : "drawer-panel-transition";

  const shellBackdropClass = "drawer-backdrop drawer-drag-backdrop bg-[rgba(248,245,240,0.56)]";
  const shellPanelClass =
    "drawer-panel-surface transform will-change-transform border-zinc-900/8 bg-white/84 shadow-[0_22px_60px_rgba(24,24,27,0.12)]";
  const shellHeaderClass =
    "drawer-header-row drawer-header-glass border-b border-zinc-900/6 bg-white/78";
  const shellFooterClass =
    "drawer-footer-row border-t border-zinc-900/6 bg-white/78 backdrop-blur-lg";

  const resolvedAriaLabel = ariaLabelledBy ? undefined : ariaLabel ?? "Drawer";

  if (!isOpen) return null;

  return (
    <div className="drawer-shell" aria-hidden={!isOpen}>
      <div
        className={[shellBackdropClass, backdropClassName].filter(Boolean).join(" ")}
        style={{ opacity: resolvedBackdropOpacity }}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        ref={resolvedPanelRef as Ref<HTMLElement> | undefined}
        role="dialog"
        aria-modal="true"
        aria-label={resolvedAriaLabel}
        aria-labelledby={ariaLabelledBy}
        className={[panelSideClass, shellPanelClass, panelTransitionClass, panelClassName]
          .filter(Boolean)
          .join(" ")}
        style={{
          transform: `translateX(${resolvedTranslateX}px)`,
          touchAction: "pan-y",
        }}
        onTouchStart={resolvedOnTouchStart}
        onTouchMove={resolvedOnTouchMove}
        onTouchEnd={resolvedOnTouchEnd}
        onTouchCancel={resolvedOnTouchCancel}
        onClick={(e) => e.stopPropagation()}
      >
        {headerContent ?? (
          <div className={shellHeaderClass}>
            <Link
              href="/"
              onClick={onClose}
              className="type-card-title mx-auto text-center text-zinc-950 transition-colors duration-200 hover:text-zinc-600"
              aria-label="Ir al inicio"
            >
              Kame.col
            </Link>
          </div>
        )}

        <div className={["drawer-body-scroll bg-transparent", bodyClassName].filter(Boolean).join(" ")}>
          {children}
        </div>

        {footerContent ? <div className={shellFooterClass}>{footerContent}</div> : null}
      </aside>
    </div>
  );
}