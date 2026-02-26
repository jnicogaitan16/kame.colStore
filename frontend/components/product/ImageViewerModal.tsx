"use client";

import React, { useEffect, useMemo } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

type ImageViewerModalProps = {
  open: boolean;
  onClose: () => void;
  images: Array<{ url: string; alt?: string }>;
  /** current index controlled by parent */
  index: number;
  setIndex: (i: number) => void;
  /** optional future-proof (not required by current integration) */
  initialIndex?: number;
};

export default function ImageViewerModal({
  open,
  onClose,
  images,
  index,
  setIndex,
}: ImageViewerModalProps) {
  const total = images?.length || 0;

  // keep index in range even if images array changes
  const safeIndex = useMemo(() => {
    if (!total) return 0;
    return Math.min(Math.max(index, 0), total - 1);
  }, [index, total]);

  const current = images?.[safeIndex];

  const canPrev = safeIndex > 0;
  const canNext = safeIndex < total - 1;

  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && canPrev) setIndex(safeIndex - 1);
      if (e.key === "ArrowRight" && canNext) setIndex(safeIndex + 1);
    };

    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, safeIndex, setIndex, canPrev, canNext]);

  if (!open || !current) return null;

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Overlay (click to close) */}
      <button
        type="button"
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
        aria-label="Cerrar visor"
      />

      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-[210] flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full border border-white/10 bg-white/5 text-white/80 backdrop-blur-xl hover:bg-white/10"
          aria-label="Cerrar"
        >
          ✕
        </button>

        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur-xl">
          {safeIndex + 1}/{total}
        </div>

        {/* spacer for visual balance */}
        <div className="h-10 w-10" />
      </div>

      {/* Arrows */}
      {total > 1 ? (
        <>
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => canPrev && setIndex(safeIndex - 1)}
            className={[
              "absolute left-3 top-1/2 z-[210] -translate-y-1/2",
              "h-11 w-11 rounded-full border border-white/10 bg-white/5 text-white/80 backdrop-blur-xl",
              "hover:bg-white/10 transition",
              !canPrev ? "opacity-30 pointer-events-none" : "",
            ].join(" ")}
            aria-label="Anterior"
          >
            ‹
          </button>

          <button
            type="button"
            disabled={!canNext}
            onClick={() => canNext && setIndex(safeIndex + 1)}
            className={[
              "absolute right-3 top-1/2 z-[210] -translate-y-1/2",
              "h-11 w-11 rounded-full border border-white/10 bg-white/5 text-white/80 backdrop-blur-xl",
              "hover:bg-white/10 transition",
              !canNext ? "opacity-30 pointer-events-none" : "",
            ].join(" ")}
            aria-label="Siguiente"
          >
            ›
          </button>
        </>
      ) : null}

      {/* Zoom canvas */}
      <div className="absolute inset-0 z-[205] flex items-center justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+18px)] pt-[calc(env(safe-area-inset-top)+56px)]">
        <div className="h-full w-full">
          <TransformWrapper
            initialScale={1}
            minScale={1}
            maxScale={4}
            centerOnInit
            wheel={{ step: 0.12 }}
            doubleClick={{ mode: "zoomIn" }}
            pinch={{ step: 5 }}
            panning={{ velocityDisabled: true }}
            limitToBounds
          >
            <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full">
              <div className="flex h-full w-full items-center justify-center">
                <img
                  src={current.url}
                  alt={current.alt || "Imagen producto"}
                  className="max-h-full max-w-full select-none object-contain"
                  draggable={false}
                />
              </div>
            </TransformComponent>
          </TransformWrapper>
        </div>
      </div>

      {/* Bottom hint */}
      <div className="absolute bottom-4 left-0 right-0 z-[210] flex justify-center">
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 backdrop-blur-xl">
          Pellizca para zoom • Arrastra para mover • Doble toque para acercar
        </div>
      </div>
    </div>
  );
}
