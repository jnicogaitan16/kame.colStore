"use client";

import { useEffect, useMemo, useRef } from "react";
import type { SizeGuide, SizeGuideKey } from "@/components/product/sizeGuideData";
import { sizeGuides } from "@/components/product/sizeGuideData";

type Props = {
  open: boolean;
  onClose: () => void;
  guideKey?: string;
};

function isSizeGuideKey(k: string): k is SizeGuideKey {
  return k in sizeGuides;
}

export default function SizeGuideDrawer({ open, onClose, guideKey = "oversize" }: Props) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const resolvedKey = useMemo<SizeGuideKey>(() => {
    if (isSizeGuideKey(guideKey)) return guideKey;
    return "oversize";
  }, [guideKey]);

  const guide = useMemo<SizeGuide>(() => sizeGuides[resolvedKey], [resolvedKey]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);

    // Lock scroll while dialog is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the close button for basic accessibility
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Keep mounted for animation consistency, but disable interactions when closed.
  const overlayState = open
    ? "opacity-100 pointer-events-auto"
    : "opacity-0 pointer-events-none";

  const panelState = open
    ? "translate-y-0 opacity-100"
    : "translate-y-6 opacity-0";

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${overlayState}`}
      role="dialog"
      aria-modal="true"
      aria-label="Guía de tallas"
      onMouseDown={(e) => {
        // click outside
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[10px]" />

      {/* Panel (sheet from bottom) */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center p-4 md:p-6">
        <div
          className={`w-full max-w-2xl transform transition-all duration-250 ease-out ${panelState} rounded-2xl border border-white/10 bg-black/45 backdrop-blur-[12px] saturate-150 shadow-2xl`}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-neutral-100">
                Guía de tallas
              </p>
              {guide.subtitle ? (
                <p className="mt-1 text-sm text-neutral-400">{guide.subtitle}</p>
              ) : null}
            </div>

            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center text-neutral-300 transition hover:text-white focus:outline-none"
              aria-label="Cerrar"
            >
              <span className="text-xl leading-none">×</span>
            </button>
          </div>

          {/* Content */}
          <div className="px-5 pb-5 pt-4">
            <div className="mb-4">
              <p className="text-sm font-semibold text-neutral-100">{guide.title}</p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    {guide.columns.map((col) => (
                      <th
                        key={col}
                        scope="col"
                        className="sticky top-0 bg-white/5 px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-neutral-300"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guide.rows.length > 0 ? (
                    guide.rows.map((row) => (
                      <tr key={row.size} className="border-t border-white/10">
                        <td className="px-4 py-3 text-sm font-semibold text-neutral-100">
                          {row.size}
                        </td>
                        {row.values.map((v, idx) => (
                          <td key={idx} className="px-4 py-3 text-sm text-neutral-200">
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={guide.columns.length}
                        className="px-4 py-6 text-sm text-neutral-400"
                      >
                        Aún no hay datos para esta guía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-xs text-neutral-500">
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}