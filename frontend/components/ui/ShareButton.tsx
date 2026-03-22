"use client";

import { useEffect, useMemo, useState } from "react";

export interface ShareButtonProps {
  title: string;
  url: string;
  /** Optional accessible label override */
  ariaLabel?: string;
  /** Optional className to extend styling */
  className?: string;
}

export default function ShareButton({
  title: _title,
  url,
  ariaLabel = "Compartir producto",
  className = "",
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  void _title;

  /**
   * Construye una URL "canónica" para compartir:
   * - Si viene absoluta (http/https), se usa tal cual.
   * - Si viene relativa (/producto/slug), se monta sobre NEXT_PUBLIC_SITE_URL.
   * - Si no hay `url`, se intenta usar window.location.href.
   *
   * Esto ayuda a que WhatsApp / iMessage pidan los metadatos OG correctos
   * desde el dominio público (kamecol.com) en lugar de localhost.
   */
  const shareUrl = useMemo(() => {
    const raw = (url || "").trim();
    const envBase =
      (typeof process !== "undefined" &&
        process.env &&
        process.env.NEXT_PUBLIC_SITE_URL) ||
      "";

    const pickBase = () => {
      if (envBase) return envBase;
      if (typeof window !== "undefined") return window.location.origin;
      return "";
    };

    // 1) Si es absoluta, respetarla (pero forzar https para algunos clientes).
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      if (raw.startsWith("http://")) {
        return "https://" + raw.slice("http://".length);
      }
      return raw;
    }

    // 2) Si es relativa, montarla sobre el dominio público.
    const base = pickBase();
    if (raw) {
      try {
        const abs = new URL(raw, base).toString();
        if (abs.startsWith("http://")) {
          return "https://" + abs.slice("http://".length);
        }
        return abs;
      } catch {
        // ignore, caer al fallback
      }
    }

    // 3) Fallback: usar la URL actual del navegador.
    if (typeof window !== "undefined") {
      const current = window.location.href;
      if (current.startsWith("http://")) {
        return "https://" + current.slice("http://".length);
      }
      return current;
    }

    return "";
  }, [url]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  const handleShare = async () => {
    try {
      // 1) Hoja de compartir nativa (mobile)
      // Para que el comportamiento sea lo más parecido posible al share nativo de iOS,
      // solo pasamos la URL, sin `title` ni `text`. Así Mensajes trata el contenido
      // como "solo link" y genera la tarjeta OG igual que cuando compartes desde Safari.
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          url: shareUrl,
        });
        return;
      }

      // 2) Fallback: copiar al portapapeles (desktop)
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        return;
      }

      // 3) Último recurso: prompt
      window.prompt("Copia este enlace:", shareUrl);
    } catch (error) {
      const err = error as { name?: string } | null;

      // Cerrar o cancelar la hoja nativa de compartir NO debe mostrarse como error.
      if (err?.name === "AbortError" || err?.name === "NotAllowedError") {
        return;
      }

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
        "relative z-0 inline-flex -translate-x-1.5 items-center justify-center p-0.5 text-zinc-700 transition-colors hover:text-zinc-950 " +
        className
      }
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M12 16V4M12 4l-4 4M12 4l4 4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="4"
          y="12"
          width="16"
          height="8"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.6"
        />
      </svg>
    </button>
  );
}
