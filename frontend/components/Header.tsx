"use client";

import Link from "next/link";
import { useCartStore } from "@/store/cart";

export function Header() {
  const totalItems = useCartStore((s) => s.totalItems());
  const toggleCart = useCartStore((s) => s.toggleCart);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:h-16">
        <Link
          href="/"
          className="text-lg font-semibold text-slate-800 md:text-xl"
        >
          Kame.col
        </Link>
        <nav className="flex items-center gap-4">
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
        </nav>
      </div>
    </header>
  );
}
