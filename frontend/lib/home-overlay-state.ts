export type HomeOverlayInput = {
  show_text?: boolean | null;
  cta_label?: string | null;
  cta_url?: string | null;
  mediaFailed?: boolean;
  fallbackCtaLabel?: string | null;
};

export function normalizeHomeRelativeHref(
  value: string | null | undefined
): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return null;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function resolveHomeOverlayState(input: HomeOverlayInput) {
  const mediaFailed = Boolean(input.mediaFailed);
  const showText = input.show_text !== false || mediaFailed;

  const ctaLabelRaw = mediaFailed ? input.fallbackCtaLabel : input.cta_label;
  const ctaLabel = String(ctaLabelRaw || "").trim() || null;

  const href = normalizeHomeRelativeHref(input.cta_url);
  const showOverlay = showText || Boolean(ctaLabel);

  return {
    showText,
    ctaLabel,
    href,
    showOverlay,
    hasLink: Boolean(href),
  };
}

export function buildHomeLinkAriaLabel(params: {
  ctaLabel: string | null;
  headline: string | null | undefined;
  fallback: string;
}): string {
  const headline = String(params.headline || "").trim() || params.fallback;
  if (params.ctaLabel) {
    return `${params.ctaLabel}: ${headline}`;
  }
  return `Abrir ${headline}`;
}
