"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

import Navbar from "./Navbar";
import MobileMenuContent from "./MobileMenuContent";
import MiniCart from "@/components/cart/MiniCart";
import DrawerShell from "@/components/drawer/DrawerShell";
import { useCartStore } from "@/store/cart";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useHorizontalDrawerDrag } from "@/hooks/useHorizontalDrawerDrag";
import type {
  NormalizedNavCategory,
  NormalizedNavDepartment,
} from "../../lib/navigation-normalize";

type HeaderProps = {
  categories?: NormalizedNavCategory[];
  navDepartments?: NormalizedNavDepartment[];
  cartCount?: number;
};


export default function Header({
  categories = [],
  navDepartments = [],
  cartCount = 0,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const storeCartOpen = useCartStore((s) => s.isOpen);
  const closeCart = useCartStore((s) => s.closeCart);
  const toggleCart = useCartStore((s) => s.toggleCart);

  useBodyScrollLock(mobileMenuOpen || storeCartOpen);

  const {
    panelRef,
    isDragging,
    backdropOpacity,
    translateX,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    resetDragState,
  } = useHorizontalDrawerDrag({
    isOpen: mobileMenuOpen,
    onClose: () => setMobileMenuOpen(false),
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const cartItems = useCartStore((s) => s.items);

  const storeCartCount = useMemo(() => {
    return cartItems.reduce((total, item) => {
      const quantity = Number(item?.quantity ?? 0);
      return total + (Number.isFinite(quantity) ? Math.max(0, quantity) : 0);
    }, 0);
  }, [cartItems]);

  const effectiveCartCount = useMemo(() => {
    const externalCount = Number.isFinite(cartCount) ? Math.max(0, cartCount) : 0;
    const internalCount = Number.isFinite(storeCartCount) ? Math.max(0, storeCartCount) : 0;

    return Math.max(externalCount, internalCount);
  }, [cartCount, storeCartCount]);

  const handleCloseMobileMenu = useCallback(() => {
    resetDragState();
    setMobileMenuOpen(false);
  }, [resetDragState]);

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-[80]">
        <header
          className={[
            "site-header transition-colors duration-300",
            isScrolled
              ? "border-white/10 bg-zinc-950/45 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-2xl backdrop-saturate-150"
              : "border-transparent bg-black",
          ].join(" ")}
          data-scrolled={isScrolled ? "true" : "false"}
          data-mobile-menu-open={mobileMenuOpen ? "true" : "false"}
          data-cart-open={storeCartOpen ? "true" : "false"}
          style={
            isScrolled
              ? {
                  WebkitBackdropFilter: "blur(18px) saturate(1.4)",
                  backdropFilter: "blur(18px) saturate(1.4)",
                }
              : undefined
          }
        >
          <Navbar
            categories={categories}
            navDepartments={navDepartments}
            cartCount={effectiveCartCount}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            onToggleCart={toggleCart}
            isScrolled={isScrolled}
          />
        </header>
      </div>


      <DrawerShell
        isOpen={mobileMenuOpen}
        side="left"
        panelRef={panelRef}
        isDragging={isDragging}
        backdropOpacity={backdropOpacity}
        translateX={translateX}
        onClose={handleCloseMobileMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        <MobileMenuContent
          navDepartments={navDepartments}
          categories={categories}
          isOpen={mobileMenuOpen}
          onNavigate={handleCloseMobileMenu}
        />
      </DrawerShell>

      <MiniCart open={storeCartOpen} onClose={closeCart} />
    </>
  );
}