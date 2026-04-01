"use client";

import { useCallback, useEffect, useRef } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import type { SizeGuide } from "@/types/catalog";

type Props = {
  open: boolean;
  onClose: () => void;
  guide?: SizeGuide | null;
};

export default function SizeGuideDrawer({ open, onClose, guide }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  const y = useMotionValue(0);

  const resetY = useCallback(() => {
    animate(y, 0, { type: "spring", stiffness: 420, damping: 38 });
  }, [y]);

  useEffect(() => {
    if (!open) {
      y.set(0);
      return;
    }

    resetY();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);

    // Lock scroll while dialog is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the panel for basic accessibility
    const t = window.setTimeout(() => panelRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      y.set(0);
    };
  }, [open, onClose, resetY, y]);

  // Keep mounted for animation consistency, but disable interactions when closed.
  const overlayState = open
    ? "opacity-100 pointer-events-auto"
    : "opacity-0 pointer-events-none";

  const panelState = open
    ? "translate-y-0 opacity-100"
    : "translate-y-6 opacity-0";

  const dragThreshold = 120;
  const hasGuide = Boolean(guide);

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${overlayState}`}
      role="dialog"
      aria-modal="true"
      aria-label="Guía de medidas"
    >
      {/* Overlay */}
      <div
        className="sheet-premium-light-backdrop absolute inset-0"
        onClick={onClose}
      />

      {/* Panel (sheet from bottom) */}
      <motion.div
        className="absolute inset-x-0 bottom-0 flex justify-center p-4 md:p-6"
        style={{ y }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.15}
        onClick={(e) => e.stopPropagation()}
        onDragEnd={(_, info) => {
          if (info.offset.y > dragThreshold || info.velocity.y > 800) {
            onClose();
            return;
          }
          resetY();
        }}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          className={`sheet-premium-light w-full max-w-2xl rounded-[28px] transition-opacity duration-250 ease-out ${panelState}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sheet-premium-light-divider border-b px-5 pb-4 pt-3 md:px-6">
            <div className="mb-3 flex justify-center">
              <div className="h-1.5 w-12 rounded-full bg-zinc-950/12" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.08em] text-zinc-950">
                Guía de medidas
              </p>
              {guide?.subtitle ? (
                <p className="mt-1 text-sm text-zinc-500">{guide.subtitle}</p>
              ) : null}
            </div>
          </div>

          {/* Content */}
          <div className="px-5 pb-5 pt-4 md:px-6 md:pb-6">
            <div className="mb-4">
              <p className="text-sm font-semibold text-zinc-950">
                {guide?.title ?? "Guía de medidas"}
              </p>
            </div>

            {/* Table */}
            <div className="sheet-premium-light-table overflow-x-auto rounded-2xl">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    {guide?.columns?.map((col) => (
                      <th
                        key={col}
                        scope="col"
                        className="sheet-premium-light-table-head sticky top-0 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hasGuide && (guide?.rows?.length ?? 0) > 0 ? (
                    guide!.rows.map((row) => (
                      <tr key={row.size} className="sheet-premium-light-table-row">
                        <td className="px-4 py-3 text-sm font-semibold text-zinc-950">
                          {row.size}
                        </td>
                        {row.values.map((v, idx) => (
                          <td key={idx} className="px-4 py-3 text-sm text-zinc-700">
                            {v}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={guide?.columns?.length ?? 1}
                        className="px-4 py-6 text-sm text-zinc-500"
                      >
                        {hasGuide
                          ? "Aún no hay datos para esta guía."
                          : "Esta categoría no tiene guía de medidas disponible."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 text-xs text-zinc-500">
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}