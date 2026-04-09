"use client";

import { useEffect } from "react";
import { trackPurchaseComplete } from "@/hooks/useTracking";
import { tracker } from "@/lib/tracker";

/**
 * Dispara una sola vez por referencia (sessionStorage) el evento analytics purchase_complete
 * cuando el usuario llega a resultado con pago aprobado.
 */
export function TrackPurchaseComplete({
  reference,
  total,
}: {
  reference: string;
  total: number | null | undefined;
}) {
  useEffect(() => {
    const ref = (reference || "").trim();
    if (!ref) return;

    const key = `kame_analytics_purchase_${ref}`;
    try {
      if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key)) return;
    } catch {
      /* private mode */
    }

    try {
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }

    trackPurchaseComplete({
      reference: ref,
      total: total != null && total > 0 ? total : undefined,
    });
    void tracker.flush();
  }, [reference, total]);

  return null;
}
