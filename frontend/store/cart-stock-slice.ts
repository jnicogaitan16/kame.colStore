

import type { StateCreator } from "zustand";

import { validateCartStock } from "@/lib/api";

import type {
  CartState,
  StockHint,
  StockValidateStatus,
  StockWarning,
  StockWarningStatus,
} from "./cart";

const DEV_VALIDATE_LOGS = process.env.NODE_ENV !== "production";
const STOCK_VALIDATE_DEBOUNCE_MS = 150;

let stockAbortController: AbortController | null = null;
let stockValidateSeq = 0;
let stockValidateTimer: ReturnType<typeof setTimeout> | null = null;

const toKey = (id: number | string) => String(id);

const clearValidateTimer = () => {
  if (!stockValidateTimer) return;

  try {
    clearTimeout(stockValidateTimer);
  } catch {
    // ignore
  }

  stockValidateTimer = null;
};

const abortActiveValidationRequest = () => {
  if (!stockAbortController) return;

  try {
    stockAbortController.abort();
  } catch {
    // ignore
  }

  stockAbortController = null;
};

const buildValidationPayload = (items: CartState["items"]) =>
  (items || [])
    .map((item) => ({
      product_variant_id: item.variantId,
      quantity: item.quantity,
    }))
    .filter(
      (entry) =>
        Number.isFinite(entry.product_variant_id) &&
        entry.product_variant_id > 0 &&
        entry.quantity > 0
    );

const normalizeWarningMap = (payload: unknown): Record<string, StockWarning> => {
  const now = Date.now();
  const nextWarnings: Record<string, StockWarning> = {};

  for (const [rawKey, value] of Object.entries((payload as Record<string, unknown>) || {})) {
    const key = toKey(rawKey);
    const warning = (value || {}) as Partial<StockWarning> & {
      status?: StockWarningStatus;
      available?: number;
      requested?: number;
      message?: string;
    };

    nextWarnings[key] = {
      status: (warning.status ?? "ok") as StockWarningStatus,
      available: Number(warning.available ?? 0),
      requested: Number(warning.requested ?? 0),
      message: String(warning.message ?? ""),
      updatedAt: now,
    };
  }

  return nextWarnings;
};

const normalizeHintMap = (
  payload: unknown,
  warningsByVariantId: Record<string, StockWarning>
): Record<string, StockHint> => {
  const now = Date.now();
  const nextHints: Record<string, StockHint> = {};

  for (const [rawKey, value] of Object.entries((payload as Record<string, unknown>) || {})) {
    const key = toKey(rawKey);
    if (warningsByVariantId[key]) continue;

    const hint = (value || {}) as Partial<StockHint> & { message?: string };
    if (!hint.message) continue;

    nextHints[key] = {
      kind: "last_unit",
      message: String(hint.message),
      updatedAt: now,
    };
  }

  return nextHints;
};

const isBlockingWarningStatus = (status?: StockWarningStatus) => {
  return (
    status === "exceeds_stock" ||
    status === "insufficient" ||
    status === "missing" ||
    status === "inactive" ||
    status === "error"
  );
};

export type CartStockSlice = Pick<
  CartState,
  | "stockWarningsByVariantId"
  | "stockHintsByVariantId"
  | "lastStockValidateRequestId"
  | "stockValidateStatus"
  | "lastStockValidateAt"
  | "validateStockNow"
  | "scheduleValidate"
  | "refreshStockValidation"
  | "setStockWarnings"
  | "setStockHints"
  | "setStockValidateStatus"
  | "setLastStockValidateAt"
  | "clearStockValidation"
  | "upsertStockWarning"
  | "upsertStockHint"
  | "clearStockHint"
  | "applyOptimisticStockCheck"
  | "hasStockWarnings"
  | "hasBlockingStockIssues"
  | "getStockWarning"
  | "getStockHint"
>;

/**
 * Stock / validation domain only.
 *
 * Responsibilities owned here:
 * - warnings / hints state
 * - validation status metadata
 * - debounced scheduling
 * - request cancellation and anti-stale sequence
 * - warning / hint normalization
 * - stock read helpers
 *
 * Explicitly out of scope:
 * - items mutations
 * - legacy drawer UI state
 * - persist configuration
 * - global clearCart orchestration
 */
export const createCartStockSlice: StateCreator<
  CartState,
  [],
  [],
  CartStockSlice
