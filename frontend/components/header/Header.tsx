"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import Navbar, { NavbarCategory, NavbarNavDepartment } from "./Navbar";
import MiniCart from "@/components/cart/MiniCart";
import { categoryPath } from "@/lib/routes";
import { useCartStore } from "@/store/cart";

export type HeaderProps = {
  navDepartments?: NavbarNavDepartment[];
  categories?: NavbarCategory[];
  cartCount?: number;

  // Optional external control hooks (if parent wants to drive UI)
  onToggleCart?: () => void;
};

function ChevronRight({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function MobileMenuContent({
  navDepartments,
  categories,
  onNavigate,
  isOpen,
}: {
  navDepartments?: NavbarNavDepartment[];
  categories?: NavbarCategory[];
  onNavigate: () => void;
  isOpen: boolean;
}) {
  const orderedDepts = useMemo(() => {
    const depts: NavbarNavDepartment[] = Array.isArray(navDepartments) ? navDepartments : [];
    return [...depts].sort((a, b) => {
      const ao = typeof a.sort_order === "number" ? a.sort_order : 0;
      const bo = typeof b.sort_order === "number" ? b.sort_order : 0;
      if (ao !== bo) return ao - bo;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [navDepartments]);

  const [activeDeptSlug, setActiveDeptSlug] = useState<string | null>(null);

  // Optional reset on close (keeps UX: open -> no selection)
  useEffect(() => {
    if (!isOpen) setActiveDeptSlug(null);
  }, [isOpen]);

  const activeDept = activeDeptSlug ? orderedDepts.find((d) => d.slug === activeDeptSlug) : undefined;

  const deptCategories = useMemo(() => {
    if (!activeDept) return [];
    const raw = Array.isArray(activeDept.categories) ? activeDept.categories : [];
    return [...raw].sort((a, b) => {
      const ao = typeof a.sort_order === "number" ? a.sort_order : 0;
      const bo = typeof b.sort_order === "number" ? b.sort_order : 0;
      if (ao !== bo) return ao - bo;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [activeDept]);

  const flatCategories = useMemo(() => {
    const raw = Array.isArray(categories) ? categories : [];
    return [...raw].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [categories]);

  // Única fuente de verdad de rutas
  const categoryHref = (slug: string) => categoryPath(slug, activeDeptSlug ?? undefined);

  const showDeptNav = orderedDepts.length > 0;
  const showList = showDeptNav ? (activeDeptSlug ? deptCategories : []) : flatCategories;

  return (
    <div className="px-4 pb-6">
      {/* Tabs: Mujer / Hombre / ... */}
      {showDeptNav ? (
        <div className="flex items-center gap-6 border-b border-white/10 pb-3 pt-2 font-ui">
          {orderedDepts.map((d) => {
            const isActive = d.slug === activeDeptSlug;
            return (
              <button
                key={d.slug}
                type="button"
                onClick={() => setActiveDeptSlug(d.slug)}
                className={
                  isActive
                    ? "type-action text-white"
                    : "type-action text-white/60 hover:text-white/90"
                }
                aria-pressed={isActive}
              >
                {d.name}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Categories */}
      <ul className="pt-3">
        {showList.length > 0 ? (
          showList.map((c) => (
            <li key={String((c as any).id ?? (c as any).slug)}>
              <Link
                href={categoryHref((c as any).slug)}
                onClick={onNavigate}
                className="type-secondary flex items-center justify-between py-3 text-white/90"
              >
                <span>{(c as any).name}</span>
                <ChevronRight className="h-5 w-5 text-white/40" />
              </Link>
              <div className="h-px bg-white/10" />
            </li>
          ))
        ) : (
          <li className="type-secondary py-3 text-white/70">
            {showDeptNav ? "Selecciona una sección para ver categorías." : "Menú no disponible."}
          </li>
        )}
      </ul>
    </div>
  );
}

export default function Header({
  navDepartments,
  categories,
  cartCount,
  onToggleCart,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const pathname = usePathname();

  useEffect(() => {
    delete document.documentElement.dataset.routeLoading;
  }, [pathname]);

  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const a = target.closest("a") as HTMLAnchorElement | null;
      if (!a) return;

      if (a.target && a.target !== "_self") return;
      if (a.hasAttribute("download")) return;
      if (!a.href) return;

      const url = new URL(a.href);
      if (url.origin !== window.location.origin) return;

      // evita hash-only
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      // activa overlay inmediatamente en la página actual
      document.documentElement.dataset.routeLoading = "1";
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, []);

  // Source of truth for the bag badge: total items (sum of quantities)
  const storeCartCount = useCartStore((s) =>
    Array.isArray((s as any).items)
      ? (s as any).items.reduce((acc: number, it: any) => acc + Number(it?.quantity || 0), 0)
      : 0
  );

  // Backwards compatibility: if a parent passes `cartCount`, we still prefer the store (it reflects quantity, not lines)
  const effectiveCartCount = typeof cartCount === "number" ? Math.max(cartCount, storeCartCount) : storeCartCount;

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      // Small threshold so it changes quickly but avoids jitter.
      setIsScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isCartOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isCartOpen]);

  // Close mobile menu on route changes? If you have next/navigation, you can wire it.
  // Keeping it minimal: only close on ESC.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Close cart first if open; otherwise close mobile menu.
      if (isCartOpen) setIsCartOpen(false);
      else setMobileMenuOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isCartOpen]);

  const handleOpenMobileMenu = useMemo(() => {
    return () => setMobileMenuOpen(true);
  }, []);

  const handleCloseMobileMenu = useMemo(() => {
    return () => setMobileMenuOpen(false);
  }, []);

  const handleToggleCart = useCallback(() => {
    // If parent controls cart, delegate. Otherwise open local drawer.
    if (typeof onToggleCart === "function") {
      onToggleCart();
      return;
    }
    setIsCartOpen(true);
  }, [onToggleCart]);

  const handleCloseCart = useCallback(() => setIsCartOpen(false), []);

  return (
    <header className="fixed left-0 right-0 top-0 z-[80]">
      {/*
        Background strip:
        - Top of page: solid black
        - Scrolled: translucent + blur (liquid glass)
      */}
      <div
        className={
          "w-full border-b transition-all duration-300 " +
          (isScrolled
            ? "border-white/10 bg-zinc-950/45 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-2xl backdrop-saturate-150"
            : "border-transparent bg-black")
        }
        style={
          isScrolled
            ? {
                WebkitBackdropFilter: "blur(18px) saturate(1.4)",
                backdropFilter: "blur(18px) saturate(1.4)",
              }
            : undefined
        }
      >
        {/* Cart badge styling is handled inside Navbar.tsx */}
        <Navbar
          variant="nav"
          navDepartments={navDepartments}
          categories={categories}
          cartCount={effectiveCartCount}
          onOpenMobileMenu={handleOpenMobileMenu}
          onToggleCart={handleToggleCart}
        />
      </div>

      {/* Spacer so the fixed header doesn't cover the page content */}
      <div aria-hidden className="h-12 md:h-14" />

      {/*
        Mobile menu container.
        If you already have a MobileMenu component, replace this block with it.
        Contract:
          - Show when `mobileMenuOpen` is true.
          - Provide a close button that calls `handleCloseMobileMenu`.
          - The element id must match Navbar aria-controls="mobile-menu".
      */}
      {mobileMenuOpen ? (
        <div id="mobile-menu" className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Cerrar menú"
            onClick={handleCloseMobileMenu}
          />

          {/* Panel */}
          <div className="absolute left-0 top-0 h-full w-[86%] max-w-[360px] drawer-glass border-r border-white/10">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 pt-4">
              <div className="type-brand text-white">Kame.col</div>
              <button
                type="button"
                onClick={handleCloseMobileMenu}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            {/* Tabs + list */}
            <MobileMenuContent
              navDepartments={navDepartments}
              categories={categories}
              onNavigate={handleCloseMobileMenu}
              isOpen={mobileMenuOpen}
            />
          </div>
        </div>
      ) : null}

      {/* MiniCart drawer (always mounted; controlled via state) */}
      <MiniCart open={isCartOpen} onClose={handleCloseCart} />
    </header>
  );
}