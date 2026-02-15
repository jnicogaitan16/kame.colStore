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
      return "Stock sin validar";
    case "low":
      return "Stock limitado";
    case "over":
      return "Supera stock";
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
    if (status === "low") return `Disp: ${a}`;
  }

  if (typeof a === "number") return `Disp: ${a}`;
  if (typeof r === "number") return `Req: ${r}`;
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
    "inline-flex max-w-full items-center gap-1.5 rounded-full border " +
    "border-amber-500/15 bg-neutral-950/30 px-2 py-1 " +
    "text-[12px] leading-[14px] text-amber-100/80";

  const icon = "h-3.5 w-3.5 shrink-0 opacity-90";
  const text = "min-w-0 truncate";
  const meta = "shrink-0 text-amber-100/60";

  const adjustBtn =
    "ml-1 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 " +
    "text-[12px] font-medium text-amber-200/90 " +
    "hover:bg-amber-500/10 active:bg-amber-500/15 " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30";

  const label = labelFor(status);
  const detail = detailFor(status, available, requested);

  return (
    <span
      className={cx(base, className)}
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