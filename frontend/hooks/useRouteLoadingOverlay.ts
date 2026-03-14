

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function useRouteLoadingOverlay(): void {
  const pathname = usePathname();

  useEffect(() => {
    delete document.documentElement.dataset.routeLoading;

    const safetyTimeout = window.setTimeout(() => {
      delete document.documentElement.dataset.routeLoading;
    }, 4000);

    return () => {
      window.clearTimeout(safetyTimeout);
    };
  }, [pathname]);

  useEffect(() => {
    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (!anchor.href) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      document.documentElement.dataset.routeLoading = "1";
    };

    document.addEventListener("click", onClickCapture, true);

    return () => {
      document.removeEventListener("click", onClickCapture, true);
    };
  }, []);
}