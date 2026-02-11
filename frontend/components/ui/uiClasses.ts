

// Centralized Dark UI Class Registry
// -----------------------------------
// Purpose:
// Avoid duplicating Tailwind class strings across the app.
// All shared UI surfaces and controls should consume these.

export const panelClass =
  "bg-neutral-900 border border-white/10 rounded-2xl shadow-sm";

export const dividerClass =
  "border-t border-white/10";

export const labelClass =
  "block text-sm font-medium text-neutral-200 mb-1";

export const helperClass =
  "text-xs text-neutral-400 mt-1";

export const inputClass =
  "w-full rounded-xl bg-neutral-950 border border-white/10 px-4 py-2.5 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition";

export const selectClass =
  "w-full rounded-xl bg-neutral-950 border border-white/10 px-4 py-2.5 text-neutral-100 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition appearance-none";

export const primaryButtonClass =
  "inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold bg-white text-black hover:bg-neutral-200 transition disabled:opacity-50 disabled:cursor-not-allowed";

export const mutedButtonClass =
  "inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium border border-white/15 bg-white/5 text-white hover:bg-white/10 transition disabled:opacity-50 disabled:cursor-not-allowed";