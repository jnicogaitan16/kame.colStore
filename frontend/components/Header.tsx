"use client";

import { useEffect, useState } from "react";
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

  const [mobileOpen, setMobileOpen] = useState(false);

  // Cierra el drawer al cambiar de ruta
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Escape para cerrar
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const categoryHref = (slug: string) => `/categoria/${slug}`;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:h-16">
        {/* Brand */}
        <div className="flex items-center gap-3">
          {/* Hamburguesa (mobile) */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 md:hidden"
            aria-label="Abrir menú"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <Link
            href="/"
            className="text-lg font-semibold text-slate-800 md:text-xl"
          >
            Kame.col
          </Link>
        </div>

        {/* Categorías (desktop) */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Categorías">
          {categories?.length > 0 ? (
            categories.map((c) => (
              <Link
                key={String(c.id ?? c.slug)}
                href={categoryHref(c.slug)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {c.name}
              </Link>
            ))
          ) : (
            <span className="text-sm text-slate-500">Categorías</span>
          )}
        </nav>

        {/* Acciones (derecha) */}
        <div className="flex items-center gap-3">
          {/* Carrito */}
          <button
            type="button"
            onClick={toggleCart}
            className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Ver carrito"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            {totalItems > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-xs font-medium text-white">
                {totalItems > 99 ? "99+" : totalItems}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" aria-hidden={!mobileOpen}>
          {/* Overlay */}
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          />

          {/* Panel */}
          <div className="absolute left-0 top-0 h-full w-[85%] max-w-sm bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <Link
                href="/"
                className="text-base font-semibold text-slate-800"
              >
                Kame.col
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Cerrar menú"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <nav className="p-2" aria-label="Categorías mobile">
              {categories?.length > 0 ? (
                <ul className="space-y-1">
                  {categories.map((c) => (
                    <li key={String(c.id ?? c.slug)}>
                      <Link
                        href={categoryHref(c.slug)}
                        className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-3 py-2 text-sm text-slate-500">
                  Sin categorías por ahora.
                </div>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
