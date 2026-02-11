"use client";

import Link from "next/link";

export type MobileMenuCategory = {
  id: number | string;
  name: string;
  slug: string;
};

export type MobileMenuProps = {
  categories: MobileMenuCategory[];
  /** Controls whether the component exists in the DOM (used to keep mounted during exit animation). */
  rendered: boolean;
  /** Visual open state (used to drive transitions). */
  open: boolean;
  /** Close handler (backdrop + X + link clicks). */
  onClose: () => void;
  /** Brand label shown at the top. */
  brandLabel?: string;
  /** Base path for category links (defaults to /categoria). */
  categoryBasePath?: string;
};

export default function MobileMenu({
  categories,
  rendered,
  open,
  onClose,
  brandLabel = "Kame.col",
  categoryBasePath = "/categoria",
}: MobileMenuProps) {
  if (!rendered) return null;

  return (
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
          open
            ? "pointer-events-auto bg-black/70 opacity-100 backdrop-blur-[22px]"
            : "pointer-events-none bg-transparent opacity-0 backdrop-blur-0"
        }`}
        onClick={onClose}
        aria-label="Cerrar menú"
      />

      {/* Panel */}
      <div
        className={`relative w-full max-w-[420px] overflow-hidden rounded-[28px] border border-white/10 bg-neutral-950/85 shadow-[0_28px_80px_rgba(0,0,0,0.65)] ring-1 ring-white/10 backdrop-blur-[60px] backdrop-saturate-[180%] transition-[opacity,transform] duration-200 ease-out ${
          open ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-2 scale-[0.98]"
        }`}
      >
        {/* Diffusion layer: blocks background text bleed */}
        <div className="pointer-events-none absolute inset-0 bg-neutral-950/55" />

        {/* Glass highlight: subtle top glow like iOS */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0)_60%)]" />

        {/* Grain: tiny pattern to sell distortion (no asset needed) */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay bg-[linear-gradient(0deg,rgba(255,255,255,0.35),rgba(255,255,255,0.35)),repeating-linear-gradient(90deg,rgba(255,255,255,0.10)_0px,rgba(255,255,255,0.10)_1px,rgba(255,255,255,0)_3px,rgba(255,255,255,0)_6px)]" />

        <div className="relative z-10 px-5 py-4">
          <Link
            href="/"
            className="block text-center text-[15px] font-semibold tracking-wide text-white"
            onClick={onClose}
          >
            {brandLabel}
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
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
            <ul className="space-y-2">
              {categories.map((c) => (
                <li key={String(c.id ?? c.slug)}>
                  <Link
                    href={`${categoryBasePath}/${c.slug}`}
                    onClick={onClose}
                    className="block w-full rounded-2xl px-5 py-4 text-[15px] font-semibold tracking-wide text-white/90 transition hover:bg-white/5"
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
  );
}
