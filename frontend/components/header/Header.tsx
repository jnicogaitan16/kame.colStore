"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCartStore } from "@/store/cart";

export type HeaderCategory = {
  id: number | string;
  name: string;
  slug: string;
};

type HeaderProps = {
  /**
   * Categorías vienen desde un Server Component (layout/page) para no romper App Router.
   * Ej: const categories = await getCategories(); <Header categories={categories} />
   */
  categories?: HeaderCategory[];
};

export function Header({ categories = [] }: HeaderProps) {
  const pathname = usePathname();

  const totalItems = useCartStore((s) => s.totalItems());
  const toggleCart = useCartStore((s) => s.toggleCart);

  const [mobileRendered, setMobileRendered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const openMobileMenu = () => {
    setMobileRendered(true);
    // allow first paint so transitions run
    requestAnimationFrame(() => setMobileOpen(true));
  };

  const closeMobileMenu = () => {
    setMobileOpen(false);
    // keep in DOM until animation finishes
    window.setTimeout(() => setMobileRendered(false), 220);
  };

  const prevPathnameRef = useRef(pathname);

  // Cierra el drawer SOLO al cambiar de ruta (no al abrir)
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      closeMobileMenu();
    }
  }, [pathname]);

  // Escape para cerrar
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileMenu();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  // Lock scroll cuando el menú está abierto
  useEffect(() => {
    if (!mobileRendered) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileRendered]);

  const categoryHref = (slug: string) => `/categoria/${slug}`;

  return (
    <header
      className="sticky top-0 z-50 bg-white/70 border-b border-white/20 shadow-sm will-change-transform"
      style={{ backdropFilter: "blur(12px) saturate(150%)" }}
    >
      <div className="mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 md:h-16">
        {/* Left: hamburguesa Skeleton */}
        <div className="flex items-center justify-self-start">
          <button
            type="button"
            onClick={openMobileMenu}
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            aria-label="Abrir menú"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>

          {/* Desktop categories (Skeleton-like) */}
          <nav
            className="hidden md:flex items-center gap-6 pr-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-900/80"
            aria-label="Categorías"
          >
            {categories?.slice(0, 6).map((c) => (
              <Link
                key={String(c.id ?? c.slug)}
                href={categoryHref(c.slug)}
                className="hover:text-slate-900"
              >
                {c.name}
              </Link>
            ))}
          </nav>
        </div>

        {/* Center: marca centrada real */}
        <Link
          href="/"
          className="justify-self-center text-base font-extrabold uppercase tracking-[0.22em] text-slate-900 md:text-lg"
          aria-label="Ir al inicio"
        >
          Kame.col
        </Link>

        {/* Right: acciones */}
        <div className="flex items-center gap-3 justify-self-end">
          {/* Carrito */}
          <button
            type="button"
            onClick={toggleCart}
            className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Ver carrito"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M7 8V7a5 5 0 0 1 10 0v1"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M6 8h12l-1 13H7L6 8Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {totalItems > 0 && (
              <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full border border-slate-200 bg-white px-1 text-[11px] font-semibold leading-[18px] text-slate-900">
                {totalItems > 99 ? "99+" : totalItems}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu (iOS Notification Center / liquid glass) */}
      {mobileRendered && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[calc(env(safe-area-inset-top)+16px)] md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menú"
        >
          {/* Overlay (liquid glass) */}
          <button
            type="button"
            className={`absolute inset-0 transition-[opacity,backdrop-filter] duration-200 ease-out ${
              mobileOpen
                ? "pointer-events-auto bg-black/65 opacity-100 backdrop-blur-[22px]"
                : "pointer-events-none bg-transparent opacity-0 backdrop-blur-0"
            }`}
            onClick={closeMobileMenu}
            aria-label="Cerrar menú"
          />

          {/* Panel */}
          <div
            className={`relative w-full max-w-[420px] overflow-hidden rounded-[28px] border border-white/15 bg-slate-950/75 shadow-[0_28px_80px_rgba(0,0,0,0.65)] ring-1 ring-white/10 backdrop-blur-[60px] backdrop-saturate-[180%] transition-[opacity,transform] duration-200 ease-out ${
              mobileOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-2 scale-[0.98]"
            }`}
          >
            {/* Diffusion layer: blocks background text bleed */}
            <div className="pointer-events-none absolute inset-0 bg-slate-950/45" />

            {/* Glass highlight: subtle top glow like iOS */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0)_60%)]" />

            {/* Grain: tiny pattern to sell distortion (no asset needed) */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay bg-[linear-gradient(0deg,rgba(255,255,255,0.35),rgba(255,255,255,0.35)),repeating-linear-gradient(90deg,rgba(255,255,255,0.10)_0px,rgba(255,255,255,0.10)_1px,rgba(255,255,255,0)_3px,rgba(255,255,255,0)_6px)]" />

            <div className="relative z-10 px-5 py-4">
              <Link
                href="/"
                className="block text-center text-[15px] font-semibold tracking-wide text-white"
                onClick={closeMobileMenu}
              >
                Kame.col
              </Link>

              <button
                type="button"
                onClick={closeMobileMenu}
                className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 hover:bg-white/15"
                aria-label="Cerrar menú"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M6 18L18 6M6 6l12 12"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <nav className="relative z-10 px-3 pb-4 text-center" aria-label="Categorías mobile">
              {categories?.length > 0 ? (
                <ul className="overflow-hidden rounded-2xl border border-white/12 bg-white/12">
                  {categories.map((c) => (
                    <li key={String(c.id ?? c.slug)}>
                      <Link
                        href={categoryHref(c.slug)}
                        onClick={closeMobileMenu}
                        className="block w-full px-5 py-4 text-[15px] font-semibold tracking-wide text-white/90 hover:bg-white/10"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-5 py-8 text-[15px] font-medium text-white/70">Sin categorías por ahora.</div>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

export default Header;