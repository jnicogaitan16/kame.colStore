/**
 * Carrito con Zustand + persist en localStorage (mobile-first).
 * Cada ítem es una variante con cantidad; el frontend no envía aún al backend (checkout después).
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  variantId: number;
  productId: number;
  productName: string;
  productSlug: string;
  variantLabel: string; // ej. "Talla M / Negro"
  price: string;
  quantity: number;
  imageUrl: string | null;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (variantId: number) => void;
  updateQuantity: (variantId: number, quantity: number) => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  totalItems: () => number;
  totalAmount: () => number;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item, quantity = 1) => {
        set((state) => {
          const existing = state.items.find(
            (i) => i.variantId === item.variantId
          );
          const next = existing
            ? state.items.map((i) =>
                i.variantId === item.variantId
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              )
            : [...state.items, { ...item, quantity }];
          return { items: next };
        });
      },

      removeItem: (variantId) => {
        set((state) => ({
          items: state.items.filter((i) => i.variantId !== variantId),
        }));
      },

      updateQuantity: (variantId, quantity) => {
        if (quantity < 1) {
          get().removeItem(variantId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.variantId === variantId ? { ...i, quantity } : i
          ),
        }));
      },

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((s) => ({ isOpen: !s.isOpen })),

      totalItems: () =>
        get().items.reduce((acc, i) => acc + i.quantity, 0),

      totalAmount: () =>
        get().items.reduce((acc, i) => acc + parseFloat(i.price) * i.quantity, 0),

      clearCart: () => set({ items: [] }),
    }),
    { name: "kame-cart", skipHydration: true }
  )
);
