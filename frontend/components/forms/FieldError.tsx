"use client";

import * as React from "react";

type FieldErrorProps = {
  message?: string | null;
  className?: string;
  id?: string;
  /**
   * Whether to render a small leading icon.
   * Defaults to true.
   */
  showIcon?: boolean;
};

/**
 * Standardized field-level error message.
 *
 * - Renders nothing if no message is provided.
 * - Uses consistent font-size and line-height for mobile.
 */
export default function FieldError({
  message,
  className,
  id,
  showIcon = false,
}: FieldErrorProps) {
  if (!message) return null;

  return (
    <p
      id={id}
      role="alert"
      className={[
        "mt-1 text-xs font-medium leading-snug text-rose-500/90",
        className || "",
      ].join(" ")}
    >
      {message}
    </p>
  );
}