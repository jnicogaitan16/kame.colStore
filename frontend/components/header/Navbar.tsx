"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { HeaderAppearance } from "./types";
import { categoryPath } from "@/lib/routes";
import type {
  NormalizedNavCategory,
  NormalizedNavDepartment,
} from "../../lib/navigation-normalize";
export type NavbarProps = {
  navDepartments?: NormalizedNavDepartment[];
  categories?: NormalizedNavCategory[];
  onOpenMobileMenu?: () => void;
  onToggleCart?: () => void;
  cartCount: number;
  variant?: HeaderAppearance;
  cartTargetRef?: React.Ref<HTMLButtonElement>;
};

const NAVBAR_HEIGHT_MOBILE_CLASS = "h-12";
const NAVBAR_HEIGHT_DESKTOP_CLASS = "md:h-14";

function MenuIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`block ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

function BagIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`block ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 8V7a5 5 0 0 1 10 0v1" />
      <path d="M6 8h12l-1 13H7L6 8Z" />
    </svg>
  );
}

function DesktopDeptTabs({
  orderedDepts,
  initialSlug,
  categoryHref,
}: {
  orderedDepts: NormalizedNavDepartment[];
  initialSlug: string;
  categoryHref: (slug: string, dept?: string) => string;
}) {
  const [activeDeptSlug, setActiveDeptSlug] = useState<string>(initialSlug);
  const [open, setOpen] = useState(false);

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = (delayMs = 160) => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
    }, delayMs);
  };

  useEffect(() => {
    if (!orderedDepts.length) return;

    const hasActive = orderedDepts.some((dept) => dept.slug === activeDeptSlug);
    if (!hasActive && initialSlug) {
      setActiveDeptSlug(initialSlug);
    }
  }, [initialSlug, activeDeptSlug, orderedDepts]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, []);

  const activeDept = orderedDepts.find((d) => d.slug === activeDeptSlug) || orderedDepts[0];

  const cats = activeDept?.categories ?? [];

  return (
    <div
      className="relative pb-1"
      onMouseEnter={() => {
        clearCloseTimer();
        setOpen(true);
      }}
      onMouseMove={() => {
        // If the user crosses the buffer area, keep it open.
        clearCloseTimer();
      }}
      onMouseLeave={() => {
        // Delay close to allow crossing into the dropdown
        scheduleClose(260);
      }}
      onBlur={(e) => {
        // Close only when focus leaves the whole component
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          clearCloseTimer();
          setOpen(false);
        }
      }}
    >
      {/* Tabs */}
      <div className="flex items-center gap-7 font-ui xl:gap-8">
        {orderedDepts.map((d) => {
          const isActive = d.slug === activeDeptSlug;
          return (
            <button
              key={d.slug}
              type="button"
              onMouseEnter={() => {
                clearCloseTimer();
                setActiveDeptSlug(d.slug);
                setOpen(true);
              }}
              onFocus={() => {
                clearCloseTimer();
                setActiveDeptSlug(d.slug);
                setOpen(true);
              }}
              onClick={() => {
                // Keep click for accessibility / touch devices
                clearCloseTimer();
                setActiveDeptSlug(d.slug);
                setOpen(true);
              }}
              className={`type-brand transition-colors duration-200 ${isActive ? "text-current" : "text-current/80 hover:text-current"}`}
              aria-pressed={isActive}
            >
              {d.name}
            </button>
          );
        })}
      </div>

      {/* Dropdown */}
      {open ? (
        <div
          className="absolute left-0 top-full z-[90] w-72 rounded-2xl border border-zinc-900/8 bg-white p-2 text-zinc-900 shadow-[0_18px_42px_rgba(24,24,27,0.12)]"
          onMouseEnter={() => {
            clearCloseTimer();
            setOpen(true);
          }}
          onMouseLeave={() => {
            scheduleClose();
          }}
        >
          <div className="px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            {activeDept?.name}
          </div>
          <ul className="max-h-[65vh] overflow-auto py-1">
            {cats.length > 0 ? (
              cats.map((c) => (
                <li key={String(c.id ?? c.slug)}>
                  <Link
                    href={categoryHref(c.slug, activeDeptSlug)}
                    className="type-card-title block rounded-xl px-3 py-2 text-zinc-800 transition-colors duration-200 hover:bg-zinc-900/4 hover:text-zinc-950"
                  >
                    {c.name}
                  </Link>
                </li>
              ))
            ) : (
              <li className="type-ui-label px-3 py-3 text-zinc-500">Menú no disponible.</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default function Navbar({
  variant = "solid-internal",
  navDepartments,
  categories = [],
  onOpenMobileMenu = () => {},
  onToggleCart = () => {},
  cartCount,
  cartTargetRef,
}: NavbarProps) {
  // Única fuente de verdad de rutas
  const categoryHref = (slug: string, dept?: string) => categoryPath(slug, dept);

  const appearance = variant;
  const isOverlayHome = appearance === "overlay-home";
  const isOverlayPdp = appearance === "overlay-pdp";
  const isSolidInternal = appearance === "solid-internal";
  const isOverlay = isOverlayHome || isOverlayPdp;
  const showDesktopTabs = false;

  const rootText = isOverlay ? "text-white" : "text-zinc-900";

  const iconBtnClass = `relative z-20 pointer-events-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 leading-none ${
    isOverlay
      ? "text-white hover:bg-white/10 hover:text-white focus-visible:ring-white/30"
      : "text-zinc-700 hover:bg-zinc-900/5 hover:text-zinc-950 focus-visible:ring-zinc-900/15"
  }`;

  const desktopNavClass = `${showDesktopTabs ? "hidden md:flex" : "hidden"} items-center gap-6 pr-4 ${
    isOverlay ? "text-white" : "text-zinc-700"
  }`;

  const linkClass = `type-brand transition-colors duration-200 ${
    isOverlay ? "text-white hover:text-white" : "text-zinc-600 hover:text-zinc-950"
  }`;

  const brandClass = `type-brand relative z-10 justify-self-center tracking-[0.16em] transition-colors duration-200 ${
    isOverlay ? "text-white" : "text-zinc-950"
  }`;

  const cartBtnClass = `relative z-20 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-1.5 transition-colors duration-200 leading-none pointer-events-auto ${
    isOverlay
      ? "text-white hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/30"
      : "text-zinc-700 hover:bg-zinc-900/5 hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-zinc-900/15"
  }`;

  const cartBadgeClass = `type-ui-label pointer-events-none absolute -right-0.5 -top-0.5 z-10 select-none ${
    isOverlay ? "text-white" : "text-zinc-950"
  }`;

  const orderedDepts = Array.isArray(navDepartments)
    ? navDepartments.filter((dept) => Array.isArray(dept.categories) && dept.categories.length > 0)
    : [];

  const orderedLegacyCategories = Array.isArray(categories) ? categories.slice(0, 6) : [];

  const initialSlug =
    orderedDepts.find((d) => d.slug === "mujer")?.slug ||
    orderedDepts.find((d) => d.slug === "hombre")?.slug ||
    orderedDepts[0]?.slug ||
    "";

  return (
    <div
      className={`mx-auto grid ${NAVBAR_HEIGHT_MOBILE_CLASS} ${NAVBAR_HEIGHT_DESKTOP_CLASS} w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-4 md:px-6 transition-[color] duration-300 ${rootText}`}
      data-appearance={appearance}
      data-overlay-home={isOverlayHome ? "true" : "false"}
      data-overlay-pdp={isOverlayPdp ? "true" : "false"}
      data-solid-internal={isSolidInternal ? "true" : "false"}
      data-layout-role="navbar"
      data-height-source="header"
    >
      {/* Left: hamburger + desktop categories */}
      <div className="flex min-w-0 items-center justify-self-start overflow-visible">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof onOpenMobileMenu === "function") onOpenMobileMenu();
          }}
          className={iconBtnClass}
          aria-label="Abrir menú"
          aria-controls="mobile-menu"
          data-testid="mobile-menu-button"
        >
          <MenuIcon className="h-6 w-6" />
        </button>

        <nav className={desktopNavClass} aria-label="Categorías">
          {orderedDepts.length > 0 ? (
            <DesktopDeptTabs
              orderedDepts={orderedDepts}
              initialSlug={initialSlug}
              categoryHref={categoryHref}
            />
          ) : (
            orderedLegacyCategories.map((c) => (
              <Link key={String(c.id ?? c.slug)} href={categoryHref(c.slug)} className={linkClass}>
                {c.name}
              </Link>
            ))
          )}
        </nav>
      </div>

      {/* Center: brand */}
      <Link href="/" className={brandClass} aria-label="Ir al inicio">
        Kame.col
      </Link>

      {/* Right: cart */}
      <div className="flex min-w-0 items-center justify-self-end overflow-visible">
        <button
          ref={cartTargetRef}
          type="button"
          onClick={() => {
            if (typeof onToggleCart === "function") onToggleCart();
          }}
          className={cartBtnClass}
          aria-label="Ver carrito"
          data-cart-target="true"
        >
          <BagIcon className="h-6 w-6" />
          {cartCount > 0 && (
            <span
              className={cartBadgeClass}
              aria-label={`Productos en el carrito: ${cartCount > 99 ? "99+" : cartCount}`}
            >
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
