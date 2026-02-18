/**
 * Carrito con Zustand + persist en localStorage (mobile-first).
 * Cada ítem es una variante con cantidad; el frontend no envía aún al backend (checkout después).
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { validateCartStock } from "@/lib/api";


const toKey = (id: number | string) => String(id);
const DEV_VALIDATE_LOGS = process.env.NODE_ENV !== "production";

// Non-persisted validation request control (do NOT store in Zustand state)
let stockAbortController: AbortController | null = null;
let stockValidateSeq = 0;
let stockValidateTimer: ReturnType<typeof setTimeout> | null = null;

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

export type StockWarningStatus =
  | "ok"
  | "exceeds_stock"
  | "insufficient"
  | "missing"
  | "inactive"
  | "error";

export type StockWarning = {
  // Store-only: values come from backend.
  status: StockWarningStatus;
  available: number;
  requested: number;
  message: string;
  updatedAt: number; // epoch ms
};

export type StockHint = {
  // Store-only: values come from backend.
  kind: "last_unit";
  message: string;
  updatedAt: number; // epoch ms
};

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  stockWarningsByVariantId: Record<string, StockWarning>;
  stockHintsByVariantId: Record<string, StockHint>;
  lastStockValidateRequestId: number;
  isStockValidating: boolean;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (variantId: number) => void;
  updateQuantity: (variantId: number, quantity: number) => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  validateStockNow: (reason?: "add" | "qty" | "open" | "checkout") => Promise<void>;
  scheduleValidate: (reason?: "add" | "qty" | "open" | "checkout") => void;
  refreshStockValidation: () => Promise<void>;
  setStockWarnings: (payload: Record<string, Omit<StockWarning, "updatedAt">>) => void;
  setStockHints: (payload: Record<string, Omit<StockHint, "updatedAt">>) => void;
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
    (set, get) => ({
      items: [],
      isOpen: false,
      stockWarningsByVariantId: {},
      stockHintsByVariantId: {},
      lastStockValidateRequestId: 0,
      isStockValidating: false,

      addItem: (item, quantity = 1) => {
        set((state) => {
          const existing = state.items.find((i) => i.variantId === item.variantId);
          const next = existing
            ? state.items.map((i) =>
                i.variantId === item.variantId
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              )
            : [...state.items, { ...item, quantity }];

          return {
            items: next,
          };
        });

        get().scheduleValidate("add");
      },

      removeItem: (variantId) => {
        set((state) => {
          return {
            items: state.items.filter((i) => i.variantId !== variantId),
          };
        });

        get().scheduleValidate("qty");
      },

      updateQuantity: (variantId, quantity) => {
        if (quantity < 1) {
          get().removeItem(variantId);
          return;
        }

        set((state) => {
          const nextItems = state.items.map((i) =>
            i.variantId === variantId ? { ...i, quantity } : i
          );

          return {
            items: nextItems,
          };
        });

        get().scheduleValidate("qty");
      },

      openCart: () => {
        set({ isOpen: true });
      },

      // Debounced validation scheduler (150ms) to avoid request storms.
      scheduleValidate: (reason) => {
        if (stockValidateTimer) {
          try {
            clearTimeout(stockValidateTimer);
          } catch {
            // ignore
          }
        }

        stockValidateTimer = setTimeout(() => {
          if (DEV_VALIDATE_LOGS) {
            console.log("VALIDATE scheduled run", { reason });
          }
          // Only run the latest scheduled validation.
          void get().validateStockNow(reason);
        }, 150);
      },

      // Single canonical validation action (contract)
      refreshStockValidation: async () => {
        get().scheduleValidate("qty");
      },

      validateStockNow: async (reason) => {
        // Build payload from current cart items
        const itemsPayload = (get().items || [])
          .map((i) => ({
            product_variant_id: i.variantId,
            quantity: i.quantity,
          }))
          .filter((x) => Number.isFinite(x.product_variant_id) && x.product_variant_id > 0 && x.quantity > 0);

        if (DEV_VALIDATE_LOGS) {
          console.log("VALIDATE payload", { reason, itemsPayload });
        }

        // If cart is empty, clear maps and stop.
        if (!itemsPayload.length) {
          // Abort any in-flight request
          if (stockAbortController) {
            try {
              stockAbortController.abort();
            } catch {
              // ignore
            }
            stockAbortController = null;
          }
          set({ stockWarningsByVariantId: {}, stockHintsByVariantId: {}, isStockValidating: false });
          return;
        }

        // Abort previous request
        if (stockAbortController) {
          try {
            stockAbortController.abort();
          } catch {
            // ignore
          }
        }

        if (stockValidateTimer) {
          try {
            clearTimeout(stockValidateTimer);
          } catch {
            // ignore
          }
          stockValidateTimer = null;
        }

        stockAbortController = new AbortController();

        // Increment request id and mark validating
        const mySeq = ++stockValidateSeq;
        if (DEV_VALIDATE_LOGS) {
          console.log("VALIDATE start", mySeq, { reason, itemsPayload });
        }
        set({ lastStockValidateRequestId: mySeq, isStockValidating: true });

        try {
          const res = await validateCartStock(itemsPayload, { signal: stockAbortController.signal });

          if (DEV_VALIDATE_LOGS) {
            console.log("VALIDATE done", mySeq, {
              warningsByVariantId: (res as any)?.warningsByVariantId,
              hintsByVariantId: (res as any)?.hintsByVariantId,
            });
          }

          // Ignore stale responses
          const isLatest = mySeq === stockValidateSeq;
          if (DEV_VALIDATE_LOGS) {
            console.log("VALIDATE apply", mySeq, { isLatest, currentSeq: stockValidateSeq });
          }
          if (!isLatest) return;

          const now = Date.now();

          const warningsPayload = (res as any)?.warningsByVariantId || {};
          const hintsPayload = (res as any)?.hintsByVariantId || {};

          const nextWarnings: Record<string, StockWarning> = {};
          for (const [rawKey, value] of Object.entries(warningsPayload || {})) {
            const k = toKey(rawKey);
            const v: any = value || {};
            nextWarnings[k] = {
              status: (v.status ?? "ok") as StockWarningStatus,
              available: Number(v.available ?? 0),
              requested: Number(v.requested ?? 0),
              message: String(v.message ?? ""),
              updatedAt: now,
            };
          }

          const nextHints: Record<string, StockHint> = {};
          for (const [rawKey, value] of Object.entries(hintsPayload || {})) {
            const k = toKey(rawKey);
            // Safety: never keep a hint if the same variant has a warning
            if (nextWarnings[k]) continue;
            const v: any = value || {};
            if (!v.message) continue;
            nextHints[k] = {
              kind: "last_unit",
              message: String(v.message),
              updatedAt: now,
            };
          }

          set({ stockWarningsByVariantId: nextWarnings, stockHintsByVariantId: nextHints, isStockValidating: false });
        } catch (e: any) {
          // Ignore aborts
          if (e?.name === "AbortError") return;
          if (DEV_VALIDATE_LOGS) {
            console.log("VALIDATE error", mySeq, e);
          }
          if (mySeq !== stockValidateSeq) return;

          // Non-blocking strategy: clear maps on failure (single consistent strategy)
          set({ stockWarningsByVariantId: {}, stockHintsByVariantId: {}, isStockValidating: false });
        }
      },
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((s) => ({ isOpen: !s.isOpen })),

      setStockWarnings: (payload) => {
        const now = Date.now();
        const nextWarnings: Record<string, StockWarning> = {};

        for (const [rawKey, value] of Object.entries(payload || {})) {
          const k = toKey(rawKey);
          const v: any = value || {};

          nextWarnings[k] = {
            status: (v.status ?? "ok") as StockWarningStatus,
            available: Number(v.available ?? 0),
            requested: Number(v.requested ?? 0),
            message: String(v.message ?? ""),
            updatedAt: now,
          };
        }

        // Replace entire map to avoid stale entries.
        // Safety: warning mata hint (remove any hint for variants that now have warnings)
        const prevHints = get().stockHintsByVariantId;
        const nextHints = { ...prevHints };
        for (const k of Object.keys(nextWarnings)) {
          delete nextHints[k];
        }
        set({ stockWarningsByVariantId: nextWarnings, stockHintsByVariantId: nextHints });
      },

      setStockHints: (payload) => {
        const now = Date.now();
        const nextHints: Record<string, StockHint> = {};

        for (const [rawKey, value] of Object.entries(payload || {})) {
          const k = toKey(rawKey);
          // Safety: never store a hint if a warning exists for this variant
          if (get().stockWarningsByVariantId[k]) continue;
          const v: any = value || {};
          if (!v.message) continue;

          nextHints[k] = {
            kind: "last_unit",
            message: String(v.message),
            updatedAt: now,
          };
        }

        // Replace entire map to avoid stale entries.
        set({ stockHintsByVariantId: nextHints });
      },

      upsertStockWarning: (variantId, warning) => {
        const now = Date.now();
        set((state) => {
          const k = toKey(variantId);
          // Safety: warning mata hint
          const nextHints: Record<string, StockHint> = { ...state.stockHintsByVariantId };
          delete nextHints[k];
          const prev = state.stockWarningsByVariantId[k];
          const next: Record<string, StockWarning> = {
            ...state.stockWarningsByVariantId,
          };

          next[k] = {
            status: (warning.status ?? prev?.status ?? "ok") as StockWarningStatus,
            available: warning.available ?? prev?.available ?? 0,
            requested: (warning as any).requested ?? prev?.requested ?? 0,
            message: warning.message ?? prev?.message ?? "",
            updatedAt: now,
          };

          return { stockWarningsByVariantId: next, stockHintsByVariantId: nextHints };
        });
      },

      upsertStockHint: (variantId, hint) => {
        const now = Date.now();
        set((state) => {
          const k = toKey(variantId);
          // Safety: never store a hint if a warning exists for this variant
          if (state.stockWarningsByVariantId[k]) {
            const nextNoop = { ...state.stockHintsByVariantId };
            delete nextNoop[k];
            return { stockHintsByVariantId: nextNoop };
          }
          const prev = state.stockHintsByVariantId[k];
          const next: Record<string, StockHint> = { ...state.stockHintsByVariantId };

          const message = hint.message ?? prev?.message ?? "";
          if (!message) {
            delete next[k];
            return { stockHintsByVariantId: next };
          }

          next[k] = {
            kind: "last_unit",
            message,
            updatedAt: now,
          };

          return { stockHintsByVariantId: next };
        });
      },

      clearStockHint: (variantId) => {
        set((state) => {
          const k = toKey(variantId);
          if (!state.stockHintsByVariantId[k]) return {} as any;
          const next = { ...state.stockHintsByVariantId };
          delete next[k];
          return { stockHintsByVariantId: next };
        });
      },

      applyOptimisticStockCheck: (_variantId, _nextQty) => {
        // Store-only contract: no optimistic logic. Validation must come from backend.
        return;
      },

      hasStockWarnings: () => {
        const map = get().stockWarningsByVariantId;
        return Object.values(map).some((w) => {
          if (!w) return false;
          return (
            w.status === "exceeds_stock" ||
            w.status === "insufficient" ||
            w.status === "missing" ||
            w.status === "inactive" ||
            w.status === "error"
          );
        });
      },

      hasBlockingStockIssues: () => {
        const map = get().stockWarningsByVariantId;
        return Object.values(map).some((w) => {
          if (!w) return false;
          return (
            w.status === "exceeds_stock" ||
            w.status === "insufficient" ||
            w.status === "missing" ||
            w.status === "inactive" ||
            w.status === "error"
          );
        });
      },

      getStockWarning: (variantId) => {
        const key = toKey(variantId);
        return get().stockWarningsByVariantId[key];
      },

      getStockHint: (variantId) => {
        const key = toKey(variantId);
        return get().stockHintsByVariantId[key];
      },

      totalItems: () =>
        get().items.reduce((acc, i) => acc + i.quantity, 0),

      totalAmount: () =>
        get().items.reduce((acc, i) => acc + parseFloat(i.price) * i.quantity, 0),

      clearCart: () => {
        if (stockAbortController) {
          try {
            stockAbortController.abort();
          } catch {
            // ignore
          }
          stockAbortController = null;
        }
        set({ items: [], stockWarningsByVariantId: {}, stockHintsByVariantId: {}, isStockValidating: false });
      },
    }),
    { name: "kame-cart", skipHydration: true }
  )
);