> = (set, get) => ({
  stockWarningsByVariantId: {},
  stockHintsByVariantId: {},
  lastStockValidateRequestId: 0,
  stockValidateStatus: "idle" satisfies StockValidateStatus,
  lastStockValidateAt: 0,

  setStockValidateStatus: (status) => set({ stockValidateStatus: status }),

  setLastStockValidateAt: (timestamp) => set({ lastStockValidateAt: timestamp }),

  clearStockValidation: () =>
    set({
      stockWarningsByVariantId: {},
      stockHintsByVariantId: {},
      stockValidateStatus: "idle",
      lastStockValidateAt: 0,
    }),

  scheduleValidate: (reason) => {
    clearValidateTimer();

    stockValidateTimer = setTimeout(() => {
      if (DEV_VALIDATE_LOGS) {
        console.log("VALIDATE scheduled run", { reason });
      }

      void get().validateStockNow(reason);
    }, STOCK_VALIDATE_DEBOUNCE_MS);
  },

  refreshStockValidation: async () => {
    get().scheduleValidate("qty");
  },

  validateStockNow: async (reason) => {
    const itemsPayload = buildValidationPayload(get().items);

    if (DEV_VALIDATE_LOGS) {
      console.log("VALIDATE payload", { reason, itemsPayload });
    }

    if (!itemsPayload.length) {
      abortActiveValidationRequest();
      get().clearStockValidation();
      return;
    }

    abortActiveValidationRequest();
    clearValidateTimer();

    stockAbortController = new AbortController();

    const mySeq = ++stockValidateSeq;
    if (DEV_VALIDATE_LOGS) {
      console.log("VALIDATE start", mySeq, { reason, itemsPayload });
    }

    set({
      lastStockValidateRequestId: mySeq,
      stockValidateStatus: "checking",
    });

    try {
      const response = await validateCartStock(itemsPayload, {
        signal: stockAbortController.signal,
      });

      if (DEV_VALIDATE_LOGS) {
        console.log("VALIDATE done", mySeq, {
          warningsByVariantId: (response as any)?.warningsByVariantId,
          hintsByVariantId: (response as any)?.hintsByVariantId,
        });
      }

      const isLatest = mySeq === stockValidateSeq;
      if (DEV_VALIDATE_LOGS) {
        console.log("VALIDATE apply", mySeq, {
          isLatest,
          currentSeq: stockValidateSeq,
        });
      }
      if (!isLatest) return;

      const warningsPayload = (response as any)?.warningsByVariantId || {};
      const hintsPayload = (response as any)?.hintsByVariantId || {};

      get().setStockWarnings(warningsPayload);
      get().setStockHints(hintsPayload);
      set({ stockValidateStatus: "ok" });
      get().setLastStockValidateAt(Date.now());
    } catch (error: any) {
      if (error?.name === "AbortError") return;

      if (DEV_VALIDATE_LOGS) {
        console.log("VALIDATE error", mySeq, error);
      }
      if (mySeq !== stockValidateSeq) return;

      set({
        stockWarningsByVariantId: {},
        stockHintsByVariantId: {},
        stockValidateStatus: "error",
      });
      get().setLastStockValidateAt(Date.now());
    }
  },

  setStockWarnings: (payload) => {
    const nextWarnings = normalizeWarningMap(payload);
    const prevHints = get().stockHintsByVariantId;
    const nextHints = { ...prevHints };

    for (const key of Object.keys(nextWarnings)) {
      delete nextHints[key];
    }

    set({
      stockWarningsByVariantId: nextWarnings,
      stockHintsByVariantId: nextHints,
    });
  },

  setStockHints: (payload) => {
    const nextHints = normalizeHintMap(payload, get().stockWarningsByVariantId);
    set({ stockHintsByVariantId: nextHints });
  },

  upsertStockWarning: (variantId, warning) => {
    const now = Date.now();

    set((state) => {
      const key = toKey(variantId);
      const nextHints = { ...state.stockHintsByVariantId };
      delete nextHints[key];

      const prev = state.stockWarningsByVariantId[key];
      const nextWarnings = { ...state.stockWarningsByVariantId };

      nextWarnings[key] = {
        status: (warning.status ?? prev?.status ?? "ok") as StockWarningStatus,
        available: warning.available ?? prev?.available ?? 0,
        requested: (warning as Partial<StockWarning>).requested ?? prev?.requested ?? 0,
        message: warning.message ?? prev?.message ?? "",
        updatedAt: now,
      };

      return {
        stockWarningsByVariantId: nextWarnings,
        stockHintsByVariantId: nextHints,
      };
    });
  },

  upsertStockHint: (variantId, hint) => {
    const now = Date.now();

    set((state) => {
      const key = toKey(variantId);

      if (state.stockWarningsByVariantId[key]) {
        const nextHints = { ...state.stockHintsByVariantId };
        delete nextHints[key];
        return { stockHintsByVariantId: nextHints };
      }

      const prev = state.stockHintsByVariantId[key];
      const nextHints = { ...state.stockHintsByVariantId };
      const message = hint.message ?? prev?.message ?? "";

      if (!message) {
        delete nextHints[key];
        return { stockHintsByVariantId: nextHints };
      }

      nextHints[key] = {
        kind: "last_unit",
        message,
        updatedAt: now,
      };

      return { stockHintsByVariantId: nextHints };
    });
  },

  clearStockHint: (variantId) => {
    set((state) => {
      const key = toKey(variantId);
      if (!state.stockHintsByVariantId[key]) return {} as Partial<CartState>;

      const nextHints = { ...state.stockHintsByVariantId };
      delete nextHints[key];
      return { stockHintsByVariantId: nextHints };
    });
  },

  applyOptimisticStockCheck: () => {
    return;
  },

  hasStockWarnings: () => {
    const warnings = get().stockWarningsByVariantId;
    return Object.values(warnings).some((warning) => isBlockingWarningStatus(warning?.status));
  },

  hasBlockingStockIssues: () => {
    const warnings = get().stockWarningsByVariantId;
    return Object.values(warnings).some((warning) => isBlockingWarningStatus(warning?.status));
  },

  getStockWarning: (variantId) => {
    return get().stockWarningsByVariantId[toKey(variantId)];
  },

  getStockHint: (variantId) => {
    return get().stockHintsByVariantId[toKey(variantId)];
  },
});