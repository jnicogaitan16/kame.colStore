

import type { StateCreator } from "zustand";

import type { CartItem, CartState } from "./cart";

export type CartItemsSlice = Pick<
  CartState,
  | "items"
  | "addItem"
  | "removeItem"
  | "updateQuantity"
  | "totalItems"
  | "totalAmount"
>;

/**
 * Items domain only.
 *
 * Responsibilities owned here:
 * - items state
 * - addItem
 * - removeItem
 * - updateQuantity
 * - totalItems
 * - totalAmount
 *
 * Explicitly out of scope:
 * - stock warnings / hints
 * - remote validation implementation
 * - timers / abort controllers
 * - legacy drawer UI state
 * - full clearCart orchestration
 */
export const createCartItemsSlice: StateCreator<
  CartState,
  [],
  [],
  CartItemsSlice
> = (set, get) => ({
  items: [],

  addItem: (item: Omit<CartItem, "quantity">, quantity = 1) => {
    set((state) => {
      const nextQty = Math.max(1, quantity);
      const existingIndex = state.items.findIndex(
        (entry) => entry.variantId === item.variantId
      );

      if (existingIndex >= 0) {
        const nextItems = [...state.items];
        const current = nextItems[existingIndex];

        nextItems[existingIndex] = {
          ...current,
          quantity: current.quantity + nextQty,
        };

        return { items: nextItems };
      }

      return {
        items: [
          ...state.items,
          {
            ...item,
            quantity: nextQty,
          },
        ],
      };
    });

    get().scheduleValidate("add");
  },

  removeItem: (variantId: number) => {
    set((state) => ({
      items: state.items.filter((entry) => entry.variantId !== variantId),
    }));

    get().scheduleValidate("qty");
  },

  updateQuantity: (variantId: number, quantity: number) => {
    if (quantity < 1) {
      get().removeItem(variantId);
      return;
    }

    set((state) => ({
      items: state.items.map((entry) =>
        entry.variantId === variantId ? { ...entry, quantity } : entry
      ),
    }));

    get().scheduleValidate("qty");
  },

  totalItems: () => get().items.reduce((acc, item) => acc + item.quantity, 0),

  totalAmount: () =>
    get().items.reduce(
      (acc, item) => acc + Number.parseFloat(item.price) * item.quantity,
      0
    ),
});