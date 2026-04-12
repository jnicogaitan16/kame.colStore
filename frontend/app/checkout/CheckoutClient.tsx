"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";

import { apiFetch, checkout, getWompiSignature, type CheckoutResponse } from "@/lib/api";
import { trackCheckoutStart, trackCheckoutStep } from "@/hooks/useTracking";
import { tracker } from "@/lib/tracker";
import { useCartStore, type CartState } from "@/store/cart";
import { normalizeApiError } from "@/lib/errors/normalizeApiError";
import { loadWompiScript } from "@/lib/wompi";
import { checkoutResultPath } from "@/lib/routes";

import CheckoutForm from "./components/CheckoutForm";
import CheckoutSummary from "./components/CheckoutSummary";

/* ---------------------------------------------
 * Helpers (pure)
 * ------------------------------------------- */

function isProd() {
  return process.env.NODE_ENV === "production";
}

/** E2E sandbox: Playwright inyecta llave real aunque el bundle de Next no tenga la env embebida. */
function wompiPublicKeyForWidget(): string {
  if (typeof window !== "undefined") {
    const injected = (
      window as unknown as { __KAME_E2E_WOMPI_PUBLIC_KEY__?: string }
    ).__KAME_E2E_WOMPI_PUBLIC_KEY__;
    if (typeof injected === "string") {
      const t = injected.trim();
      if (t && t !== "undefined" && t !== "null") return t;
    }
  }
  return String(process.env.NEXT_PUBLIC_WOMPI_PUBLIC_KEY ?? "").trim();
}

function sanitizeCoPhone(
  input: string
): { ok: true; phone10: string } | { ok: false; message: string } {
  const raw = String(input || "");
  const digits = raw.replace(/\D/g, "");

  const normalized =
    digits.length === 12 && digits.startsWith("57")
      ? digits.slice(-10)
      : digits;

  if (normalized.length !== 10) {
    return { ok: false, message: "Ingresa un celular válido (10 dígitos)." };
  }

  if (!normalized.startsWith("3")) {
    return { ok: false, message: "El celular debe iniciar con 3." };
  }

  return { ok: true, phone10: normalized };
}

function computeSubtotal(items: Array<{ price: string; quantity: number }>) {
  return Math.round(
    (items || []).reduce(
      (acc, item) => acc + parseFloat(item.price) * item.quantity,
      0
    )
  );
}

function looksLikeItemsError(key: string) {
  const k = String(key || "");
  return (
    k === "items" ||
    k.startsWith("items.") ||
    k.includes("items[")
  );
}

type City = { code: string; label: string };

type StoreStockWarningMap = CartState["stockWarningsByVariantId"];
type StoreStockHintMap = CartState["stockHintsByVariantId"];
type StoreScheduleValidate = CartState["scheduleValidate"];
type StoreStockValidateStatus = CartState["stockValidateStatus"];
type StoreCartItem = CartState["items"][number];

type CheckoutItemCandidate = StoreCartItem & {
  product_variant_id?: number;
  id?: number;
  qty?: number;
  unit_price?: number | string;
  unitPrice?: number | string;
};

type FieldErrorLike = {
  message?: string;
};

type FieldErrorsLike = Partial<Record<keyof CheckoutFormValues, FieldErrorLike>>;
type ApiFieldErrors = Record<string, unknown>;

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

