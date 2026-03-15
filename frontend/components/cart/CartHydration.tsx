"use client";

import { useEffect, useRef } from "react";
import { useCartStore } from "@/store/cart";

/**
 * Rehidrata el carrito desde localStorage en el cliente (Zustand persist).
 *
 * Nota:
 * Este componente solo se encarga de la rehidratación explícita del store.
 * No debe disparar validaciones de stock ni otros efectos colaterales.
 */
export function CartHydration() {
  const hasRehydratedRef = useRef(false);

  useEffect(() => {
    // Defensa contra doble ejecución en React StrictMode (dev)
    if (hasRehydratedRef.current) return;

    useCartStore.persist.rehydrate();
    hasRehydratedRef.current = true;
  }, []);

  return null;
}
