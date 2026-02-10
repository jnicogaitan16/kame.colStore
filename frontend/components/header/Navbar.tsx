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
  categories,
  onOpenMobileMenu,
  onToggleCart,
  cartCount,
}: NavbarProps) {
  // Keep routing contract used across the app
  const categoryHref = (slug: string) => `/categoria/${slug}`;

  return (
    <div className="mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 md:h-16">
      {/* Left: hamburger + desktop categories */}
      <div className="flex items-center justify-self-start">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
          aria-label="Abrir menú"
        >
          <MenuIcon className="h-6 w-6" />
        </button>

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

      {/* Center: brand */}
      <Link
        href="/"
        className="justify-self-center text-base font-extrabold uppercase tracking-[0.22em] text-slate-900 md:text-lg"
        aria-label="Ir al inicio"
      >
        Kame.col
      </Link>

      {/* Right: cart */}
      <div className="flex items-center gap-3 justify-self-end">
        <button
          type="button"
          onClick={onToggleCart}
          className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          aria-label="Ver carrito"
        >
          <BagIcon className="h-6 w-6" />
          {cartCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full border border-slate-200 bg-white px-1 text-[11px] font-semibold leading-[18px] text-slate-900">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
