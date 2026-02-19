"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";

export function MiniCart() {
  const items = useCartStore((s) => s.items);
  const isOpen = useCartStore((s) => s.isOpen);
  const closeCart = useCartStore((s) => s.closeCart);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const stockWarningsByVariantId = useCartStore((s) => s.stockWarningsByVariantId);
  const stockHintsByVariantId = useCartStore((s) => s.stockHintsByVariantId);
  const [animateIn, setAnimateIn] = useState(false);

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


  function totalItems() {
    return (items || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
  }

  function totalAmount() {
    return (items || []).reduce((acc, it) => {
      const price = typeof it.price === "number" ? it.price : parseFloat(String(it.price || 0));
      const qty = Number(it.quantity || 0);
      return acc + (Number.isFinite(price) ? price : 0) * (Number.isFinite(qty) ? qty : 0);
    }, 0);
  }

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
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        loading="lazy"
                        className="h-full w-full object-cover"
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
                      // Store contract: getters normalize keys via String(variantId)
                      const key = String(item.variantId);
                      const h: any = stockHintsByVariantId[key];
                      const w: any = stockWarningsByVariantId[key];

                      const warningStatus = String(w?.status || "ok");
                      const hasWarningForItem = Boolean(w);
                      const isInsufficient =
                        warningStatus === "insufficient" || warningStatus === "exceeds_stock";

                      // Hint only when there is NO warning object for this item.
                      if (!hasWarningForItem && h?.kind === "last_unit" && h?.message) {
                        return (
                          <p className="mt-2 text-xs leading-snug text-white/70 whitespace-normal break-words">
                            ⚡ {h.message}
                          </p>
                        );
                      }

                      // Warning only when status indicates insufficient stock.
                      if (isInsufficient) {
                        const qty = Number(item.quantity || 0);

                        // Be defensive: backend keys may vary. Try common shapes.
                        const availableRaw =
                          w?.available ??
                          w?.available_stock ??
                          w?.available_qty ??
                          w?.stock_available ??
                          w?.stock ??
                          w?.remaining;

                        const available =
                          typeof availableRaw === "number"
                            ? availableRaw
                            : availableRaw != null
                              ? parseFloat(String(availableRaw))
                              : NaN;

                        const hasAvailable = Number.isFinite(available);

                        return (
                          <div className="mt-2">
                            <Notice variant="warning" tone="soft" compact title="Stock insuficiente">
                              {hasAvailable ? (
                                <p className="text-xs leading-snug text-amber-100/90">
                                  Pediste {qty}, pero solo quedan {available} en stock.
                                </p>
                              ) : (
                                <p className="text-xs leading-snug text-amber-100/90">
                                  La cantidad que pediste supera el stock disponible.
                                </p>
                              )}
                            </Notice>
                          </div>
                        );
                      }

                      return null;
                    })()}
                    <div className="mt-1 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const nextQty = item.quantity - 1;
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
