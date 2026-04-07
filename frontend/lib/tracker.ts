/**
 * KameTracker — singleton de analítica del lado cliente.
 *
 * - sessionId: crypto.randomUUID() guardado en sessionStorage (por tab).
 * - Acumula eventos en queue y los envía en lote cada 5s.
 * - En visibilitychange:hidden usa navigator.sendBeacon para no perder el lote.
 * - Exportado como singleton: import { tracker } from "@/lib/tracker"
 */

export type TrackEvent = {
  event: string;
  session_id: string;
  page?: string;
  product_id?: string;
  product_name?: string;
  variant?: string;
  quantity?: number;
  price?: number;
  step?: string;
  [key: string]: unknown;
};

const SESSION_KEY = "kame_session_id";
const ENDPOINT = "/api/events/";
const FLUSH_INTERVAL_MS = 5000;

function getOrCreateSessionId(): string {
  if (typeof sessionStorage === "undefined") return "ssr";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

class KameTracker {
  private sessionId: string;
  private queue: TrackEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  constructor() {
    this.sessionId = "ssr";
  }

  /** Call once on client-side mount (in a useEffect). */
  init() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;
    this.sessionId = getOrCreateSessionId();

    // Auto-flush every 5s
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);

    // Beacon on tab hidden / close
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.beacon();
    });
    window.addEventListener("beforeunload", () => this.beacon());
  }

  /** Track an event. Props merged with session_id + page. */
  track(eventName: string, props: Record<string, unknown> = {}) {
    if (typeof window === "undefined") return;

    const ev: TrackEvent = {
      event: eventName,
      session_id: this.sessionId,
      page: window.location.pathname,
      ...props,
    };
    this.queue.push(ev);
  }

  /** Flush queue via fetch (async, ignores errors silently). */
  async flush() {
    if (!this.queue.length) return;
    const batch = this.queue.splice(0, 100);
    try {
      await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch),
        keepalive: true,
      });
    } catch {
      // best-effort — don't break the storefront
    }
  }

  /** Beacon flush (synchronous on unload). */
  beacon() {
    if (!this.queue.length || typeof navigator === "undefined") return;
    const batch = this.queue.splice(0, 100);
    try {
      const blob = new Blob([JSON.stringify(batch)], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT, blob);
    } catch {
      // best-effort
    }
  }

  destroy() {
    if (this.flushTimer) clearInterval(this.flushTimer);
  }
}

export const tracker = new KameTracker();
