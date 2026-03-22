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
      return "Pocas piezas disponibles";
    case "over":
      return "Ajusta la cantidad para continuar";
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
  onAdjust,
  className,
}: StockWarningChipProps) {
  const isSubtle = variant === "subtle";

  const base = compact
    ? "inline-flex max-w-full flex-col items-start gap-2 rounded-[1.1rem] border px-3 py-2.5 text-sm leading-snug shadow-[0_10px_24px_rgba(24,24,27,0.05)] backdrop-blur-sm"
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
      ? "mt-[0.1rem] h-4 w-4 shrink-0"
      : "mt-[0.1rem] h-[1.05rem] w-[1.05rem] shrink-0",
    status === "over"
      ? "text-amber-700"
      : status === "low"
        ? "text-zinc-700"
        : "text-zinc-500"
  );
  const titleClass = cx(
    compact ? "block text-[12.5px] leading-[1.3]" : "block text-[13px] leading-[1.35]",
    status === "over"
      ? "font-semibold text-zinc-950"
      : status === "low"
        ? "font-medium text-zinc-900"
        : "font-medium text-zinc-800"
  );
  const detailClass = compact
    ? "mt-1 text-[11px] leading-[1.4] text-zinc-500"
    : "mt-1 text-[11.5px] leading-[1.45] text-zinc-500";

  const adjustBtn =
    status === "over"
      ? "inline-flex min-h-0 w-auto items-center justify-center rounded-full border border-zinc-900/10 bg-zinc-900 px-2.5 py-1 text-[10.5px] font-medium leading-none tracking-[0.01em] text-white transition-colors hover:bg-zinc-800 active:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/15"
      : "inline-flex min-h-0 w-auto items-center justify-center rounded-full border border-zinc-900/10 bg-white px-2.5 py-1 text-[10.5px] font-medium leading-none tracking-[0.01em] text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-950 active:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/12";

  const headerRow = compact ? "flex w-full items-start gap-2" : "flex w-full items-start gap-2.5";
  const bodyStack = "min-w-0 flex-1";
  const actionRow = compact ? "w-full pt-0.5" : "w-full pt-1";

  const resolvedLabel = typeof message === "string" && message.trim() ? message.trim() : labelFor(status);
  const isLastPieceMessage = resolvedLabel === "Última pieza de este drop" || resolvedLabel === "Últimas unidades";
  const isLimitedStockMessage = resolvedLabel === "Stock limitado";
  const useSingleLineMessage = isLastPieceMessage || isLimitedStockMessage;
  const resolvedDetail = useSingleLineMessage
    ? null
    : typeof detail === "string" && detail.trim()
      ? detail.trim()
      : detailFor(status, available, requested);

  return (
    <span
      className={cx(base, compact && "min-w-0", tone, className)}
      title={resolvedDetail ? `${resolvedLabel} (${resolvedDetail})` : resolvedLabel}
    >
      <span className={headerRow}>
        {isLastPieceMessage ? (
          <span className={cx(icon, "inline-flex items-center justify-center text-[12px] leading-none")} aria-hidden="true">
            ⚡
          </span>
        ) : isLimitedStockMessage ? (
          <span className={cx(icon, "inline-flex items-center justify-center text-[12px] leading-none")} aria-hidden="true">
            ⚠️
          </span>
        ) : (
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
        )}

        <span className={bodyStack}>
          <span className={cx(titleClass, useSingleLineMessage && "leading-[1.2]")}>{resolvedLabel}</span>
          {resolvedDetail ? <span className={detailClass}>{resolvedDetail}</span> : null}
        </span>
      </span>

      {onAdjust && status === "over" ? (
        <span className={actionRow}>
          <button type="button" className={adjustBtn} onClick={onAdjust}>
            Ajustar
          </button>
        </span>
      ) : null}
    </span>
  );
}