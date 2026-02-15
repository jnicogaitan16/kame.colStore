"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  apiFetch,
  checkout,
  validateCartStock,
  type CheckoutResponse,
} from "@/lib/api";
import { useCartStore } from "@/store/cart";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";
import FieldError from "@/components/forms/FieldError";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { normalizeApiError } from "@/lib/errors/normalizeApiError";

/* ---------------------------------------------
 * Helpers (pure)
 * ------------------------------------------- */

function isProd() {
  return process.env.NODE_ENV === "production";
}

function sanitizeCoPhone(
  input: string
): { ok: true; phone10: string } | { ok: false; message: string } {
  const raw = String(input || "");
  const digits = raw.replace(/\D/g, "");

  // If includes country code 57 + 10 digits => 12 digits total
  const normalized =
    digits.length === 12 && digits.startsWith("57")
      ? digits.slice(-10)
      : digits;

  // Colombia mobile: 10 digits, starts with 3
  if (normalized.length !== 10) {
    return { ok: false, message: "Ingresa un celular válido (10 dígitos)." };
  }
  if (!normalized.startsWith("3")) {
    return { ok: false, message: "El celular debe iniciar con 3." };
  }
  return { ok: true, phone10: normalized };
}

function formatCoPhoneDisplay(input: string): string {
  const digits = String(input || "").replace(/\D/g, "");

  // Si pegan +57..., nos quedamos con los últimos 10 (celular)
  const normalized = digits.length >= 10 ? digits.slice(-10) : digits;

  const a = normalized.slice(0, 3);
  const b = normalized.slice(3, 6);
  const c = normalized.slice(6, 10);

  if (!b) return a;
  if (!c) return `${a} ${b}`;
  return `${a} ${b} ${c}`;
}

function computeSubtotal(items: Array<{ price: string; quantity: number }>) {
  return Math.round(
    (items || []).reduce((acc, item) => acc + parseFloat(item.price) * item.quantity, 0)
  );
}

function looksLikeItemsError(key: string) {
  const k = String(key || "");
  return (
    k === "items" ||
    k.startsWith("items.") ||
    k.includes("items[") ||
    k.includes("items[")
  );
}

type City = { code: string; label: string };

async function fetchCities(): Promise<City[]> {
  const data = await apiFetch<{ cities: City[] }>("/cities/");
  return data.cities;
}

async function fetchShippingQuote(params: {
  city_code: string;
  subtotal: number;
}): Promise<{ amount: number; label: string } | null> {
  if (!params.city_code || params.subtotal <= 0) return null;
  return apiFetch<{ amount: number; label: string }>(
    `/shipping-quote/?city_code=${encodeURIComponent(params.city_code)}&subtotal=${params.subtotal}`
  );
}

/* ---------------------------------------------
 * Schema + Types
 * ------------------------------------------- */

const checkoutSchema = z.object({
  full_name: z.string().min(3, "Ingresa tu nombre completo"),
  email: z
    .string()
    .trim()
    .min(1, "Ingresa tu email")
    .email("Ingresa un email válido"),
  phone: z.string().min(7, "Ingresa un teléfono válido"),
  document_type: z.enum(["CC", "NIT"]),
  cedula: z
    .string()
    .trim()
    .min(1, "Documento obligatorio")
    .superRefine((val, ctx) => {
      // If empty after trim, the `.min(1, ...)` above will handle the message.
      if (!val) return;

      // Must be numeric only
      if (!/^\d+$/.test(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El documento debe contener solo números",
        });
        return;
      }

      // Numeric but too short
      if (val.length < 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Documento inválido",
        });
      }
    }),
  city_code: z.string().min(1, "Selecciona una ciudad"),
  address: z.string().min(5, "Ingresa una dirección"),
  notes: z.string().optional(),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

const FIELD_ORDER: Array<keyof CheckoutFormValues> = [
  "full_name",
  "phone",
  "cedula",
  "city_code",
  "address",
  "email",
  "document_type",
  "notes",
];

const FIELD_LABELS: Record<keyof CheckoutFormValues, string> = {
  full_name: "Nombre completo",
  email: "Email",
  phone: "Teléfono",
  document_type: "Tipo de documento",
  cedula: "Número de documento",
  city_code: "Ciudad",
  address: "Dirección",
  notes: "Indicaciones",
};

const FIELD_ALIASES: Record<string, keyof CheckoutFormValues> = {
  // backend / nested
  "customer.cedula": "cedula",
  document_number: "cedula",
  "customer.phone": "phone",
  "customer.full_name": "full_name",
  "customer.email": "email",
  // direct / alternates
  cedula: "cedula",
  phone: "phone",
  full_name: "full_name",
  email: "email",
  city_code: "city_code",
  address: "address",
  notes: "notes",
  document_type: "document_type",
};

