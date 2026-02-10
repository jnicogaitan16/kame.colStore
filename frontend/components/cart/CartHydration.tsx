"use client";

import { useEffect } from "react";
import { useCartStore } from "@/store/cart";

/**
 * Rehidrata el carrito desde localStorage en el cliente (Zustand persist).
 */
export function CartHydration() {
  useEffect(() => {
    useCartStore.persist.rehydrate();
  }, []);
  return null;
}
