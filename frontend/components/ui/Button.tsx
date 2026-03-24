"use client";

import React, { forwardRef } from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "critical";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      fullWidth = false,
      className,
      type,
      children,
      ...props
    },
    ref
  ) => {
    // Keep the default button typography opt-in friendly: caller `className` is merged last,
    // so contexts like the PDP can refine tracking/weight without changing the global button system.
    const baseClasses =
      "inline-flex min-h-12 items-center justify-center text-[0.8125rem] font-semibold uppercase tracking-[0.045em] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/12 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50";

    // Visual ownership lives in each variant/global contract (`btn-primary`, `btn-secondary`, etc.).
    // Keep `baseClasses` free of radius and color decisions so consumers stay in the same UI family.
    const variants: Record<ButtonVariant, string> = {
      primary: "btn-primary px-5 py-3",
      secondary: "btn-secondary px-5 py-3",
      ghost:
        "rounded-xl border border-transparent bg-transparent px-4 py-3 text-zinc-700 shadow-none hover:bg-zinc-900/5 hover:text-zinc-950 focus-visible:ring-zinc-900/10 disabled:border-transparent disabled:bg-transparent disabled:text-zinc-400",
      critical: "btn-critical px-5 py-3",
    };

    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cn(
          baseClasses,
          variants[variant],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";