const ALLOWED_FIELDS: Array<keyof CheckoutFormValues> = [
  "full_name",
  "email",
  "phone",
  "document_type",
  "cedula",
  "city_code",
  "address",
  "notes",
];

/* ---------------------------------------------
 * UI atoms inside the same file
 * ------------------------------------------- */

type CopyButtonProps = {
  valueToCopy: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  /** When true, renders as a full-width field (row) where the whole area copies */
  asField?: boolean;
  /** Optional left icon/content for field mode */
  leading?: ReactNode;
  /** Optional displayed value for field mode (defaults to valueToCopy) */
  displayValue?: string;
};

function CopyButton({
  valueToCopy,
  label = "Copiar",
  copiedLabel = "Copiado",
  className = "",
  asField = false,
  leading,
  displayValue,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        const text = valueToCopy || "";
        if (!text) return;

        const markCopied = () => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        };

        try {
          // Modern API (may fail on http or without user gesture permissions)
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            markCopied();
            return;
          }
        } catch {
          // fall through
        }

        try {
          // Fallback for http / older browsers
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "true");
          ta.style.position = "fixed";
          ta.style.left = "-9999px";
          ta.style.top = "0";
          document.body.appendChild(ta);
          ta.select();
          ta.setSelectionRange(0, ta.value.length);
          const ok = document.execCommand("copy");
          document.body.removeChild(ta);
          if (ok) markCopied();
        } catch {
          // ignore
        }
      }}
      className={
        (asField
          ? "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 hover:bg-white/10"
          : "inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/10") +
        " " +
        className
      }
    >
      {asField ? (
        <span className="flex w-full items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-3">
            {leading ? <span className="shrink-0">{leading}</span> : null}
            <span className="truncate font-mono tracking-wide text-white">
              {displayValue ?? valueToCopy}
            </span>
          </span>
          <span className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/85">
            {copied ? copiedLabel : label}
          </span>
        </span>
      ) : (
        <>{copied ? copiedLabel : label}</>
      )}
    </button>
  );
}

/* ---------------------------------------------
 * Main Component
 * ------------------------------------------- */

