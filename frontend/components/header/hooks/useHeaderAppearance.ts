"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import type { HeaderAppearance, HeaderViewFamily } from "../types";

const SCROLL_THRESHOLD = 8;

function resolveHeaderViewFamily(pathname: string | null): HeaderViewFamily {
  if (pathname === "/") {
    return "home";
  }

  if (pathname?.startsWith("/producto/")) {
    return "pdp";
  }

  return "internal";
}

function resolveHeaderAppearance(
  viewFamily: HeaderViewFamily,
  isScrolled: boolean,
): HeaderAppearance {
  if (viewFamily === "home") {
    return isScrolled ? "solid-internal" : "overlay-home";
  }

  return "solid-internal";
}

export function useHeaderAppearance() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const viewFamily = resolveHeaderViewFamily(pathname);
  const isHome = viewFamily === "home";
  const isPdp = viewFamily === "pdp";
  const isInternal = viewFamily === "internal";
  const headerAppearance = resolveHeaderAppearance(viewFamily, isScrolled);

  return {
    headerAppearance,
    isScrolled,
    isHome,
    isPdp,
    isInternal,
  };
}
