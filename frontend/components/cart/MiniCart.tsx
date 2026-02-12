"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCartStore } from "@/store/cart";
import type { StockWarningStatus } from "@/store/cart";
import { Button } from "@/components/ui/Button";
import { validateCartStock } from "@/lib/api";

export function MiniCart() {
  const items = useCartStore((s) => s.items);
  const isOpen = useCartStore((s) => s.isOpen);
  const closeCart = useCartStore((s) => s.closeCart);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const applyOptimisticStockCheck = useCartStore((s) => s.applyOptimisticStockCheck);
  const totalItems = useCartStore((s) => s.totalItems);
  const totalAmount = useCartStore((s) => s.totalAmount);
  const setStockWarnings = useCartStore((s) => s.setStockWarnings);
  const hasStockWarnings = useCartStore((s) => s.hasStockWarnings);
  const getStockWarning = useCartStore((s) => s.getStockWarning);
  const [animateIn, setAnimateIn] = useState(false);

  const validateTimerRef = useRef<number | null>(null);
  const lastPayloadRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const normalizeValidateItems = useMemo(() => {
    return (items || []).map((i) => ({
      product_variant_id: i.variantId,
      quantity: i.quantity,
    }));
  }, [items]);

  async function runStockValidation(signal?: AbortSignal) {
    // Avoid calling when cart is empty
    if (!normalizeValidateItems.length) return;

    // Deduplicate identical payloads (prevents spam on re-renders)
    const key = JSON.stringify(normalizeValidateItems);
    if (key === lastPayloadRef.current) return;
    lastPayloadRef.current = key;

    try {
      // NOTE: validateCartStock may not support signal argument; if so, call without it
      // const res = await validateCartStock(normalizeValidateItems, { signal });
      const res = await validateCartStock(normalizeValidateItems);
      // Store expects a map by variantId
      setStockWarnings(res.warningsByVariantId || {});
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      // If API fails, mark items with an "error" warning (non-blocking)
      const fallback: Record<number, { status: StockWarningStatus; available: number; message: string }> = {};
      for (const it of normalizeValidateItems) {
        fallback[it.product_variant_id] = {
          status: "error",
          available: 0,
          message: "No pudimos validar stock en este momento.",
        };
      }
      setStockWarnings(fallback);
    }
  }

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // Trigger entry animation on next frame
      requestAnimationFrame(() => setAnimateIn(true));
    } else {
      document.body.style.overflow = "";
      setAnimateIn(false);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    // clear any pending timer
    if (validateTimerRef.current) window.clearTimeout(validateTimerRef.current);

    // Only validate when drawer is open (best UX + less noise)
    if (!isOpen) return;

    // Abort previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Leading call: validate immediately
    runStockValidation(controller.signal);

    // Trailing call: validate again after 500ms to cover rapid clicks
    validateTimerRef.current = window.setTimeout(() => {
      // abort any request started by the leading call before starting trailing
      abortRef.current?.abort();
      const trailingController = new AbortController();
      abortRef.current = trailingController;
      runStockValidation(trailingController.signal);
    }, 500);

    return () => {
      if (validateTimerRef.current) window.clearTimeout(validateTimerRef.current);
      abortRef.current?.abort();
    };
  }, [isOpen, normalizeValidateItems]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm md:bg-transparent md:backdrop-blur-0"
        onClick={closeCart}
        aria-hidden
      />
      <aside
        className={`fixed right-0 top-0 z-[60] h-full w-[90%] max-w-md bg-black/45 backdrop-blur-2xl border-l border-white/10 elevation-soft flex flex-col transform transition-transform duration-300 ease-out will-change-transform ${animateIn ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-label="Carrito"
      >
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between text-neutral-100">
          <h2 className="text-lg font-semibold">Carrito ({totalItems()})</h2>
          <button
            type="button"
            onClick={closeCart}
            className="rounded p-2 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Cerrar carrito"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="py-8 text-center text-white/60">Tu carrito está vacío</p>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.variantId} className="px-5 py-4 flex gap-3 border-b border-white/5">
                  <div className="relative w-16 h-16 shrink-0 overflow-hidden product-media-surface">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.productName}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-white/40">
                        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/producto/${item.productSlug}`}
                      onClick={closeCart}
                      className="font-medium text-neutral-100 line-clamp-2 hover:text-white/90 hover:underline"
                    >
                      {item.productName}
                    </Link>
                    <p className="text-sm text-white/60">{item.variantLabel}</p>
                    {(() => {
                      const w = getStockWarning(item.variantId);
                      if (!w || w.status === "ok") return null;
                      return (
                        <p className="mt-1 text-xs text-amber-300/90">
                          {w.message}
                          {typeof w.available === "number" && w.available >= 0 ? (
                            <span className="text-amber-200/80"> (disp: {w.available})</span>
                          ) : null}
                        </p>
                      );
                    })()}
                    <div className="mt-1 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const nextQty = item.quantity - 1;
                            applyOptimisticStockCheck(item.variantId, nextQty);
                            updateQuantity(item.variantId, nextQty);
                          }}
                          className="pill w-8 h-8 p-0 bg-white/5 border border-white/10 hover:bg-white/10"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm text-white/80">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextQty = item.quantity + 1;
                            applyOptimisticStockCheck(item.variantId, nextQty);
                            updateQuantity(item.variantId, nextQty);
                          }}
                          className="pill w-8 h-8 p-0 bg-white/5 border border-white/10 hover:bg-white/10"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-medium text-white">
                        ${(parseFloat(item.price) * item.quantity).toLocaleString("es-CO")}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.variantId)}
                    className="shrink-0 text-white/45 hover:text-red-500"
                    aria-label="Quitar del carrito"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {items.length > 0 && (
          <div className="mt-auto px-5 py-5 border-t border-white/10 bg-black/45 backdrop-blur-2xl text-neutral-100">
            <div className="mb-4 flex items-baseline justify-between text-sm text-white/70">
              <span>Total</span>
              <span className="text-white font-semibold text-base">${totalAmount().toLocaleString("es-CO")}</span>
            </div>
            {hasStockWarnings() && (
              <div className="mb-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                Hay productos con disponibilidad limitada. Puedes seguir al checkout y lo validamos antes de crear tu pedido.
              </div>
            )}
            <Link href="/checkout" onClick={closeCart} className="block">
              <Button variant="primary" fullWidth>
                Ir al checkout
              </Button>
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