export default function CheckoutClient() {
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const applyOptimisticStockCheck = useCartStore(
    (state) => state.applyOptimisticStockCheck
  );
  const setStockWarnings = useCartStore((state) => state.setStockWarnings);
  const getStockWarning = useCartStore((state) => state.getStockWarning);
  const hasStockWarnings = useCartStore((state) => state.hasStockWarnings);

  const [cities, setCities] = useState<City[]>([]);
  const [shipping, setShipping] = useState<{ amount: number; label: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // (kept) map for future: “Ajustar todos”
  const [exceedsByVariantId, setExceedsByVariantId] = useState<Record<number, number>>({});

  const stockValidateTimerRef = useRef<number | null>(null);
  const lastStockKeyRef = useRef<string>("");

  const [orderSummary, setOrderSummary] = useState<CheckoutResponse | null>(null);
  const [stockValidateFailed, setStockValidateFailed] = useState(false);

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitNotice, setSubmitNotice] = useState<{
    variant: "warning" | "error";
    tone?: "soft" | "strong";
    title: string;
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    setFocus,
    setValue,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { document_type: "CC" },
  });

  const subtotal = useMemo(() => computeSubtotal(items), [items]);

  const watchedCity = watch("city_code");

  const stockValidateItems = useMemo(() => {
    return (items || []).map((item) => ({
      product_variant_id: item.variantId,
      quantity: item.quantity,
    }));
  }, [items]);

  function fieldErrorId(name: keyof CheckoutFormValues) {
    return `${String(name)}-error`;
  }

  function inputBaseClass(extra?: string) {
    return (
      "w-full rounded-xl border bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-white/35 outline-none transition focus:border-white/20 focus:ring-2 focus:ring-white/20 " +
      (extra || "")
    ).trim();
  }

  function inputBorderClass(hasError: boolean) {
    return hasError
      ? " border-rose-500/30 ring-rose-500/20 focus:border-rose-500/45 focus:ring-rose-500/20"
      : " border-white/10";
  }


  // --- Robust field focusing helpers ---
  function findFieldElement(field: string): HTMLElement | null {
    try {
      const byName = document.querySelector(`[name="${field}"]`) as HTMLElement | null;
      if (byName) return byName;

      const byId = document.getElementById(field) as HTMLElement | null;
      if (byId) return byId;

      const byData = document.querySelector(`[data-field="${field}"]`) as HTMLElement | null;
      if (byData) return byData;

      // Last resort: find a wrapper marked with data-field-wrapper and pick first focusable
      const wrapper = document.querySelector(`[data-field-wrapper="${field}"]`) as HTMLElement | null;
      if (wrapper) {
        const focusable = wrapper.querySelector(
          "input, select, textarea, button, [tabindex]:not([tabindex='-1'])"
        ) as HTMLElement | null;
        if (focusable) return focusable;
      }

      return null;
    } catch {
      return null;
    }
  }

  function focusAndScrollField(field: keyof CheckoutFormValues) {
    // 1) RHF focus first
    try {
      setFocus(field as any);
    } catch {
      // ignore
    }

    // 2) DOM lookup after next paint (handles wrappers / delayed render)
    try {
      window.requestAnimationFrame(() => {
        const el = findFieldElement(String(field));
        if (!el) return;

        try {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch {
          // ignore
        }

        try {
          if (typeof (el as any).focus === "function") (el as any).focus();
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }
  }

  function focusFirstInvalid(errsLike: any) {
    try {
      const firstKey =
        FIELD_ORDER.find((k) => !!errsLike?.[k]) ||
        (Object.keys(errsLike || {})[0] as keyof CheckoutFormValues | undefined);

      if (!firstKey) return;
      focusAndScrollField(firstKey);
    } catch {
      // no-op
    }
  }

  function setValidationBanner(errsLike: any) {
    try {
      const orderedFields = FIELD_ORDER.filter((f) => !!errsLike?.[f]);
      const count = orderedFields.length;
      const first = orderedFields[0];
      if (!first || count <= 0) return;

      if (count === 1) {
        const msg = String((errsLike?.[first]?.message ?? "").toString()).trim();
        setSubmitNotice({
          variant: "warning",
          title: `Revisa: ${FIELD_LABELS[first]}`,
          message: msg || "Revisa el campo marcado e intenta de nuevo.",
        });
        return;
      }

      setSubmitNotice({
        variant: "warning",
        title: "Corrige los campos marcados",
        message: "Revisa los campos resaltados en rojo e intenta de nuevo.",
      });
    } catch {
      // ignore
    }
  }

  function buildCheckoutItems() {
    const cartItems = items ?? [];
    const mapped = cartItems
      .map((i) => {
        const rawId: any =
          (i as any).product_variant_id ?? (i as any).variantId ?? (i as any).id;
        const rawQty: any = (i as any).quantity ?? (i as any).qty ?? 1;
        const rawPrice: any =
          (i as any).unit_price ?? (i as any).unitPrice ?? (i as any).price ?? 0;

        const product_variant_id = Number(rawId);
        const quantity = Number(rawQty);

        let unit_price = 0;
        if (typeof rawPrice === "number") unit_price = rawPrice;
        else if (typeof rawPrice === "string") unit_price = parseFloat(rawPrice);
        else unit_price = Number(rawPrice);

        return {
          product_variant_id,
          quantity,
          // Snapshot del precio unitario (backend espera int)
          unit_price: Math.round(unit_price || 0),
        };
      })
      .filter(
        (x) =>
          Number.isFinite(x.product_variant_id) &&
          x.product_variant_id > 0 &&
          x.quantity > 0
      );

    return mapped;
  }

  function applyServerFieldErrors(apiFieldErrors: Record<string, any>) {
    const ordered: Array<keyof CheckoutFormValues> = [];

    for (const [path, rawMsgs] of Object.entries(apiFieldErrors || {})) {
      const key = String(path || "");
      if (!key) continue;

      // items.* errors are handled separately
      if (looksLikeItemsError(key)) continue;

      const mapped =
        FIELD_ALIASES[key] ||
        (ALLOWED_FIELDS.includes(key as any) ? (key as any) : null);
      if (!mapped) continue;

      const msgs = Array.isArray(rawMsgs) ? rawMsgs : [rawMsgs];
      const msg = String(msgs?.[0] ?? "").trim() || "Campo inválido";

      setError(mapped, { type: "server", message: msg });
      ordered.push(mapped);
    }

    const first = ordered[0];
    if (first) {
      focusAndScrollField(first);
    }

    return ordered;
  }

  async function runStockValidate() {
    if (!stockValidateItems.length) return;

    const key = JSON.stringify(stockValidateItems);
    if (key === lastStockKeyRef.current) return;
    lastStockKeyRef.current = key;

    try {
      const res = await validateCartStock(stockValidateItems);
      setStockWarnings(res.warningsByVariantId || {});
      setStockValidateFailed(false);
    } catch {
      // Non-blocking: only surface a technical message when we have no real stock warnings
      setStockValidateFailed(true);
    }
  }

  /* ---------------------------------------------
   * Effects
   * ------------------------------------------- */

  useEffect(() => {
    fetchCities()
      .then(setCities)
      .catch(() => setCities([]));
  }, []);

  useEffect(() => {
    if (stockValidateTimerRef.current) window.clearTimeout(stockValidateTimerRef.current);

    stockValidateTimerRef.current = window.setTimeout(() => {
      runStockValidate();
    }, 400);

    return () => {
      if (stockValidateTimerRef.current) window.clearTimeout(stockValidateTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockValidateItems]);

  useEffect(() => {
    if (!watchedCity || subtotal <= 0) return;
    fetchShippingQuote({ city_code: watchedCity, subtotal })
      .then((quote) => setShipping(quote))
      .catch(() => setShipping(null));
  }, [watchedCity, subtotal]);

  /* ---------------------------------------------
   * Handlers
   * ------------------------------------------- */

  const onInvalid = (errsLike: any) => {
    setSubmitAttempted(true);
    setValidationBanner(errsLike);
    focusFirstInvalid(errsLike);
  };

  const onSubmit = async (values: CheckoutFormValues) => {
    setSubmitAttempted(true);

    // Prevent double submit
    if (isSubmitting) return;

    if (!items.length) {
      setSubmitNotice({
        variant: "warning",
        title: "Carrito vacío",
        message: "Tu carrito está vacío.",
      });
      return;
    }

    setExceedsByVariantId({});
    setSubmitNotice(null);

    const checkoutItems = buildCheckoutItems();

    if (!checkoutItems.length) {
      setSubmitNotice({
        variant: "warning",
        title: "Carrito vacío",
        message: "Tu carrito está vacío. Agrega productos antes de confirmar.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // --- phone sanitizer ---
      const phoneCheck = sanitizeCoPhone(values.phone);
      if (!phoneCheck.ok) {
        setError("phone", { type: "manual", message: phoneCheck.message });
        setValidationBanner({ phone: { message: phoneCheck.message } });
        focusAndScrollField("phone");
        return;
      }

      const payload = {
        full_name: values.full_name,
        email: values.email,
        phone: phoneCheck.phone10,
        document_type: values.document_type,
        cedula: values.cedula,
        city_code: values.city_code,
        address: values.address,
        notes: values.notes || "",
        payment_method: "transferencia",
        items: checkoutItems,
      };

      const res = await checkout(payload);

      setOrderSummary(res);
      clearCart();
    } catch (error: any) {
      const e = normalizeApiError(error);

      if (!isProd()) {
        // eslint-disable-next-line no-console
        console.error("Checkout error:", error, e);
      }

      setExceedsByVariantId({});

      const nextErrs: Partial<Record<keyof CheckoutFormValues, true>> = {};
      let hasItemsValidation = false;

      if (e.kind === "validation" && e.fieldErrors) {
        const entries = Object.entries(e.fieldErrors as Record<string, any>);

        for (const [rawKey] of entries) {
          const key = String(rawKey || "");
          if (looksLikeItemsError(key)) hasItemsValidation = true;
        }

        const applied = applyServerFieldErrors(e.fieldErrors as Record<string, any>);
        for (const f of applied) nextErrs[f] = true;
      }

      // If backend complains about items/qty/etc, treat as stock warning (human copy)
      if (e.kind === "validation" && hasItemsValidation) {
        setSubmitNotice({
          variant: "warning",
          title: "Stock insuficiente",
          message:
            "La cantidad solicitada supera el stock disponible para uno o más productos. Ajusta las cantidades según la disponibilidad mostrada y vuelve a intentar.",
        });
        setExceedsByVariantId({});
        return;
      }

      if (e.kind === "stock") {
        const wbv = (e.meta as any)?.warningsByVariantId;
        if (wbv && typeof wbv === "object") {
          setStockWarnings(wbv || {});
        }

        try {
          const src: any = wbv || null;
          const nextExceeds: Record<number, number> = {};
          if (src && typeof src === "object") {
            for (const [k, v] of Object.entries(src)) {
              const vid = Number(k);
              if (!Number.isFinite(vid)) continue;
              const status = (v as any)?.status;
              const available = (v as any)?.available;
              if (status === "exceeds_stock" && typeof available === "number") {
                nextExceeds[vid] = available;
              }
            }
          }
          setExceedsByVariantId(nextExceeds);
        } catch {
          setExceedsByVariantId({});
        }

        setSubmitNotice({
          variant: "warning",
          title: "Stock insuficiente",
          message:
            "La cantidad solicitada supera el stock disponible para uno o más productos. Ajusta las cantidades según la disponibilidad mostrada y vuelve a intentar.",
        });
        return;
      }

      if (e.kind === "validation") {
        const hasFieldErrors = Object.keys(nextErrs).length > 0;

        // Personalizado: si solo hay 1 error, mostramos label + mensaje específico.
        const orderedFields = FIELD_ORDER.filter((f) => !!nextErrs?.[f]);
        const count = orderedFields.length;
        const first = orderedFields[0];

        if (hasFieldErrors && count === 1 && first) {
          let msg = "";
          try {
            const fe = (e as any).fieldErrors as Record<string, any> | undefined;
            if (fe) {
              // find matching raw key mapped to this field
              const rawEntry = Object.entries(fe).find(([k]) => {
                const mapped = FIELD_ALIASES[String(k)] || (ALLOWED_FIELDS.includes(k as any) ? (k as any) : null);
                return mapped === first;
              });
              const rawMsgs = rawEntry ? rawEntry[1] : undefined;
              const arr = Array.isArray(rawMsgs) ? rawMsgs : rawMsgs != null ? [rawMsgs] : [];
              msg = String(arr?.[0] ?? "").trim();
            }
          } catch {
            // ignore
          }

          setSubmitNotice({
            variant: "warning",
            title: `Revisa: ${FIELD_LABELS[first]}`,
            message: msg || "Revisa el campo marcado e intenta de nuevo.",
          });
        } else {
          setSubmitNotice({
            variant: "warning",
            title: hasFieldErrors
              ? "Corrige los campos marcados"
              : e.title || "Revisa tu información",
            message: hasFieldErrors
              ? "Revisa los campos resaltados en rojo e intenta de nuevo."
              : e.message ||
                "Hay datos por revisar. Corrige los campos e intenta de nuevo.",
          });
        }

        if (hasFieldErrors) {
          // Regla D: si hay 1 solo error, enfoca SIEMPRE ese campo.
          if (count === 1 && first) {
            focusAndScrollField(first);
          } else {
            focusFirstInvalid(nextErrs);
          }
        }
        return;
      }

      if (e.kind === "server") {
        setSubmitNotice({
          variant: "error",
          tone: "strong",
          title: e.title || "No pudimos crear tu pedido",
          message:
            e.message || "Tuvimos un problema creando tu pedido. Intenta de nuevo.",
        });
        return;
      }

      // network (or unknown)
      setSubmitNotice({
        variant: "error",
        tone: "strong",
        title: e.title || "Sin conexión",
        message: e.message || "No pudimos conectar. Revisa tu internet e intenta de nuevo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------------------------------------------
   * “Pedido creado” view (transfer instructions)
   * ------------------------------------------- */

  if (!items.length && orderSummary) {
    const brebKey = process.env.NEXT_PUBLIC_BREB_KEY || "";
    const waPhone = process.env.NEXT_PUBLIC_WHATSAPP_PHONE || "";

    const totalNumber =
      typeof orderSummary.total === "number"
        ? orderSummary.total
        : typeof orderSummary.subtotal === "number"
          ? orderSummary.subtotal +
            (typeof orderSummary.shipping_cost === "number"
              ? orderSummary.shipping_cost
              : 0)
          : 0;

    const totalText = totalNumber.toLocaleString("es-CO");

    const waMessage = `Hola, ya realicé la transferencia del pedido #${orderSummary.order_id}.\nTotal: $${totalText}.\nAdjunto comprobante.${
      orderSummary.payment_reference
        ? `\nReferencia interna: ${orderSummary.payment_reference}`
        : ""
    }`;

    const whatsapp = waPhone
      ? buildWhatsAppUrl({ phone: waPhone, message: waMessage })
      : orderSummary.whatsapp_link;

    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-zinc-100">
        <h1 className="mb-6 text-center text-2xl font-bold tracking-tight text-zinc-100">
          Pedido creado
        </h1>

        <div className="card-surface mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-100">
          <div className="mb-5 flex flex-col items-center justify-center gap-3 text-center">
            <h2 className="text-lg font-semibold text-white">
              Paga por transferencia
            </h2>

            <div className="relative h-14 w-32 opacity-95">
              <Image
                src="/bre-b-logo.png"
                alt="Bre-B"
                fill
                className="object-contain"
                sizes="128px"
                priority
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="mt-2">
              {brebKey ? (
                <CopyButton
                  valueToCopy={brebKey}
                  asField
                  label="Copiar llave"
                  copiedLabel="Copiada"
                  leading={
                    <div className="relative h-4 w-4 opacity-90">
                      <Image
                        src="/bre-b-key.png"
                        alt="Llave Bre-B"
                        fill
                        className="object-contain"
                        sizes="16px"
                      />
                    </div>
                  }
                />
              ) : (
                <div className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                  (No configurada)
                </div>
              )}
            </div>
            {!brebKey ? (
              <p className="mt-2 text-xs text-amber-200/80">
                Configura{" "}
                <span className="font-mono">NEXT_PUBLIC_BREB_KEY</span> para
                mostrar tu llave.
              </p>
            ) : null}
          </div>

          <div className="mb-4 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              Total a transferir
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-white">
              ${totalText}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/80">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              Pasos
            </p>
            <ol className="list-decimal space-y-1 pl-4 text-sm text-white/80">
              <li>Abre tu app bancaria y elige transferir por Bre-B.</li>
              <li>Pega la llave Bre-B (cópiala con el botón).</li>
              <li>Transfiere el total exacto mostrado arriba.</li>
              <li>Cuando termines el pago, confirma.</li>
            </ol>
          </div>

          {(typeof orderSummary.subtotal === "number" ||
            typeof orderSummary.total === "number") && (
            <div className="mt-4 space-y-2">
              {typeof orderSummary.subtotal === "number" && (
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>
                    ${orderSummary.subtotal.toLocaleString("es-CO")}
                  </span>
                </div>
              )}
              {typeof orderSummary.shipping_cost === "number" && (
                <div className="flex justify-between">
                  <span>Envío</span>
                  <span>
                    ${orderSummary.shipping_cost.toLocaleString("es-CO")}
                  </span>
                </div>
              )}
              {typeof orderSummary.total === "number" && (
                <div className="flex justify-between border-t border-white/10 pt-2 font-semibold">
                  <span>Total</span>
                  <span>${orderSummary.total.toLocaleString("es-CO")}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {whatsapp ? (
            <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex w-full">
              <Button type="button" variant="primary" fullWidth>
                Confirmar pago
              </Button>
            </a>
          ) : null}

          <Link href="/" className="inline-flex w-full">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/5"
            >
              Volver al inicio
            </button>
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------
   * Main checkout view
   * ------------------------------------------- */

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8 text-zinc-100 md:flex-row md:py-12">
      <section className="w-full md:w-2/3">
        <h1 className="mb-6 text-center text-2xl font-bold tracking-tight text-zinc-100">
          Checkout
        </h1>

        {!items.length && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            Tu carrito está vacío.{" "}
            <Link
              href="/"
              className="font-medium text-white/85 hover:text-white hover:underline"
            >
              Volver a la tienda
            </Link>
          </div>
        )}

        {items.length > 0 && (
          <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                Datos de contacto
              </h2>

              <div className="space-y-4">
                <div data-field-wrapper="full_name">
                  <label className="mb-1 block text-sm font-medium text-white/80">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    id="full_name"
                    data-field="full_name"
                    {...register("full_name")}
                    className={inputBaseClass(
                      inputBorderClass(!!(submitAttempted && errors.full_name))
                    )}
                    aria-invalid={submitAttempted && errors.full_name ? true : undefined}
                    aria-describedby={errors.full_name ? fieldErrorId("full_name") : undefined}
                  />
                  <FieldError
                    id={fieldErrorId("full_name")}
                    message={errors.full_name?.message as string}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div data-field-wrapper="email">
                    <label className="mb-1 block text-sm font-medium text-white/80">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      data-field="email"
                      placeholder="correo@ejemplo.com"
                      {...register("email")}
                      className={inputBaseClass(
                        inputBorderClass(!!(submitAttempted && errors.email))
                      )}
                      aria-invalid={submitAttempted && errors.email ? true : undefined}
                      aria-describedby={errors.email ? fieldErrorId("email") : undefined}
                    />
                    <FieldError
                      id={fieldErrorId("email")}
                      message={errors.email?.message as string}
                    />
                  </div>

                  <div data-field-wrapper="phone">
                    <label className="mb-1 block text-sm font-medium text-white/80">
                      Teléfono
                    </label>

                    <div
                      className={
                        "flex rounded-xl border bg-white/5 text-sm text-zinc-100 transition focus-within:border-white/20 focus-within:ring-2 focus-within:ring-white/20" +
                        (submitAttempted && errors.phone
                          ? " border-rose-500/30 ring-rose-500/20 focus-within:border-rose-500/45 focus-within:ring-rose-500/20"
                          : " border-white/10")
                      }
                    >
                      <div className="flex items-center gap-1 border-r border-white/10 bg-white/5 px-3 text-white/80">
                        <span aria-hidden>🇨🇴</span>
                        <span className="text-xs font-semibold text-white/80">+57</span>
                      </div>

                      <input
                        type="tel"
                        id="phone"
                        data-field="phone"
                        {...register("phone", {
                          onChange: (e) => {
                            const next = formatCoPhoneDisplay(e.target.value);
                            setValue("phone", next, {
                              shouldDirty: true,
                              shouldValidate: submitAttempted,
                            });
                          },
                        })}
                        placeholder="310 000 0000"
                        inputMode="numeric"
                        autoComplete="tel"
                        className="h-10 w-full rounded-r-xl border-0 bg-transparent px-3 py-2 text-sm text-zinc-100 placeholder:text-white/35 focus:outline-none"
                        aria-invalid={submitAttempted && errors.phone ? true : undefined}
                        aria-describedby={errors.phone ? fieldErrorId("phone") : undefined}
                      />
                    </div>

                    <FieldError
                      id={fieldErrorId("phone")}
                      message={errors.phone?.message as string}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div data-field-wrapper="document_type">
                    <label className="mb-1 block text-sm font-medium text-white/80">
                      Tipo de documento
                    </label>
                    <select
                      id="document_type"
                      data-field="document_type"
                      {...register("document_type")}
                      className={inputBaseClass(
                        inputBorderClass(!!(submitAttempted && errors.document_type))
                      )}
                      aria-invalid={submitAttempted && errors.document_type ? true : undefined}
                      aria-describedby={
                        errors.document_type ? fieldErrorId("document_type") : undefined
                      }
                    >
                      <option value="CC">CC</option>
                      <option value="NIT">NIT</option>
                    </select>
                    <FieldError
                      id={fieldErrorId("document_type")}
                      message={errors.document_type?.message as string}
                    />
                  </div>

                  <div className="md:col-span-2" data-field-wrapper="cedula">
                    <label className="mb-1 block text-sm font-medium text-white/80">
                      Número de documento
                    </label>
                    <input
                      type="text"
                      id="cedula"
                      data-field="cedula"
                      {...register("cedula")}
                      placeholder="1234567890"
                      className={inputBaseClass(
                        inputBorderClass(!!(submitAttempted && errors.cedula))
                      )}
                      aria-invalid={submitAttempted && errors.cedula ? true : undefined}
                      aria-describedby={errors.cedula ? fieldErrorId("cedula") : undefined}
                    />
                    <FieldError
                      id={fieldErrorId("cedula")}
                      message={errors.cedula?.message as string}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                Envío
              </h2>

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div data-field-wrapper="city_code">
                    <label className="mb-1 block text-sm font-medium text-white/80">
                      Ciudad
                    </label>
                    <select
                      id="city_code"
                      data-field="city_code"
                      {...register("city_code")}
                      className={inputBaseClass(
                        inputBorderClass(!!(submitAttempted && errors.city_code))
                      )}
                      aria-invalid={submitAttempted && errors.city_code ? true : undefined}
                      aria-describedby={errors.city_code ? fieldErrorId("city_code") : undefined}
                    >
                      <option value="">Selecciona una ciudad</option>
                      {cities.map((city) => (
                        <option key={city.code} value={city.code}>
                          {city.label}
                        </option>
                      ))}
                    </select>
                    <FieldError
                      id={fieldErrorId("city_code")}
                      message={errors.city_code?.message as string}
                    />
                  </div>

                  <div data-field-wrapper="address">
                    <label className="mb-1 block text-sm font-medium text-white/80">
                      Dirección
                    </label>
                    <input
                      type="text"
                      id="address"
                      data-field="address"
                      {...register("address")}
                      placeholder="Calle 123 #45-67"
                      className={inputBaseClass(
                        inputBorderClass(!!(submitAttempted && errors.address))
                      )}
                      aria-invalid={submitAttempted && errors.address ? true : undefined}
                      aria-describedby={errors.address ? fieldErrorId("address") : undefined}
                    />
                    <FieldError
                      id={fieldErrorId("address")}
                      message={errors.address?.message as string}
                    />
                  </div>
                </div>

                <div data-field-wrapper="notes">
                  <label className="mb-1 block text-sm font-medium text-white/80">
                    Indicaciones para el envío (opcional)
                  </label>
                  <textarea
                    rows={3}
                    id="notes"
                    data-field="notes"
                    {...register("notes")}
                    placeholder="Apartamento, portería, referencias..."
                    className={
                      "min-h-[96px] w-full resize-none" +
                      inputBorderClass(!!(submitAttempted && errors.notes)) +
                      " rounded-xl bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-white/35 outline-none transition focus:border-white/20 focus:ring-2 focus:ring-white/20"
                    }
                    aria-invalid={submitAttempted && errors.notes ? true : undefined}
                    aria-describedby={errors.notes ? fieldErrorId("notes") : undefined}
                  />
                  <FieldError
                    id={fieldErrorId("notes")}
                    message={errors.notes?.message as string}
                  />
                </div>
              </div>
            </div>

            {submitNotice && (
              <Notice variant={submitNotice.variant} tone={submitNotice.tone} title={submitNotice.title}>
                {submitNotice.message}
              </Notice>
            )}

            <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
              {isSubmitting ? "Procesando pedido..." : "Confirmar pedido"}
            </Button>
          </form>
        )}
      </section>

      <aside className="w-full md:w-1/3">
        <div className="card-surface rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
            Resumen del pedido
          </h2>

          {items.length === 0 ? (
            <p className="text-sm text-white/70">
              No hay productos en tu carrito.{" "}
              <Link href="/" className="font-medium text-white/85 hover:text-white hover:underline">
                Ver productos
              </Link>
            </p>
          ) : (
            <>
              <ul className="mb-4 max-h-56 space-y-3 overflow-y-auto text-sm">
                {items.map((item) => (
                  <li key={item.variantId} className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden product-media-surface">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.productName}
                            fill
                            className="object-contain p-2"
                            sizes="64px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-white/40">
                            <svg
                              className="h-6 w-6"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M8 11l2.5 3 3.5-4.5L19 16"
                              />
                            </svg>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-100">{item.productName}</p>
                        <p className="truncate text-xs text-white/60">
                          {item.variantLabel} × {item.quantity}
                        </p>

                        {(() => {
                          const w = getStockWarning(item.variantId);
                          if (!w || w.status === "ok") return null;

                          const available =
                            typeof w.available === "number" ? w.available : null;

                          const canAdjust =
                            available !== null &&
                            available >= 0 &&
                            available < item.quantity;

                          return (
                            <div className="mt-1">
                              <Notice variant="warning" tone="soft" compact title="Stock insuficiente">
                                <span>
                                  {available !== null ? (
                                    <>
                                      Solicitaste <span className="font-semibold">{item.quantity}</span>{" "}
                                      unidades, pero solo hay{" "}
                                      <span className="font-semibold">{available}</span> disponibles.
                                    </>
                                  ) : (
                                    <>La cantidad solicitada supera el stock disponible.</>
                                  )}
                                </span>
                              </Notice>

                              {canAdjust ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (available === 0) {
                                      removeItem(item.variantId);
                                    } else {
                                      applyOptimisticStockCheck(item.variantId, available);
                                      updateQuantity(item.variantId, available);
                                    }
                                  }}
                                  className="mt-2 inline-flex items-center justify-center rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-400/15"
                                >
                                  Ajustar a disponible
                                </button>
                              ) : null}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <span className="shrink-0 text-sm font-medium text-white">
                      ${(parseFloat(item.price) * item.quantity).toLocaleString("es-CO")}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${subtotal.toLocaleString("es-CO")}</span>
                </div>

                {shipping && (
                  <div className="flex justify-between">
                    <span>{shipping.label}</span>
                    <span>${shipping.amount.toLocaleString("es-CO")}</span>
                  </div>
                )}

                <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-base font-semibold">
                  <span>Total estimado</span>
                  <span>${(subtotal + (shipping ? shipping.amount : 0)).toLocaleString("es-CO")}</span>
                </div>

                <p className="mt-2 text-xs text-white/50">
                  El pedido se crea al confirmar y luego podrás realizar el pago por transferencia. Actualmente es el único medio de pago disponible.
                </p>

                {hasStockWarnings() && (
                  <div className="mt-3">
                    <Notice variant="warning" tone="soft" compact title="Stock insuficiente">
                      Hay productos cuya cantidad solicitada supera el stock disponible. Te recomendamos ajustar
                      cantidades antes de confirmar.
                    </Notice>
                  </div>
                )}

                {!hasStockWarnings() && stockValidateFailed && (
                  <div className="mt-3">
                    <Notice variant="warning" tone="soft" compact title="No pudimos validar el stock">
                      Intenta de nuevo en unos segundos. Si el problema persiste, continúa y confirmamos
                      disponibilidad por WhatsApp.
                    </Notice>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}