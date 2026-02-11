"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { useCartStore } from "@/store/cart";

import Navbar from "./Navbar";
import MobileMenu from "@/components/navigation/MobileMenu";

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

  const isHome = pathname === "/";

  const totalItems = useCartStore((s) => s.totalItems());
  const toggleCart = useCartStore((s) => s.toggleCart);

  const [mobileRendered, setMobileRendered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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

  // Header mode: overlay on Home (top), nav elsewhere / after scroll
  useEffect(() => {
    // Outside home: force nav mode
    if (!isHome) {
      setScrolled(true);
      return;
    }

    // On home: listen scroll
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };

    // Init on mount
    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

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

  const headerMode = isHome && !scrolled ? "overlay" : "nav";
  const headerClassName =
    headerMode === "overlay"
      ? "fixed top-0 left-0 z-50 w-full bg-transparent"
      : "fixed top-0 left-0 z-50 w-full bg-zinc-950/70 border-b border-white/10 shadow-sm will-change-transform";

  return (
    <header
      className={headerClassName}
      style={
        headerMode === "nav"
          ? { backdropFilter: "blur(12px) saturate(150%)" }
          : undefined
      }
    >
      <Navbar
        categories={categories}
        onOpenMobileMenu={openMobileMenu}
        onToggleCart={toggleCart}
        cartCount={totalItems}
      />

      <MobileMenu
        categories={categories}
        rendered={mobileRendered}
        open={mobileOpen}
        onClose={closeMobileMenu}
        brandLabel="Kame.col"
        categoryBasePath="/categoria"
      />
    </header>
  );
}

export default Header;