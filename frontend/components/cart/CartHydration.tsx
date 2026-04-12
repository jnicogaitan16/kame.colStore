"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useCartStore } from "@/store/cart";

/**
 * Rehidrata el carrito desde localStorage en el cliente (Zustand persist).
 *
 * `useLayoutEffect` corre antes del paint del navegador (a diferencia de `useEffect`),
 * así el primer frame ya puede reflejar ítems persistidos — útil en E2E remoto (Vercel/CI)
 * y evita un flash de “carrito vacío” en checkout.
 *
 * En el servidor usamos `useEffect` para no disparar el warning de SSR de `useLayoutEffect`.
 */
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function CartHydration() {
  const hasRehydratedRef = useRef(false);

  useIsoLayoutEffect(() => {
    // Defensa contra doble ejecución en React StrictMode (dev)
    if (hasRehydratedRef.current) return;

    useCartStore.persist.rehydrate();
    hasRehydratedRef.current = true;
  }, []);

  return null;
}
