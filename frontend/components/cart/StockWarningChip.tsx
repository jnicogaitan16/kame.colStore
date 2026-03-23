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
  className?: string;
};

function cx(...parts: Array<string | undefined | null | false>): string {
  return parts.filter(Boolean).join(" ");
}

function labelFor(status: StockWarningStatus): string {
  switch (status) {
    case "unknown":
      return "Disponibilidad limitada";
    case "low":
      return "Últimas unidades";
    case "over":
      return "Stock limitado";
  }
}

function detailFor(
  status: StockWarningStatus,
  available?: number,
  requested?: number
): string | null {
  const a = typeof available === "number" ? available : undefined;
  const r = typeof requested === "number" ? requested : undefined;

  void a;
  void r;

  switch (status) {
    case "unknown":
      return null;
    case "low":
      return "Disponibilidad reducida";
    case "over":
      return "Ajusta tu cantidad para continuar";
  }
}

export default function StockWarningChip({
  status,
  available,
  requested,
  message,
  detail,
  variant = "default",
  compact = false,
  className,
}: StockWarningChipProps) {
  const isSubtle = variant === "subtle";

  const base = compact
    ? "inline-flex max-w-full flex-col items-start gap-1.5 rounded-[1rem] border px-2.5 py-2 text-sm leading-snug shadow-[0_8px_18px_rgba(24,24,27,0.04)] backdrop-blur-sm"
    : "inline-flex max-w-full flex-col items-start gap-2.5 rounded-[1.25rem] border px-3.5 py-3 text-sm leading-snug shadow-[0_14px_30px_rgba(24,24,27,0.06)] backdrop-blur-sm";

  const tone =
    status === "over"
      ? isSubtle
        ? "border-amber-950/10 bg-[linear-gradient(180deg,rgba(255,251,245,0.94),rgba(255,247,237,0.9))] text-zinc-950"
        : "border-amber-950/12 bg-[linear-gradient(180deg,rgba(255,252,248,0.98),rgba(255,247,237,0.94))] text-zinc-950"
      : status === "low"
        ? isSubtle
          ? "border-zinc-900/7 bg-white/78 text-zinc-800"
          : "border-zinc-900/8 bg-white/90 text-zinc-900"
        : isSubtle
          ? "border-zinc-900/7 bg-white/76 text-zinc-700"
          : "border-zinc-900/8 bg-white/88 text-zinc-800";

  const icon = cx(
    compact
      ? "mt-[0.1rem] h-3.5 w-3.5 shrink-0"
      : "mt-[0.1rem] h-[1.05rem] w-[1.05rem] shrink-0",
    status === "over"
      ? "text-amber-700"
      : status === "low"
        ? "text-zinc-700"
        : "text-zinc-500"
  );
  const titleClass = cx(
    compact ? "block text-[12px] leading-[1.25]" : "block text-[13px] leading-[1.35]",
    status === "over"
      ? "font-medium text-zinc-950"
      : status === "low"
        ? "font-medium text-zinc-900"
        : "font-medium text-zinc-800"
  );
  const detailClass = compact
    ? "mt-0.5 text-[10.5px] leading-[1.35] text-zinc-500"
    : "mt-1 text-[11.5px] leading-[1.45] text-zinc-500";

  const headerRow = compact ? "flex w-full items-start gap-2" : "flex w-full items-start gap-2.5";
  const bodyStack = "min-w-0 flex-1";

  const resolvedLabel =
    typeof message === "string" && message.trim()
      ? message.trim()
      : labelFor(status);
  const resolvedDetail =
    typeof detail === "string" && detail.trim() ? detail.trim() : detailFor(status, available, requested);

  return (
    <span
      className={cx(base, compact && "min-w-0", tone, className)}
      title={resolvedDetail ? `${resolvedLabel} (${resolvedDetail})` : resolvedLabel}
    >
      <span className={headerRow}>
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

        <span className={bodyStack}>
          <span className={titleClass}>{resolvedLabel}</span>
          {resolvedDetail ? <span className={detailClass}>{resolvedDetail}</span> : null}
        </span>
      </span>
    </span>
  );
}