import { create } from "zustand";

type UIState = {
  // WhatsApp floating button override (used e.g. in checkout success)
  whatsappOverrideMessage: string | null;
  whatsappOverrideAriaLabel: string | null;
  whatsappOverrideTooltipText: string | null;

  setWhatsappOverride: (message: string, ariaLabel?: string, tooltipText?: string) => void;
  clearWhatsappOverride: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  whatsappOverrideMessage: null,
  whatsappOverrideAriaLabel: null,
  whatsappOverrideTooltipText: null,

  setWhatsappOverride: (message, ariaLabel, tooltipText) =>
    set({
      whatsappOverrideMessage: message,
      whatsappOverrideAriaLabel: ariaLabel ?? null,
      whatsappOverrideTooltipText: tooltipText ?? null,
    }),

  clearWhatsappOverride: () =>
    set({
      whatsappOverrideMessage: null,
      whatsappOverrideAriaLabel: null,
      whatsappOverrideTooltipText: null,
    }),
}));