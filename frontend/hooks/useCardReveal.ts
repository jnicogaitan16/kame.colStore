import { useEffect, useRef, useState } from "react";
import type React from "react";

type UseCardRevealOptions = {
  enabled: boolean;
  threshold?: number;
  rootMargin?: string;
};

const DEFAULT_THRESHOLD = 0.12;
const DEFAULT_ROOT_MARGIN = "0px 0px -8% 0px";

export function useCardReveal(
  options: UseCardRevealOptions
): {
  ref: React.RefObject<HTMLElement | null>;
  isVisible: boolean;
} {
  const { enabled, threshold = DEFAULT_THRESHOLD, rootMargin = DEFAULT_ROOT_MARGIN } =
    options;

  const ref = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(() => !enabled);

  useEffect(() => {
    if (!enabled) {
      setIsVisible(true);
      return;
    }

    setIsVisible(false);

    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const node = ref.current;

    if (!node) {
      return;
    }

    let observer: IntersectionObserver | null = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }

        setIsVisible(true);
        observer?.disconnect();
        observer = null;
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(node);

    return () => {
      observer?.disconnect();
      observer = null;
    };
  }, [enabled, threshold, rootMargin]);

  return {
    ref,
    isVisible,
  };
}