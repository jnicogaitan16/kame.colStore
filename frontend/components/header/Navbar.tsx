"use client";

import Link from "next/link";

export type NavbarCategory = {
  id: number | string;
  name: string;
  slug: string;
};

export type NavbarProps = {
  categories: NavbarCategory[];
  onOpenMobileMenu: () => void;
  onToggleCart: () => void;
  cartCount: number;
  variant?: "overlay" | "nav";
};

function MenuIcon({ className = "" }: { className?: string }) {
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
      className={className}
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

export default function Navbar({
  variant = "nav",
  categories,
  onOpenMobileMenu,
  onToggleCart,
  cartCount,
}: NavbarProps) {
  // Keep routing contract used across the app
  const categoryHref = (slug: string) => `/categoria/${slug}`;

  const isOverlay = variant === "overlay";

  const rootText = isOverlay ? "text-white" : "text-zinc-100";

  const iconBtnClass = isOverlay
    ? "md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-white hover:bg-white/10"
    : "md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-zinc-100 hover:bg-white/5";

  const desktopNavClass = isOverlay
    ? "hidden md:flex items-center gap-6 pr-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/85"
    : "hidden md:flex items-center gap-6 pr-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/80";

  const linkClass = isOverlay ? "hover:text-white/90" : "hover:text-zinc-200";

  const brandClass = "justify-self-center text-base font-extrabold uppercase tracking-[0.22em] text-white md:text-lg";

  const cartBtnClass = isOverlay
    ? "relative rounded-lg p-2 text-white/90 transition hover:bg-white/10 hover:text-white"
    : "relative rounded-lg p-2 text-white/80 transition hover:bg-white/5 hover:text-white";

  return (
    <div className={`mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 md:h-16 ${rootText}`}>
      {/* Left: hamburger + desktop categories */}
      <div className="flex items-center justify-self-start">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className={iconBtnClass}
          aria-label="Abrir menú"
        >
          <MenuIcon className="h-6 w-6" />
        </button>

        <nav
          className={desktopNavClass}
          aria-label="Categorías"
        >
          {categories?.slice(0, 6).map((c) => (
            <Link
              key={String(c.id ?? c.slug)}
              href={categoryHref(c.slug)}
              className={linkClass}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      </div>

      {/* Center: brand */}
      <Link
        href="/"
        className={brandClass}
        aria-label="Ir al inicio"
      >
        Kame.col
      </Link>

      {/* Right: cart */}
      <div className="flex items-center gap-3 justify-self-end">
        <button
          type="button"
          onClick={onToggleCart}
          className={cartBtnClass}
          aria-label="Ver carrito"
        >
          <BagIcon className="h-6 w-6" />
          {cartCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full border border-white/20 bg-white px-1 text-[11px] font-semibold leading-[18px] text-black">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
