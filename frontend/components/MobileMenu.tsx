"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

type Category = { id: number; name: string; slug: string };

type Props = {
  categories: Category[];
};

export default function MobileMenu({ categories }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

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
              onClick={() => setOpen(false)}
            >
              {/* Botón cerrar (esquina superior derecha) */}
              <button
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/30 bg-black/50 text-white"
                aria-label="Cerrar menú"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>

              {/* Panel centrado (con scroll si hace falta) */}
              <div
                className="w-full max-w-sm max-h-[80vh] overflow-y-auto rounded-xl bg-black/85 px-6 py-10 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <nav
                  className="flex flex-col items-center gap-6 text-center text-lg font-semibold tracking-widest text-white"
                  aria-label="Categorías"
                >
                  {categories.map((c) => (
                    <Link
                      key={c.id}
                      href={`/categoria/${c.slug}`}
                      onClick={() => setOpen(false)}
                      className="hover:opacity-80"
                    >
                      {String(c.name).toUpperCase()}
                    </Link>
                  ))}
                </nav>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
