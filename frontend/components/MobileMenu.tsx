"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

type Category = { id: number; name: string; slug: string; dept_slug?: string | null };

type Department = {
  slug: "hombre" | "mujer" | "accesorios" | string;
  name: string;
};

type Props = {
  // Backward compatible: if you only pass `categories`, the menu behaves like before.
  categories: Category[];
  // When provided, the menu requires selecting a department before listing categories.
  departments?: Department[];
};

export default function MobileMenu({ categories, departments }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeDeptSlug, setActiveDeptSlug] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Helper to close and reset department selection
  const handleClose = () => {
    setOpen(false);
    setActiveDeptSlug(null);
  };

  const hasDepartments = Array.isArray(departments) && departments.length > 0;

  const selectedCategories = hasDepartments
    ? categories.filter((c) => (c.dept_slug ?? null) === activeDeptSlug)
    : categories;

  return (
    <>
      <button
        className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded border"
        aria-label="Abrir menú"
        onClick={() => setOpen(true)}
      >
        ☰
      </button>

      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 p-6"
              onClick={handleClose}
            >
              {/* Botón cerrar (esquina superior derecha) */}
              <button
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/30 bg-black/50 text-white"
                aria-label="Cerrar menú"
                onClick={handleClose}
              >
                ✕
              </button>

              {/* Panel centrado (con scroll si hace falta) */}
              <div
                className="relative w-full max-w-[420px] overflow-hidden rounded-2xl drawer-glass transition-[opacity,transform] duration-200 ease-out"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="max-h-[80vh] overflow-y-auto px-6 py-10">
                  {/* Department selector (only when provided) */}
                  {hasDepartments ? (
                    <div className="mb-8">
                      <div className="flex items-center justify-center gap-2">
                        {departments!.map((d) => {
                          const isActive = d.slug === activeDeptSlug;
                          return (
                            <button
                              key={d.slug}
                              type="button"
                              onClick={() => setActiveDeptSlug(d.slug)}
                              className={
                                "viewer-glass inline-flex h-9 items-center justify-center rounded-full px-4 text-[12px] font-semibold tracking-widest transition " +
                                (isActive
                                  ? " text-white"
                                  : " text-white/70 hover:text-white")
                              }
                              aria-pressed={isActive}
                            >
                              {String(d.name).toUpperCase()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Categories */}
                  {hasDepartments ? (
                    activeDeptSlug === null ? (
                      <div className="px-2 py-6 text-center text-white/70">
                        <p className="text-sm">Selecciona un departamento para ver categorías.</p>

                        {/* Optional lightweight skeleton */}
                        <div className="mt-6 space-y-3">
                          <div className="h-4 w-40 rounded bg-white/10" />
                          <div className="h-4 w-56 rounded bg-white/10" />
                          <div className="h-4 w-48 rounded bg-white/10" />
                        </div>
                      </div>
                    ) : (
                      <nav
                        className="flex flex-col items-center gap-6 text-center text-lg font-semibold tracking-widest text-white"
                        aria-label="Categorías"
                      >
                        {selectedCategories.length ? (
                          selectedCategories.map((c) => (
                            <Link
                              key={c.id}
                              href={`/categoria/${c.slug}`}
                              onClick={handleClose}
                              className="hover:opacity-80"
                            >
                              {String(c.name).toUpperCase()}
                            </Link>
                          ))
                        ) : (
                          <p className="text-sm text-white/70">No hay categorías para este departamento.</p>
                        )}
                      </nav>
                    )
                  ) : (
                    <nav
                      className="flex flex-col items-center gap-6 text-center text-lg font-semibold tracking-widest text-white"
                      aria-label="Categorías"
                    >
                      {categories.map((c) => (
                        <Link
                          key={c.id}
                          href={`/categoria/${c.slug}`}
                          onClick={handleClose}
                          className="hover:opacity-80"
                        >
                          {String(c.name).toUpperCase()}
                        </Link>
                      ))}
                    </nav>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
