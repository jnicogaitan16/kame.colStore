/**
 * Tracking hooks for the Kame.col storefront.
 * Consumes the KameTracker singleton without modifying existing component logic.
 */
"use client";

import { useEffect, useRef, useCallback } from "react";
import { tracker } from "@/lib/tracker";

// Init tracker once per client mount
export function useTrackerInit() {
  useEffect(() => {
    tracker.init();
  }, []);
}

// ── Product hooks ──────────────────────────────────────────────────────────

export function useTrackProductView(product: {
  id?: number | string;
  name?: string;
  slug?: string;
} | null | undefined) {
  const tracked = useRef(false);

  useEffect(() => {
    if (!product || tracked.current) return;
    const timer = setTimeout(() => {
      if (tracked.current) return;
      tracked.current = true;
      tracker.track("product_view", {
        product_id: String(product.id || product.slug || ""),
        product_name: product.name || "",
      });
    }, 2000); // 2s dwell = intentional view
    return () => clearTimeout(timer);
  }, [product]);
}

export function trackProductClick(product: {
  id?: number | string;
  name?: string;
  slug?: string;
}) {
  tracker.track("product_click", {
    product_id: String(product.id || product.slug || ""),
    product_name: product.name || "",
  });
}

export function trackAddToCart(
  product: { id?: number | string; name?: string; slug?: string; price?: number | string },
  variant: { value?: string; color?: string }
) {
  tracker.track("add_to_cart", {
    product_id: String(product.id || product.slug || ""),
    product_name: product.name || "",
    variant: `${variant.value || ""} / ${variant.color || ""}`.trim().replace(/^\/|\/$/g, ""),
    price: typeof product.price === "string" ? parseFloat(product.price) : product.price,
  });
}

/** Cada carga de la página de inicio (/). */
export function trackHomeVisit() {
  tracker.track("home_visit");
}

export function trackCheckoutStart() {
  tracker.track("checkout_start");
}

export function trackCheckoutStep(step: string) {
  tracker.track("checkout_step", { step });
}

export function trackPurchaseComplete(order: {
  reference?: string;
  total?: number;
}) {
  tracker.track("purchase_complete", {
    step: order.reference || "",
    price: order.total,
  });
}

export function trackCartAbandon(items: Array<{ product_variant_id?: number; quantity?: number }>, step: string) {
  tracker.track("cart_abandon", {
    step,
    quantity: items.reduce((sum, i) => sum + (i.quantity || 0), 0),
  });
}

// Hook version for components
export function useTrackAddToCart() {
  return useCallback(
    (
      product: { id?: number | string; name?: string; slug?: string; price?: number | string },
      variant: { value?: string; color?: string }
    ) => trackAddToCart(product, variant),
    []
  );
}
