

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
  stockValidateStatus: "idle" | "loading" | "ok" | "error";
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
    const message =
      typeof warning.message === "string" && warning.message.trim()
        ? warning.message.trim()
        : "Drop casi agotado";

    return {
      status: hasAvailable && available <= 1 ? "low" : "over",
      message,
      detail: hasAvailable
        ? `Pediste ${item.quantity}. Solo quedan ${available} en este drop.`
        : "La cantidad que pediste supera las unidades disponibles.",
    };
  }

  if (hint?.kind === "last_unit" && hint?.message) {
    return {
      status: "low",
      message: String(hint.message),
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
    <aside className="w-full md:w-1/3">
      <div className="card-surface rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="type-section-title mb-3 text-white/60">Resumen del pedido</h2>

        {items.length === 0 ? (
          <p className="type-body text-white/70">
            No hay productos en tu carrito.{" "}
            <Link
              href="/"
              className="type-action text-white/85 hover:text-white hover:underline"
            >
              Ver productos
            </Link>
          </p>
        ) : (
          <>
            <ul className="mb-4 max-h-56 space-y-3 overflow-y-auto text-sm">
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
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden product-media-surface">
                        {thumb ? (
                          <Image
                            src={thumb}
                            alt={alt}
                            fill
                            sizes="64px"
                            className="object-contain p-2"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-white/40">
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

                      <div className="min-w-0">
                        <p className="type-card-title truncate text-zinc-100">{item.productName}</p>
                        <p className="type-ui-label truncate text-white/60">
                          {item.variantLabel} × {item.quantity}
                        </p>

                        {stockState ? (
                          <div className="mt-1">
                            <StockWarningChip
                              status={stockState.status}
                              message={stockState.message}
                              detail={stockState.detail}
                              compact
                            />
                          </div>
                        ) : null}

                        {canAdjust ? (
                          <button
                            type="button"
                            onClick={(e) => handleAdjustToAvailable(e, item.variantId)}
                            className="type-action mt-2 inline-flex items-center justify-center rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-white/82 transition hover:border-white/18 hover:bg-white/8"
                          >
                            Ajustar a disponible
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <span className="type-price shrink-0 text-white">
                      ${ (parseFloat(item.price) * item.quantity).toLocaleString("es-CO") }
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="space-y-1">
              <div className="type-body flex justify-between">
                <span>Subtotal</span>
                <span>${subtotal.toLocaleString("es-CO")}</span>
              </div>

              {shipping ? (
                <div className="type-body flex justify-between">
                  <span>{shipping.label}</span>
                  <span>${shipping.amount.toLocaleString("es-CO")}</span>
                </div>
              ) : null}

              <div className="type-price mt-2 flex justify-between border-t border-white/10 pt-2 text-white">
                <span>Total estimado</span>
                <span>${totalEstimated.toLocaleString("es-CO")}</span>
              </div>

              <p className="type-body mt-2 text-white/50">
                El pedido se crea al confirmar y luego podrás realizar el pago por transferencia.
                Actualmente es el único medio de pago disponible.
              </p>

              {!hasBlockingWarnings && stockValidateStatus === "error" ? (
                <div className="mt-3">
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