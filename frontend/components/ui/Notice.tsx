"use client";

import * as React from "react";
import { NOTICE_STYLES, type NoticeTone, type NoticeVariant } from "./noticeStyles";

export type NoticeProps = {
  variant: NoticeVariant;
  tone?: NoticeTone;
  compact?: boolean;
  icon?: React.ReactNode;
  title?: string;
  children?: React.ReactNode;
  className?: string;
};

function cx(...parts: Array<string | undefined | null | false>): string {
  return parts.filter(Boolean).join(" ");
}

function hasUl(children: React.ReactNode): boolean {
  const arr = React.Children.toArray(children);
  return arr.some((c) => React.isValidElement(c) && c.type === "ul");
}

/**
 * Premium notice component.
 * - Default behavior is a banner (block element).
 * - You can style it as a chip via `className` (e.g., `inline-flex w-auto`).
 */
export function Notice({
  variant,
  tone = "soft",
  compact = false,
  icon,
  title,
  children,
  className,
}: NoticeProps) {
  const tokens = NOTICE_STYLES[variant][tone];
  const listMode = hasUl(children);

  // Base keeps things premium + stable in tight layouts like MiniCart.
  // Note: no `w-full` so consumers can opt into chip mode with className.
  const containerBase =
    "block min-w-0 max-w-full" +
    " " +
    "[&_*]:min-w-0"; // avoid long text stretching cards

  const radius = compact ? "rounded-[18px]" : "rounded-[24px]";
  const padding = compact ? "px-3 py-2" : "px-4 py-3";

  // Typography tuned to not compete with CTAs.
  const titleText = compact ? "text-[13px] leading-4" : "text-sm leading-5";
  const bodyText = compact ? "text-[13px] leading-[18px]" : "text-sm leading-5";

  const gridGap = compact ? "gap-2" : "gap-3";
  const iconBox = compact ? "mt-[1px]" : "mt-[2px]";

  // Better list rendering when children includes a <ul>.
  const listStyles = listMode
    ? "[&_ul]:mt-1 [&_ul]:space-y-1 [&_ul]:pl-4 [&_ul]:list-disc [&_ul]:leading-[1.25]"
    : "";

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cx(
        containerBase,
        radius,
        padding,
        "border",
        tokens.container,
        listStyles,
        className
      )}
    >
      <div className={cx("grid min-w-0 grid-cols-[auto,1fr] items-start", gridGap)}>
        {icon ? (
          <div className={cx("shrink-0", iconBox)} aria-hidden="true">
            {icon}
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          {title ? (
            <div className={cx("font-semibold tracking-tight", tokens.title, titleText)}>
              {title}
            </div>
          ) : null}

          {children ? (
            <div
              className={cx(
                title ? "mt-0.5" : "",
                "min-w-0 whitespace-normal break-words",
                tokens.text,
                bodyText
              )}
            >
              {children}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default Notice;