"use client";

import Link from "next/link";
import Image from "next/image";

import Notice from "@/components/ui/Notice";
import StockWarningChip from "@/components/cart/StockWarningChip";
import { getProductPrimaryImage } from "@/lib/product-media";

type CheckoutSummaryItem = {
  variantId: number;
  productName: string;
  productSlug?: string;
  variantLabel: string;
  quantity: number;
  price: string;
  imageUrl: string | null;
  product?: {
    name?: string;
  } | null;
};

type ShippingQuote = {
  amount: number;
  label: string;
};

type StockWarningLike = {
  status?: string;
  available?: number | string | null;
  message?: string;
};

type StockHintLike = {
  kind?: string;
  message?: string;
};

type CheckoutSummaryProps = {
  items: CheckoutSummaryItem[];
  subtotal: number;
  shipping: ShippingQuote | null;
  hasBlockingWarnings: boolean;
  stockValidateStatus: "idle" | "checking" | "ok" | "error";
  stockWarningsByVariantId: Record<string, StockWarningLike>;
  stockHintsByVariantId: Record<string, StockHintLike>;
  handleAdjustToAvailable: (e?: React.MouseEvent, onlyVariantId?: number) => void;
};

type StockVisualState = {
  status: "low" | "over";
  message: string;
  detail?: string;
};

function parseFiniteNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (value == null) return NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeStockVisualState(params: {
  item: CheckoutSummaryItem;
  warning?: StockWarningLike;
  hint?: StockHintLike;
}): StockVisualState | null {
  const { item, warning, hint } = params;

  if (warning && String(warning.status || "ok") !== "ok") {
    const available = parseFiniteNumber(warning.available);
    const hasAvailable = Number.isFinite(available);
    const isOverRequested = hasAvailable && item.quantity > available;

    if (isOverRequested) {
      return {
        status: "over",
        message: "Stock limitado",
        detail: "Ajusta tu selección",
      };
    }

    const isLastUnit = hasAvailable && available === 1 && !isOverRequested;

    if (isLastUnit) {
      return {
        status: "low",
        message: "Última pieza de este drop",
      };
    }

    if (hasAvailable) {
      return {
        status: "low",
        message: "Drop casi agotado",
        detail: "Quedan pocas piezas",
      };
    }

    return {
      status: "over",
      message: "Stock limitado",
      detail: "Ajusta tu selección",
    };
  }

  if (hint?.kind === "last_unit") {
    return {
      status: "low",
      message: "Última pieza de este drop",
    };
  }

  return null;
}

function canAdjustToAvailable(item: CheckoutSummaryItem, warning?: StockWarningLike): boolean {
  if (!warning) return false;

  const status = String(warning.status || "ok");
  const isStockInsufficientStatus = status === "exceeds_stock" || status === "insufficient";
  if (!isStockInsufficientStatus) return false;

  const available = parseFiniteNumber(warning.available);
  return Number.isFinite(available) && available >= 0 && available < item.quantity;
}

export default function CheckoutSummary({
  items,
  subtotal,
  shipping,
  hasBlockingWarnings,
  stockValidateStatus,
  stockWarningsByVariantId,
  stockHintsByVariantId,
  handleAdjustToAvailable,
}: CheckoutSummaryProps) {
  const totalEstimated = subtotal + (shipping ? shipping.amount : 0);

  return (
    <aside className="w-full">
      <div className="summary-shell rounded-[1.75rem] border border-zinc-900/10 bg-white/90 p-4 shadow-[0_16px_36px_rgba(24,24,27,0.07),0_2px_6px_rgba(24,24,27,0.04)] backdrop-blur-sm md:p-6">
        <h2 className="type-section-title mb-4 text-zinc-700">Resumen del pedido</h2>

        {items.length === 0 ? (
          <p className="type-body text-zinc-600">
            No hay productos en tu carrito.{" "}
            <Link
              href="/"
              className="type-action text-zinc-800 transition-colors duration-200 hover:text-zinc-950 hover:underline"
            >
              Ver productos
            </Link>
          </p>
        ) : (
          <>
            <ul className="mb-5 max-h-56 space-y-0 overflow-y-auto pr-1 text-sm md:mb-6 md:max-h-72">
              {items.map((item) => {
                const warning = stockWarningsByVariantId[String(item.variantId)];
                const hint = stockHintsByVariantId[String(item.variantId)];
                const stockState = normalizeStockVisualState({ item, warning, hint });
                const canAdjust = canAdjustToAvailable(item, warning);
                const productLike = item.product || item;
                const thumb = getProductPrimaryImage(productLike) || item.imageUrl || "";
                const alt = item.product?.name || item.productName || "Producto";

                return (
                  <li
                    key={item.variantId}
                    className="summary-item flex items-start justify-between gap-3.5 border-b border-zinc-900/8 py-3.5 first:pt-0 last:border-b-0 last:pb-0"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3.5 pr-3">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-zinc-900/8 bg-white/92 shadow-[0_1px_2px_rgba(24,24,27,0.04)]">
                        {thumb ? (
                          <Image
                            src={thumb}
                            alt={alt}
                            fill
                            sizes="64px"
                            className="object-contain p-2"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-zinc-400">
                            <svg
                              className="h-6 w-6"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M8 11l2.5 3 3.5-4.5L19 16"
                              />
                            </svg>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="type-card-title line-clamp-2 text-zinc-950">{item.productName}</p>
                        <p className="type-ui-label mt-1 truncate text-zinc-600">
                          {item.variantLabel} × {item.quantity}
                        </p>

                        {stockState ? (
                          <div className="mt-3 min-w-0 max-w-[17.5rem] pr-1">
                            <StockWarningChip
                              status={stockState.status}
                              message={stockState.message}
                              detail={stockState.detail}
                              compact
                              className="w-full"
                              onAdjust={
                                canAdjust
                                  ? () => handleAdjustToAvailable(undefined, item.variantId)
                                  : undefined
                              }
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <span className="type-price mt-0.5 shrink-0 self-start text-right text-zinc-950">
                      ${ (parseFloat(item.price) * item.quantity).toLocaleString("es-CO") }
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="summary-totals rounded-[1.35rem] border border-zinc-900/10 bg-zinc-50/85 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] md:px-5 md:py-5">
              <div className="type-body flex items-center justify-between text-zinc-700">
                <span>Subtotal</span>
                <span>${subtotal.toLocaleString("es-CO")}</span>
              </div>

              {shipping ? (
                <div className="type-body mt-2 flex items-center justify-between text-zinc-700">
                  <span>{shipping.label}</span>
                  <span>${shipping.amount.toLocaleString("es-CO")}</span>
                </div>
              ) : null}

              <div className="type-price mt-4 flex items-center justify-between border-t border-zinc-900/10 pt-3 text-zinc-950">
                <span>Total estimado</span>
                <span>${totalEstimated.toLocaleString("es-CO")}</span>
              </div>

              <p className="type-body mt-3 text-zinc-600">
                El pedido se crea al confirmar y luego podrás realizar el pago por transferencia.
                Actualmente es el único medio de pago disponible.
              </p>

              {!hasBlockingWarnings && stockValidateStatus === "error" ? (
                <div className="mt-4">
                  <Notice
                    variant="warning"
                    tone="soft"
                    compact
                    title="No pudimos validar el stock"
                  >
                    Intenta de nuevo en unos segundos. Si el problema persiste, continúa y
                    confirmamos disponibilidad por WhatsApp.
                  </Notice>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}