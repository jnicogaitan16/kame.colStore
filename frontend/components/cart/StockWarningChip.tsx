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
    ? "ui-warning-surface inline-flex max-w-full flex-col items-start gap-1.5 px-2.5 py-2"
    : "ui-warning-surface inline-flex max-w-full flex-col items-start gap-2 px-3.5 py-3";

  const tone =
    status === "over"
      ? isSubtle
        ? "ui-warning-surface--soft"
        : "ui-warning-surface--strong"
      : "ui-warning-surface--soft";

  const icon = compact ? "mt-[0.1rem] h-3.5 w-3.5 shrink-0" : "mt-[0.1rem] h-[1rem] w-[1rem] shrink-0";

  const titleClass = compact
    ? "block text-[12px] font-medium leading-[1.25]"
    : "block text-[12.5px] font-medium leading-[1.35]";

  const detailClass = compact
    ? "mt-0.5 text-[10.5px] leading-[1.35]"
    : "mt-0.5 text-[11px] leading-[1.45]";

  const headerRow = compact ? "flex w-full items-start gap-2" : "flex w-full items-start gap-2.25";
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