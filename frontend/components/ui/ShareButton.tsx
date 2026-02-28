"use client";

import { useEffect, useState } from "react";

export interface ShareButtonProps {
  title: string;
  url: string;
  /** Optional accessible label override */
  ariaLabel?: string;
  /** Optional className to extend styling */
  className?: string;
}

export default function ShareButton({
  title,
  url,
  ariaLabel = "Compartir producto",
  className = "",
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  const handleShare = async () => {
    try {
      const safeUrl = (url || "").trim() || (typeof window !== "undefined" ? window.location.href : "");

      // 1) Native share sheet (mobile)
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title, url: safeUrl });
        return;
      }

      // 2) Clipboard fallback (desktop)
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(safeUrl);
        setCopied(true);
        return;
      }

      // 3) Last resort
      window.prompt("Copia este enlace:", safeUrl);
    } catch {
      // Do not break UI
      try {
        window.alert("No se pudo compartir en este dispositivo.");
      } catch {
        // ignore
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={ariaLabel}
      title={copied ? "Enlace copiado" : "Compartir"}
      className={
        "inline-flex items-center justify-center p-1 text-white/80 hover:text-white transition-colors " +
        className
      }
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Standard share icon: 3 nodes + connectors (bold, premium) */}
        <path
          d="M8.2 11.3l7.6-4.4M8.2 12.7l7.6 4.4"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="6.5"
          cy="12"
          r="2.8"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <circle
          cx="17.5"
          cy="6.2"
          r="2.8"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <circle
          cx="17.5"
          cy="17.8"
          r="2.8"
          stroke="currentColor"
          strokeWidth="2.2"
        />
      </svg>
    </button>
  );
}
