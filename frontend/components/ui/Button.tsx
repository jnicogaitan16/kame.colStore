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
    const baseClasses =
      "type-action inline-flex min-h-12 items-center justify-center rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/12 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 disabled:cursor-not-allowed disabled:opacity-100";

    const variants: Record<ButtonVariant, string> = {
      primary:
        "btn-primary px-5 py-3 disabled:border-zinc-900/8 disabled:bg-zinc-200 disabled:text-zinc-500 disabled:shadow-none",
      secondary:
        "btn-secondary px-5 py-3 disabled:border-zinc-900/8 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:shadow-none",
      ghost:
        "border border-transparent bg-transparent px-4 py-3 text-zinc-700 shadow-none hover:bg-zinc-900/5 hover:text-zinc-950 focus-visible:ring-zinc-900/10 disabled:border-transparent disabled:bg-transparent disabled:text-zinc-400",
      critical:
        "bg-zinc-950 px-4 py-2.5 text-white shadow-none hover:bg-zinc-800 active:bg-black disabled:border-zinc-900/8 disabled:bg-zinc-200 disabled:text-zinc-500 disabled:shadow-none",
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