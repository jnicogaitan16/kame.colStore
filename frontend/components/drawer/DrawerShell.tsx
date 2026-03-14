

"use client";

import type { ReactNode, Ref, RefObject, TouchEventHandler } from "react";
import Link from "next/link";

type DrawerShellProps = {
  isOpen: boolean;
  side?: "left" | "right";
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
  if (!isOpen) return null;

  const panelSideClass = side === "left" ? "drawer-panel-left" : "drawer-panel-right";
  const panelTransitionClass = isDragging ? "drawer-panel-drag-active" : "drawer-panel-transition";

  return (
    <div className="drawer-shell" aria-hidden={!isOpen}>
      <div
        className="drawer-backdrop drawer-drag-backdrop"
        style={{ opacity: backdropOpacity }}
        onClick={onClose}
      />

      <aside
        ref={panelRef as Ref<HTMLElement> | undefined}
        className={[
          panelSideClass,
          "drawer-panel-surface",
          panelTransitionClass,
          "transform will-change-transform",
        ].join(" ")}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        onClick={(e) => e.stopPropagation()}
      >
        {headerContent ?? (
          <div className="drawer-header-row drawer-header-glass">
            <Link
              href="/"
              onClick={onClose}
              className="type-card-title mx-auto text-center text-white/96 transition hover:text-white"
              aria-label="Ir al inicio"
            >
              Kame.col
            </Link>
          </div>
        )}

        <div className="drawer-body-scroll">{children}</div>

        {footerContent ? <div className="drawer-footer-row">{footerContent}</div> : null}
      </aside>
    </div>
  );
}