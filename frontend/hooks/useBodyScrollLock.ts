"use client";

import { useEffect, useRef } from "react";

// Shared body scroll lock for drawers/modals. Keeps previous inline overflow and restores it on unlock.
export function useBodyScrollLock(locked: boolean): void {
  const previousOverflowRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (!locked) {
      if (previousOverflowRef.current !== null) {
        document.body.style.overflow = previousOverflowRef.current;
        previousOverflowRef.current = null;
      }
      return;
    }

    if (previousOverflowRef.current === null) {
      previousOverflowRef.current = document.body.style.overflow;
    }

    document.body.style.overflow = "hidden";

    return () => {
      if (previousOverflowRef.current !== null) {
        document.body.style.overflow = previousOverflowRef.current;
        previousOverflowRef.current = null;
      }
    };
  }, [locked]);
}