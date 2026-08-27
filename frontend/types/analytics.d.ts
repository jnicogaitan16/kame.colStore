interface Window {
  gtag: (
    command: "event" | "config" | "js",
    targetOrName: string | Date,
    params?: Record<string, unknown>
  ) => void;
  fbq: (
    command: "track" | "init",
    eventName: string,
    params?: Record<string, unknown>
  ) => void;
  dataLayer: Record<string, unknown>[];
}
