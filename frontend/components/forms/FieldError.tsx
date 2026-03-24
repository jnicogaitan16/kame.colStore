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
  showIcon = true,
}: FieldErrorProps) {
  if (!message) return null;

  return (
    <p
      id={id}
      role="alert"
      aria-live="polite"
      className={[
        "ui-field-error",
        className || "",
      ].join(" ")}
    >
      {showIcon ? (
        <span aria-hidden="true" className="ui-field-error-icon">
          <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
            <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.25" />
            <path d="M8 4.75V8.25" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
            <circle cx="8" cy="11" r="0.75" fill="currentColor" />
          </svg>
        </span>
      ) : null}
      <span>{message}</span>
    </p>
  );
}