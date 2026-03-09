"use client";

import React from "react";

export type StockWarningStatus = "unknown" | "low" | "over";

export type StockWarningChipProps = {
  status: StockWarningStatus;
  available?: number;
  requested?: number;
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
    if (status === "over") return `${r} / ${a}`;
    if (status === "low") return `${a} unidades disponibles`;
  }

  if (typeof a === "number") return `${a} unidades disponibles`;
  if (typeof r === "number") return `${r} unidades solicitadas`;
  return null;
}

export default function StockWarningChip({
  status,
  available,
  requested,
  onAdjust,
  className,
}: StockWarningChipProps) {
  const base =
    "inline-flex max-w-full items-center gap-1.5 rounded-xl border px-3 py-2 " +
    "text-sm leading-none text-white/75 backdrop-blur";

  const tone =
    status === "over"
      ? "border-white/20 bg-white/[0.06] text-white/85"
      : status === "low"
        ? "border-white/20 bg-white/[0.06] text-white/80"
        : "border-white/10 bg-white/5 text-white/70";

  const icon = "h-3.5 w-3.5 shrink-0 opacity-80";
  const text = "min-w-0 truncate";
  const meta = "shrink-0 text-white/55";

  const adjustBtn =
    "ml-1 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 " +
    "text-[12px] font-medium text-white/80 transition-colors " +
    "hover:bg-white/10 hover:text-white active:bg-white/15 " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20";

  const label = labelFor(status);
  const detail = detailFor(status, available, requested);

  return (
    <span
      className={cx(base, tone, className)}
      title={detail ? `${label} (${detail})` : label}
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
      <span className={text}>{label}</span>
      {detail ? <span className={meta}>· {detail}</span> : null}

      {onAdjust ? (
        <button type="button" className={adjustBtn} onClick={onAdjust}>
          Ajustar
        </button>
      ) : null}
    </span>
  );
}