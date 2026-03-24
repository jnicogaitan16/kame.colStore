/**
 * Carrito con Zustand + persist en localStorage (mobile-first).
 * Composición por dominios: items (cart-items-slice), UI legacy (cart-ui-slice),
 * stock/validación (cart-stock-slice). clearCart orquesta items + stock y abort.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { createCartItemsSlice } from "./cart-items-slice";
import { createCartUiSlice } from "./cart-ui-slice";
import {
  abortAndClearStockValidationRequest,
  createCartStockSlice,
} from "./cart-stock-slice";

export interface CartItem {
  variantId: number;
  productId: number;
  productName: string;
  productSlug: string;
  variantLabel: string; // ej. "Talla M / Negro"
  price: string;
  quantity: number;
  /**
   * Canonical MiniCart media URL.
   * This value must already be resolved before entering the cart store,
   * and MiniCart should consume it directly without re-running media
   * resolution logic during render.
   */
  imageUrl: string | null;
}

export type StockWarningStatus =
  | "ok"
  | "exceeds_stock"
  | "insufficient"
  | "missing"
  | "inactive"
  | "error";

export type StockWarning = {
  status: StockWarningStatus;
  available: number;
  requested: number;
  message: string;
  updatedAt: number;
};

export type StockHint = {
  kind: "last_unit";
  message: string;
  updatedAt: number;
};

export type StockValidateStatus = "idle" | "checking" | "ok" | "error";

export interface CartState {
  items: CartItem[];
  /**
   * Legacy UI flag kept for backward compatibility with any remaining consumers.
   * Visible MiniCart in header/layout is controlled by Header.tsx, not this flag.
   */
  isOpen: boolean;
  stockWarningsByVariantId: Record<string, StockWarning>;
  stockHintsByVariantId: Record<string, StockHint>;
  lastStockValidateRequestId: number;
  stockValidateStatus: StockValidateStatus;
  lastStockValidateAt: number;

  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (variantId: number) => void;
  updateQuantity: (variantId: number, quantity: number) => void;

  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;

  validateStockNow: (reason?: "add" | "qty" | "open" | "checkout") => Promise<void>;
  scheduleValidate: (reason?: "add" | "qty" | "open" | "checkout") => void;
  refreshStockValidation: () => Promise<void>;

  setStockWarnings: (payload: Record<string, any>) => void;
  setStockHints: (payload: Record<string, any>) => void;
  setStockValidateStatus: (status: StockValidateStatus) => void;
  setLastStockValidateAt: (ts: number) => void;
  clearStockValidation: () => void;
  upsertStockWarning: (
    variantId: number,
    warning: Partial<Omit<StockWarning, "updatedAt">>
  ) => void;
  upsertStockHint: (variantId: number, hint: Partial<Omit<StockHint, "updatedAt">>) => void;
  clearStockHint: (variantId: number) => void;
  applyOptimisticStockCheck: (variantId: number, nextQty: number) => void;
  hasStockWarnings: () => boolean;
  hasBlockingStockIssues: () => boolean;
  getStockWarning: (variantId: number | string) => StockWarning | undefined;
  getStockHint: (variantId: number | string) => StockHint | undefined;

  totalItems: () => number;
  totalAmount: () => number;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get, api) => ({
      ...createCartItemsSlice(set, get, api),
      ...createCartUiSlice(set, get, api),
      ...createCartStockSlice(set, get, api),
      clearCart: () => {
        abortAndClearStockValidationRequest();
        set({ items: [] });
        get().clearStockValidation();
      },
    }),
    {
      name: "kame-cart",
      skipHydration: true,
      partialize: (state) => ({
        items: state.items,
        stockWarningsByVariantId: state.stockWarningsByVariantId,
        stockHintsByVariantId: state.stockHintsByVariantId,
        lastStockValidateRequestId: state.lastStockValidateRequestId,
        stockValidateStatus: state.stockValidateStatus,
        lastStockValidateAt: state.lastStockValidateAt,
      }),
    }
  )
);
