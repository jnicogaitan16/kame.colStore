"use client";

import { useState } from "react";

import Navbar from "./Navbar";
import { useHeaderAppearance } from "./hooks/useHeaderAppearance";
import MobileMenuContent from "./MobileMenuContent";
import MiniCart from "@/components/cart/MiniCart";
import DrawerShell from "@/components/drawer/DrawerShell";
import { useCartStore } from "@/store/cart";

type HeaderProps = {
  categories?: any[];
  navDepartments?: any[];
};

export default function Header({
  categories = [],
  navDepartments = [],
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const cartOpen = useCartStore((s) => s.isOpen);
  const toggleCart = useCartStore((s) => s.toggleCart);
  const closeCart = useCartStore((s) => s.closeCart);
  const cartCount = useCartStore((s) => s.totalItems());
  const { headerAppearance } = useHeaderAppearance();

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-[80] w-full pointer-events-none bg-transparent [background-image:none] shadow-none before:hidden after:hidden">
        <header
          className="site-header header-transition pointer-events-auto bg-transparent [background-image:none] shadow-none before:hidden after:hidden"
          data-appearance={headerAppearance}
        >
          <Navbar
            categories={categories}
            navDepartments={navDepartments}
            cartCount={cartCount}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            onToggleCart={toggleCart}
            variant={headerAppearance}
          />
        </header>
      </div>

      <DrawerShell
        isOpen={mobileMenuOpen}
        side="left"
        onClose={() => setMobileMenuOpen(false)}
      >
        <MobileMenuContent
          navDepartments={navDepartments}
          categories={categories}
          isOpen={mobileMenuOpen}
          onNavigate={() => setMobileMenuOpen(false)}
          variant={headerAppearance}
        />
      </DrawerShell>

      <MiniCart open={cartOpen} onClose={closeCart} />
    </>
  );
}