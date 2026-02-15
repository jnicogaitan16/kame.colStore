export type NoticeVariant = "warning" | "error" | "info" | "success";

export type NoticeStyleTokens = {
  container: string;
  title: string;
  text: string;
};

export type NoticeTone = "soft" | "strong";

export type NoticeToneStyles = Record<NoticeTone, NoticeStyleTokens>;

/**
 * Centralized class tokens for <Notice /> variants.
 * Urban-dark glass aesthetic (no heavy solid panels).
 */
export const NOTICE_STYLES: Record<NoticeVariant, NoticeToneStyles> = {
  info: {
    soft: {
      container:
        "border border-neutral-700/20 bg-neutral-950/40 backdrop-blur-sm text-neutral-200",
      title: "text-neutral-100",
      text: "text-neutral-300",
    },
    strong: {
      container:
        "border border-neutral-500/40 bg-neutral-950/50 backdrop-blur-sm text-neutral-100",
      title: "text-neutral-50",
      text: "text-neutral-200",
    },
  },
  success: {
    soft: {
      container:
        "border border-emerald-500/15 bg-neutral-950/40 backdrop-blur-sm text-emerald-100/80",
      title: "text-emerald-200",
      text: "text-emerald-100/80",
    },
    strong: {
      container:
        "border border-emerald-500/40 bg-neutral-950/50 backdrop-blur-sm text-emerald-100",
      title: "text-emerald-300",
      text: "text-emerald-100",
    },
  },
  warning: {
    soft: {
      container:
        "border border-amber-500/15 bg-neutral-950/40 backdrop-blur-sm text-amber-100/80",
      title: "text-neutral-100",
      text: "text-neutral-300",
    },
    strong: {
      container:
        "border border-amber-500/40 bg-neutral-950/50 backdrop-blur-sm text-amber-100",
      title: "text-neutral-50",
      text: "text-neutral-200",
    },
  },
  error: {
    soft: {
      container:
        "border border-rose-500/15 bg-neutral-950/40 backdrop-blur-sm text-rose-100/80",
      title: "text-rose-200",
      text: "text-rose-100/80",
    },
    strong: {
      container:
        "border border-rose-500/40 bg-neutral-950/50 backdrop-blur-sm text-rose-100",
      title: "text-rose-300",
      text: "text-rose-100",
    },
  },
};