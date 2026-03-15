import type { StateCreator } from "zustand";

import type { CartState } from "./cart";

export type CartUiSlice = Pick<
  CartState,
  | "isOpen"
  | "openCart"
  | "closeCart"
  | "toggleCart"
>;

/**
 * Legacy UI compatibility layer for cart open/close state.
 *
 * Important:
 * - This is preserved only for backward compatibility with hidden or older consumers.
 * - This is NOT the source of truth for the visible MiniCart drawer.
 * - Header.tsx remains the owner of the visible drawer state.
 */
export const createCartUiSlice: StateCreator<CartState, [], [], CartUiSlice> = (
  set
) => ({
  isOpen: false,

  openCart: () => set({ isOpen: true }),

  closeCart: () => set({ isOpen: false }),

  toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
});
