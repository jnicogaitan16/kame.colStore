"use client";

import React from "react";

export type StockWarningStatus = "unknown" | "low" | "over";
export type StockWarningVariant = "default" | "subtle";

export type StockWarningChipProps = {
  status: StockWarningStatus;
  available?: number;
  requested?: number;
  message?: string;
  detail?: string;
  variant?: StockWarningVariant;
  compact?: boolean;
  onAdjust?: () => void;
  className?: string;
};

function cx(...parts: Array<string | undefined | null | false>): string {
  return parts.filter(Boolean).join(" ");
}

function labelFor(status: StockWarningStatus): string {
  switch (status) {
    case "unknown":
      return "Disponibilidad sin validar";
    case "low":
      return "Unidades limitadas";
    case "over":
      return "No hay suficientes unidades";
  }
}

function detailFor(
  status: StockWarningStatus,
  available?: number,
  requested?: number
): string | null {
  const a = typeof available === "number" ? available : undefined;
  const r = typeof requested === "number" ? requested : undefined;

  if (status === "unknown") return null;

  if (typeof a === "number" && typeof r === "number") {
    if (status === "over") return `Pediste ${r}. Solo quedan ${a} disponibles.`;
    if (status === "low") {
      if (a === 1) return "Queda la última unidad disponible.";
      return `Quedan ${a} unidades disponibles.`;
    }
  }

  if (typeof a === "number") {
    if (status === "low") {
      if (a === 1) return "Queda la última unidad disponible.";
      return `Quedan ${a} unidades disponibles.`;
    }

    return `${a} unidades disponibles`;
  }

  if (typeof r === "number") return `${r} unidades solicitadas`;
  return null;
}

export default function StockWarningChip({
  status,
  available,
  requested,
  message,
  detail,
  variant = "default",
  compact = false,
  onAdjust,
  className,
}: StockWarningChipProps) {
  const isSubtle = variant === "subtle";

  const base = compact
    ? "inline-flex max-w-full items-center gap-1.5 rounded-xl border px-3 py-2 text-sm leading-none backdrop-blur"
    : "inline-flex max-w-full items-start gap-2 rounded-2xl border px-3 py-2.5 text-sm leading-snug backdrop-blur";

  const tone =
    status === "over"
      ? isSubtle
        ? "border-white/16 bg-white/[0.05] text-white/84"
        : "border-white/20 bg-white/[0.06] text-white/88"
      : status === "low"
        ? isSubtle
          ? "border-white/14 bg-white/[0.045] text-white/80"
          : "border-white/20 bg-white/[0.06] text-white/84"
        : isSubtle
          ? "border-white/10 bg-white/[0.04] text-white/70"
          : "border-white/10 bg-white/5 text-white/72";

  const icon = compact ? "mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" : "mt-0.5 h-4 w-4 shrink-0 opacity-80";
  const content = "min-w-0 flex-1";
  const titleClass = compact ? "truncate" : "block";
  const detailClass = compact ? "mt-0.5 text-[12px] leading-snug text-white/58" : "mt-1 text-[12px] leading-snug text-white/62";

  const adjustBtn =
    "ml-1 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 " +
    "text-[12px] font-medium text-white/80 transition-colors " +
    "hover:bg-white/10 hover:text-white active:bg-white/15 " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20";

  const resolvedLabel = typeof message === "string" && message.trim() ? message.trim() : labelFor(status);
  const resolvedDetail =
    typeof detail === "string" && detail.trim()
      ? detail.trim()
      : detailFor(status, available, requested);

  return (
    <span
      className={cx(base, tone, className)}
      title={resolvedDetail ? `${resolvedLabel} (${resolvedDetail})` : resolvedLabel}
    >
      <svg
        className={icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>

      <span className={content}>
        <span className={titleClass}>{resolvedLabel}</span>
        {resolvedDetail ? <span className={detailClass}>{resolvedDetail}</span> : null}
      </span>

      {onAdjust ? (
        <button type="button" className={adjustBtn} onClick={onAdjust}>
          Ajustar
        </button>
      ) : null}
    </span>
  );
}