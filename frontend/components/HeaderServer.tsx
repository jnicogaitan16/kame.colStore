import Link from "next/link";
import { getCategories } from "@/lib/api";

import CategoryMenu from "@/components/CategoryMenu";
import MobileMenu from "@/components/MobileMenu";

export default async function HeaderServer() {
  const categories = await getCategories();

  return (
    <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* Left */}
        <div className="flex items-center gap-3">
          <MobileMenu categories={categories} />
          <Link href="/" className="text-lg font-semibold">
            Kame.col
          </Link>
        </div>

        {/* Desktop categories */}
        <div className="hidden md:block">
          <CategoryMenu variant="desktop" />
        </div>

        {/* Right icons (placeholder) */}
        <div className="flex items-center gap-3">
          <Link href="/cart" aria-label="Carrito" className="text-sm font-medium">
            🛒
          </Link>
        </div>
      </div>
    </header>
  );
}