function normalizeWarningsKeys<T = unknown>(input: unknown): Record<string, T> {
  if (!input || typeof input !== "object") return {};

  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(input)) {
    out[String(k)] = v as T;
  }
  return out;
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
      if (!val) return;

      if (!/^\d+$/.test(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El documento debe contener solo números",
        });
        return;
      }

      if (val.length < 6 || val.length > 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El documento debe tener entre 6 y 10 dígitos",
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
  "customer.cedula": "cedula",
  "customer.document_number": "cedula",
  document_number: "cedula",
  "customer.phone": "phone",
  "customer.full_name": "full_name",
  "customer.email": "email",
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
 * Main Component
 * ------------------------------------------- */

type PendingWompiOrder = {
  order: CheckoutResponse;
  customerData: {
    email: string;
    fullName: string;
    phone: string;
    legalId: string;
    legalIdType: string;
  };
};

export default function CheckoutClient() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);

  const setStockWarnings = useCartStore((state) => state.setStockWarnings);
  const setStockHints = useCartStore((state) => state.setStockHints);

  const scheduleValidate = useCartStore(
    (state): StoreScheduleValidate => state.scheduleValidate
  );

  const stockValidateStatus = useCartStore(
    (state): StoreStockValidateStatus => state.stockValidateStatus
  );

  const stockWarningsByVariantId = useCartStore(
    (state): StoreStockWarningMap => state.stockWarningsByVariantId
  );

  const stockHintsByVariantId = useCartStore(
    (state): StoreStockHintMap => state.stockHintsByVariantId
  );

  const hasBlockingWarnings = useMemo(() => {
    return (items || []).some((item) => {
      const warning = stockWarningsByVariantId[String(item.variantId)];
      const status = String(warning?.status || "ok");
      return status === "insufficient" || status === "exceeds_stock";
    });
  }, [items, stockWarningsByVariantId]);

  const adjustments = useMemo(() => {
    return (items || [])
      .map((item) => {
        const warning = stockWarningsByVariantId[String(item.variantId)];
        const status = String(warning?.status || "ok");

        if (!(status === "insufficient" || status === "exceeds_stock")) {
          return null;
        }

        const availableRaw = warning?.available;
        const available =
          typeof availableRaw === "number"
            ? availableRaw
            : Number(availableRaw);

        const safeAvailable = Number.isFinite(available) ? available : 0;

        // Política: si available es 0, NO auto-removemos aquí.
        // Dejamos qty mínimo 1 (se mantendrá el warning y el usuario deberá remover).
        const targetQty = Math.max(1, safeAvailable);

        if (item.quantity > targetQty) {
          return { variantId: item.variantId, qty: targetQty };
        }

        return null;
      })
      .filter(Boolean) as Array<{ variantId: number; qty: number }>;
  }, [items, stockWarningsByVariantId]);

  function handleAdjustToAvailable(
    e?: MouseEvent,
    onlyVariantId?: number
  ) {
    if (e) e.preventDefault();

    const list = onlyVariantId
      ? adjustments.filter((a) => a.variantId === onlyVariantId)
      : adjustments;

    if (!list.length) return;

    for (const adj of list) {
      updateQuantity(adj.variantId, adj.qty);
    }
    // No revalidate manual aquí: el store ya revalida al cambiar cantidades.
  }

  const [cities, setCities] = useState<City[]>([]);
  const [shipping, setShipping] = useState<{
    amount: number;
    label: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const lastStockKeyRef = useRef<string>("");
  const checkoutStepFormLoggedRef = useRef(false);
  const checkoutStepCityLoggedRef = useRef(false);

  const [pendingWompiOrder, setPendingWompiOrder] = useState<PendingWompiOrder | null>(null);

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


  function findFieldElement(field: string): HTMLElement | null {
    try {
      const byName = document.querySelector(
        `[name="${field}"]`
      ) as HTMLElement | null;
      if (byName) return byName;

      const byId = document.getElementById(field) as HTMLElement | null;
      if (byId) return byId;

      const byData = document.querySelector(
        `[data-field="${field}"]`
      ) as HTMLElement | null;
      if (byData) return byData;

      const wrapper = document.querySelector(
        `[data-field-wrapper="${field}"]`
      ) as HTMLElement | null;

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
    try {
      window.requestAnimationFrame(() => {
        const el = findFieldElement(String(field));
        if (!el) return;

        try {
          if (typeof el.focus === "function") {
            el.focus({ preventScroll: true });
          }
        } catch {
          // ignore
        }

        try {
          el.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }
  }

  function focusFirstInvalid(errsLike: FieldErrorsLike) {
    try {
      const firstKey =
        FIELD_ORDER.find((k) => !!errsLike?.[k]) ||
        (Object.keys(errsLike || {})[0] as
          | keyof CheckoutFormValues
          | undefined);

      if (!firstKey) return;
      focusAndScrollField(firstKey);
    } catch {
      // no-op
    }
  }

  function setValidationBanner(errsLike: FieldErrorsLike) {
    try {
      const orderedFields = FIELD_ORDER.filter((f) => !!errsLike?.[f]);
      const count = orderedFields.length;
      const first = orderedFields[0];

      if (!first || count <= 0) return;

      if (count === 1) {
        const msg = String(errsLike?.[first]?.message ?? "").trim();

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
      .map((rawItem) => {
        const item = rawItem as CheckoutItemCandidate;

        const rawId = item.product_variant_id ?? item.variantId ?? item.id;
        const rawQty = item.quantity ?? item.qty ?? 1;
        const rawPrice = item.unit_price ?? item.unitPrice ?? item.price ?? 0;

        const product_variant_id = Number(rawId);
        const quantity = Number(rawQty);

        let unit_price = 0;
        if (typeof rawPrice === "number") unit_price = rawPrice;
        else if (typeof rawPrice === "string") unit_price = parseFloat(rawPrice);
        else unit_price = Number(rawPrice);

        return {
          product_variant_id,
          quantity,
          unit_price: Math.round(unit_price || 0),
        };
      })
      .filter(
        (entry) =>
          Number.isFinite(entry.product_variant_id) &&
          entry.product_variant_id > 0 &&
          entry.quantity > 0
      );

    return mapped;
  }

  function applyServerFieldErrors(apiFieldErrors: ApiFieldErrors) {
    const ordered: Array<keyof CheckoutFormValues> = [];

    for (const [path, rawMsgs] of Object.entries(apiFieldErrors || {})) {
      const key = String(path || "");
      if (!key) continue;

      if (looksLikeItemsError(key)) continue;

      const mapped =
        FIELD_ALIASES[key] ||
        (ALLOWED_FIELDS.includes(key as keyof CheckoutFormValues)
          ? (key as keyof CheckoutFormValues)
          : null);

      if (!mapped) continue;

      const msgs = Array.isArray(rawMsgs) ? rawMsgs : [rawMsgs];
      const msg = String(msgs[0] ?? "").trim() || "Campo inválido";

      setError(mapped, { type: "server", message: msg });
      ordered.push(mapped);
    }

    const first = ordered[0];
    if (first) {
      focusAndScrollField(first);
    }

    return ordered;
  }

  /* ---------------------------------------------
   * Effects
   * ------------------------------------------- */

  useEffect(() => {
    fetchCities()
      .then(setCities)
      .catch(() => setCities([]));

    // Un solo checkout_start / formulario_checkout por montaje real: en dev React 18
    // (Strict Mode) monta → desmonta → vuelve a montar y repetiría el effect sin cleanup.
    const t = window.setTimeout(() => {
      trackCheckoutStart();
      if (!checkoutStepFormLoggedRef.current) {
        checkoutStepFormLoggedRef.current = true;
        trackCheckoutStep("formulario_checkout");
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!watchedCity || checkoutStepCityLoggedRef.current) return;
    checkoutStepCityLoggedRef.current = true;
    trackCheckoutStep("envio_ciudad");
  }, [watchedCity]);

  useEffect(() => {
    if (!stockValidateItems.length) return;

    const key = JSON.stringify(stockValidateItems);
    if (key === lastStockKeyRef.current) return;

    lastStockKeyRef.current = key;

    try {
      scheduleValidate("checkout");
    } catch {
      // ignore
    }
  }, [stockValidateItems, scheduleValidate]);

  useEffect(() => {
    if (!watchedCity || subtotal <= 0) return;

    fetchShippingQuote({ city_code: watchedCity, subtotal })
      .then((quote) => setShipping(quote))
      .catch(() => setShipping(null));
  }, [watchedCity, subtotal]);

  // Abre el Widget de Wompi cuando hay una orden pendiente
  useEffect(() => {
    if (!pendingWompiOrder) return;
    let cancelled = false;

    const { order, customerData } = pendingWompiOrder;

    async function openWidget() {
      try {
        const publicKey = wompiPublicKeyForWidget();
        if (!publicKey || publicKey === "undefined" || publicKey === "null") {
          throw new Error(
            "NEXT_PUBLIC_WOMPI_PUBLIC_KEY no configurado o inválido (reiniciá `npm run dev` tras editar .env.local)."
          );
        }

        const [sigData] = await Promise.all([
          getWompiSignature(order.payment_reference),
          loadWompiScript(),
        ]);

        if (cancelled) return;

        const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/$/, "");

        // redirectUrl solo se envía en entornos HTTPS (producción).
        // En localhost (http://) Wompi puede rechazar la solicitud con 403.
        // El callback de widget.open() maneja el resultado en todos los casos.
        const isHttps = siteUrl.startsWith("https://");
        const widget = new window.WidgetCheckout({
          currency: "COP",
          amountInCents: sigData.amount_in_cents,
          reference: sigData.reference,
          publicKey,
          ...(isHttps && {
            redirectUrl: `${siteUrl}${checkoutResultPath(sigData.reference)}`,
          }),
          signature: { integrity: sigData.integrity },
          customerData: {
            email: customerData.email,
            fullName: customerData.fullName,
            phoneNumber: customerData.phone,
            phoneNumberPrefix: "+57",
            legalId: customerData.legalId,
            legalIdType: customerData.legalIdType,
          },
        });

        trackCheckoutStep("wompi_widget_abierto");
        void tracker.flush();

        widget.open((result) => {
          if (cancelled) return;
          const ws = result.transaction?.status || "PENDING";
          router.push(checkoutResultPath(sigData.reference, ws));
        });
      } catch {
        if (!cancelled) {
          setSubmitNotice({
            variant: "error",
            tone: "strong",
            title: "Error al abrir el pago",
            message: "No pudimos abrir la pasarela de pago. Intenta de nuevo más tarde.",
          });
          setPendingWompiOrder(null);
        }
      }
    }

    openWidget();
    return () => {
      cancelled = true;
    };
  }, [pendingWompiOrder, router]);

  /* ---------------------------------------------
   * Handlers
   * ------------------------------------------- */

  const onInvalid = (errsLike: FieldErrorsLike) => {
    setSubmitAttempted(true);
    setValidationBanner(errsLike);
    focusFirstInvalid(errsLike);
  };

  const onSubmit = async (values: CheckoutFormValues) => {
    setSubmitAttempted(true);

    if (isSubmitting) return;

    if (!items.length) {
      setSubmitNotice({
        variant: "warning",
        title: "Carrito vacío",
        message: "Tu carrito está vacío.",
      });
      return;
    }

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
        payment_method: "wompi",
        items: checkoutItems,
      };

      const res = await checkout(payload);

      trackCheckoutStep("orden_lista_para_pago");
      void tracker.flush();

      clearCart();
      setPendingWompiOrder({
        order: res,
        customerData: {
          email: values.email,
          fullName: values.full_name,
          phone: phoneCheck.phone10,
          legalId: values.cedula,
          legalIdType: values.document_type,
        },
      });
    } catch (error: unknown) {
      const e = normalizeApiError(error);

      if (!isProd()) {
        console.error("Checkout error:", error, e);
      }

      const nextErrs: Partial<Record<keyof CheckoutFormValues, true>> = {};
      let hasItemsValidation = false;

      if (e.kind === "validation" && e.fieldErrors) {
        const entries = Object.entries(e.fieldErrors as ApiFieldErrors);

        for (const [rawKey] of entries) {
          const key = String(rawKey || "");
          if (looksLikeItemsError(key)) {
            hasItemsValidation = true;
          }
        }

        const applied = applyServerFieldErrors(e.fieldErrors as ApiFieldErrors);
        for (const field of applied) {
          nextErrs[field] = true;
        }
      }

      if (e.kind === "validation" && hasItemsValidation) {
        setSubmitNotice({
          variant: "warning",
          title: "Stock limitado",
          message:
            "Algunos productos ya no tienen la cantidad seleccionada. Ajusta tu pedido para continuar.",
        });
        return;
      }

      if (e.kind === "stock") {
        const meta = (e.meta ?? {}) as {
          warningsByVariantId?: unknown;
          hintsByVariantId?: unknown;
        };

        const normalizedWarnings = normalizeWarningsKeys(meta.warningsByVariantId);
        const normalizedHints = normalizeWarningsKeys(meta.hintsByVariantId);

        setStockWarnings(
          normalizedWarnings && typeof normalizedWarnings === "object"
            ? normalizedWarnings
            : {}
        );

        setStockHints(
          normalizedHints && typeof normalizedHints === "object"
            ? normalizedHints
            : {}
        );

        setSubmitNotice({
          variant: "warning",
          title: "Stock limitado",
          message:
            "Algunos productos ya no tienen la cantidad seleccionada. Ajusta tu pedido para continuar.",
        });
        return;
      }

      if (e.kind === "validation") {
        const hasFieldErrors = Object.keys(nextErrs).length > 0;
        const orderedFields = FIELD_ORDER.filter((field) => !!nextErrs?.[field]);
        const count = orderedFields.length;
        const first = orderedFields[0];

        if (hasFieldErrors && count === 1 && first) {
          let msg = "";

          try {
            const fe = e.fieldErrors as ApiFieldErrors | undefined;

            if (fe) {
              const rawEntry = Object.entries(fe).find(([k]) => {
                const mapped =
                  FIELD_ALIASES[String(k)] ||
                  (ALLOWED_FIELDS.includes(k as keyof CheckoutFormValues)
                    ? (k as keyof CheckoutFormValues)
                    : null);

                return mapped === first;
              });

              const rawMsgs = rawEntry ? rawEntry[1] : undefined;
              const arr = Array.isArray(rawMsgs)
                ? rawMsgs
                : rawMsgs != null
                ? [rawMsgs]
                : [];

              msg = String(arr[0] ?? "").trim();
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
          if (count === 1 && first) {
            focusAndScrollField(first);
          } else {
            focusFirstInvalid(nextErrs as FieldErrorsLike);
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
            e.message ||
            "Tuvimos un problema creando tu pedido. Intenta de nuevo.",
        });
        return;
      }

      setSubmitNotice({
        variant: "error",
        tone: "strong",
        title: e.title || "Sin conexión",
        message:
          e.message ||
          "No pudimos conectar. Revisa tu internet e intenta de nuevo.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------------------------------------------
   * Pasarela Wompi — abriendo widget
   * ------------------------------------------- */

  if (pendingWompiOrder) {
    return (
      <div className={"flex min-h-[50vh] items-center justify-center px-4"}>
        <div className={"text-center"}>
          <div className={"mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-black/[0.12] border-t-black/70"} />
          <p className={"type-section-title text-black/70"}>{"Cargando pasarela de pago..."}</p>
          <p className={"type-body mt-2 text-black/45"}>{"Se abrira el widget de Wompi en un momento."}</p>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------
   * Main checkout view
   * ------------------------------------------- */

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-1 text-[#111111] md:flex-row md:gap-10 md:px-6 md:py-2">
      <section className="w-full md:w-[min(100%,44rem)] md:flex-1">
        <div className="mb-8">
          <p className="type-section-title mb-3 text-black/45">Finaliza tu pedido</p>
          <h1 className="type-page-title text-[#111111]">Checkout</h1>
          <p className="type-body mt-3 max-w-2xl text-black/62">
            Completa tus datos y disfruta tu compra sin complicaciones.
          </p>
        </div>

        {!items.length && (
          <div className="type-body rounded-[1.5rem] border border-black/8 bg-white px-5 py-5 text-black/70 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            Tu carrito está vacío.{" "}
            <Link
              href="/"
              className="type-action text-black/88 hover:text-black hover:underline"
            >
              Volver a la tienda
            </Link>
          </div>
        )}

        {items.length > 0 && (
          <CheckoutForm
            register={register}
            handleSubmit={handleSubmit}
            errors={errors}
            submitAttempted={submitAttempted}
            fieldErrorId={fieldErrorId}
            cities={cities}
            setValue={setValue}
            onSubmit={onSubmit}
            onInvalid={onInvalid}
            isSubmitting={isSubmitting}
            hasBlockingWarnings={hasBlockingWarnings}
            stockValidateStatus={stockValidateStatus}
            submitNotice={submitNotice}
          />
        )}
      </section>

      <div className="w-full md:sticky md:top-20 md:w-[26rem] md:self-start lg:w-[28rem] xl:w-[30rem]">
        <CheckoutSummary
          items={items}
          subtotal={subtotal}
          shipping={shipping}
          hasBlockingWarnings={hasBlockingWarnings}
          stockValidateStatus={stockValidateStatus}
          stockWarningsByVariantId={stockWarningsByVariantId}
          stockHintsByVariantId={stockHintsByVariantId}
          handleAdjustToAvailable={handleAdjustToAvailable}
        />
      </div>
    </div>
  );
}