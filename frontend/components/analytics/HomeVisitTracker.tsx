"use client";

import { useEffect, useRef } from "react";
import { trackHomeVisit } from "@/hooks/useTracking";
import { tracker } from "@/lib/tracker";

/**
 * Cuenta cada carga del home (/) como visita. Una sesión puede generar varios hits si vuelve al inicio.
 */
export default function HomeVisitTracker() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackHomeVisit();
    void tracker.flush();
  }, []);

  return null;
}
