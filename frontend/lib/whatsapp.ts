

/**
 * WhatsApp link builder utility.
 *
 * Goal: centralize WhatsApp URL creation and avoid duplication across the app.
 *
 * Notes:
 * - `message` is always encoded with `encodeURIComponent`.
 * - `phone` must be digits only (no `+`, no spaces).
 */

export type BuildWhatsAppUrlArgs = {
  /** Phone number. Can include +, spaces, dashes; it will be normalized to digits. */
  phone: string;
  /** Message text to prefill in WhatsApp. */
  message: string;
};

/**
 * Normalizes a phone string into digits-only.
 * Examples:
 * - "+57 310 555 6480" -> "573105556480"
 * - "(1) 234-567" -> "1234567"
 */
export function normalizePhoneDigits(phone: string): string {
  return String(phone || "").replace(/\D+/g, "");
}

/**
 * Builds a WhatsApp URL using the wa.me format.
 *
 * - Always encodes `message` using `encodeURIComponent`.
 * - `phone` is normalized to digits-only.
 *
 * Returns:
 * - "https://wa.me/<phone>?text=<encodedMessage>"
 */
export function buildWhatsAppUrl({ phone, message }: BuildWhatsAppUrlArgs): string {
  const digits = normalizePhoneDigits(phone);
  const encoded = encodeURIComponent(message ?? "");

  // Keep it predictable: if message is empty, omit the query param.
  if (!encoded) return `https://wa.me/${digits}`;

  return `https://wa.me/${digits}?text=${encoded}`;
}

/**
 * Convenience helper that uses `NEXT_PUBLIC_WHATSAPP_PHONE` as default.
 * Useful for UI CTAs like "Hablar por WhatsApp".
 */
export function buildStoreWhatsAppUrl(message: string): string {
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_PHONE || "";
  return buildWhatsAppUrl({ phone, message });
}