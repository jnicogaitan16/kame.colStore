"use client";

import Link from "next/link";
import { categoryPath } from "@/lib/routes";
import { useEffect, useMemo, useState } from "react";

export type MobileMenuCategory = {
  id: number | string;
  name: string;
  slug: string;
  // Optional fields used only for legacy flat category lists
  department_id?: number;
  parent_id?: number | null;
  sort_order?: number;
};

export type MobileMenuNavDepartment = {
  id: number;
  name: string;
  slug: string;
  sort_order?: number;
  categories: Array<{
    id: number | string;
    name: string;
    slug: string;
    sort_order?: number;
  }>;
};

export type MobileMenuProps = {
  /** Preferred: Navigation departments (from GET /api/navigation/) */
  navDepartments?: MobileMenuNavDepartment[];

  /** Legacy fallback: flat categories list (will render as plain list if nav is missing) */
  categories?: MobileMenuCategory[];

  /** Controls whether the component exists in the DOM (used to keep mounted during exit animation). */
  rendered?: boolean;
  /** Visual open state (used to drive transitions). */
  open?: boolean;
  /** Close handler (backdrop + X + link clicks). */
  onClose: () => void;
  /** Brand label shown at the top. */
  brandLabel?: string;

  /** Default active dept for tabs (KOAJ-like). */
  defaultDeptSlug?: "mujer" | "hombre" | string;
};

export default function MobileMenu({
  navDepartments,
  categories,
  rendered = true,
  open = false,
  onClose,
  brandLabel = "Kame.col",
  defaultDeptSlug = "mujer",
}: MobileMenuProps) {
  // `rendered` can be omitted by callers; only hide when explicitly false.
  if (rendered === false) return null;

  const navDepts: MobileMenuNavDepartment[] = Array.isArray(navDepartments)
    ? navDepartments
    : [];

  const legacyCats: MobileMenuCategory[] = Array.isArray(categories)
    ? categories
    : [];

  const isOpen = open === true;

  const orderedNavDepartments = useMemo(() => {
    return [...navDepts].sort((a, b) => {
      const ao = typeof a.sort_order === "number" ? a.sort_order : 0;
      const bo = typeof b.sort_order === "number" ? b.sort_order : 0;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name);
    });
  }, [navDepts]);

  const [activeDeptSlug, setActiveDeptSlug] = useState<string>(defaultDeptSlug);

  useEffect(() => {
    // When menu opens or nav changes, ensure active dept is valid.
    if (!isOpen) return;
    const slugs = orderedNavDepartments.map((d) => d.slug).filter(Boolean);
    if (slugs.length === 0) return;

    if (!slugs.includes(activeDeptSlug)) {
      // Prefer default dept if present, otherwise first.
      const preferred = slugs.includes(defaultDeptSlug) ? defaultDeptSlug : slugs[0];
      setActiveDeptSlug(preferred);
    }
  }, [isOpen, orderedNavDepartments, activeDeptSlug, defaultDeptSlug]);

  const activeDept = orderedNavDepartments.find((d) => d.slug === activeDeptSlug) || null;

  const orderedActiveCategories = useMemo(() => {
    const cats = Array.isArray(activeDept?.categories) ? activeDept!.categories : [];
    return [...cats].sort((a, b) => {
      const ao = typeof a.sort_order === "number" ? a.sort_order : 0;
      const bo = typeof b.sort_order === "number" ? b.sort_order : 0;
      if (ao !== bo) return ao - bo;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [activeDept]);

  const orderedLegacyCategories = useMemo(() => {
    return [...legacyCats].sort((a, b) => {
      const ao = typeof a.sort_order === "number" ? a.sort_order : 0;
      const bo = typeof b.sort_order === "number" ? b.sort_order : 0;
      if (ao !== bo) return ao - bo;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [legacyCats]);

  const renderCategoryLink = (node: { id: number | string; name: string; slug: string }) => {
    return (
      <li key={String(node.id ?? node.slug)}>
        <Link
          href={categoryPath(node.slug)}
          onClick={onClose}
          className="block w-full rounded-2xl px-5 py-3 text-[15px] font-semibold tracking-wide text-white/90 transition hover:bg-white/5"
        >
          {node.name}
        </Link>
      </li>
    );
  };

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
          isOpen
            ? "pointer-events-auto bg-black/70 opacity-100 backdrop-blur-[22px]"
            : "pointer-events-none bg-transparent opacity-0 backdrop-blur-0"
        }`}
        onClick={onClose}
        aria-label="Cerrar menú"
      />

      {/* Panel */}
      <div
        className={`relative w-full max-w-[420px] overflow-hidden rounded-[28px] border border-white/10 bg-neutral-950/85 shadow-[0_28px_80px_rgba(0,0,0,0.65)] ring-1 ring-white/10 backdrop-blur-[60px] backdrop-saturate-[180%] transition-[opacity,transform] duration-200 ease-out ${
          isOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-2 scale-[0.98]"
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
          {orderedNavDepartments.length > 0 ? (
            <div className="space-y-4">
              {/* Tabs: Mujer / Hombre (or whatever depts exist) */}
              <div className="flex items-center justify-center gap-2 px-2">
                {orderedNavDepartments.map((d) => {
                  const isActive = d.slug === activeDeptSlug;
                  return (
                    <button
                      key={d.slug}
                      type="button"
                      onClick={() => setActiveDeptSlug(d.slug)}
                      className={`rounded-full border px-4 py-2 text-[13px] font-semibold tracking-wide transition ${
                        isActive
                          ? "border-white/20 bg-white/10 text-white"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                      }`}
                      aria-pressed={isActive}
                    >
                      {d.name}
                    </button>
                  );
                })}
              </div>

              {/* Active dept categories */}
              <ul className="space-y-2 px-2">
                {orderedActiveCategories.length > 0 ? (
                  orderedActiveCategories.map((c) => renderCategoryLink(c))
                ) : (
                  <li className="px-5 py-6 text-[15px] font-medium text-white/70">Menú no disponible.</li>
                )}
              </ul>
            </div>
          ) : orderedLegacyCategories.length > 0 ? (
            <div className="space-y-3">
              <div className="px-5 pb-1 pt-1 text-left text-[12px] font-semibold uppercase tracking-[0.14em] text-white/60">
                Categorías
              </div>
              <ul className="space-y-2 px-2">
                {orderedLegacyCategories.map((c) => renderCategoryLink(c))}
              </ul>
            </div>
          ) : (
            <div className="px-5 py-8 text-[15px] font-medium text-white/70">Menú no disponible.</div>
          )}
        </nav>
      </div>
    </div>
  );
}
