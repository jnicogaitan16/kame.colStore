"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { apiFetch, validateCartStock } from "@/lib/api";
import { useCartStore } from "@/store/cart";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/Button";

type City = { code: string; label: string };

const checkoutSchema = z.object({
  full_name: z.string().min(3, "Ingresa tu nombre completo"),
  email: z.string().email("Ingresa un email válido"),
  phone: z.string().min(7, "Ingresa un teléfono válido"),
  document_type: z.enum(["CC", "NIT"]),
  document_number: z.string().min(4, "Documento obligatorio"),
  city_code: z.string().min(1, "Selecciona una ciudad"),
  address: z.string().min(5, "Ingresa una dirección"),
  notes: z.string().optional(),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

async function fetchCities(): Promise<City[]> {
  const data = await apiFetch<{ cities: City[] }>("/orders/cities/");
  return data.cities;
}

async function fetchShippingQuote(params: {
  city_code: string;
  subtotal: number;
}): Promise<{ amount: number; label: string } | null> {
  if (!params.city_code || params.subtotal <= 0) return null;
  return apiFetch<{ amount: number; label: string }>(
    `/orders/shipping-quote/?city_code=${encodeURIComponent(
      params.city_code
    )}&subtotal=${params.subtotal}`
  );
}

export default function CheckoutClient() {
  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const setStockWarnings = useCartStore((state) => state.setStockWarnings);
  const getStockWarning = useCartStore((state) => state.getStockWarning);
  const hasStockWarnings = useCartStore((state) => state.hasStockWarnings);

  const [cities, setCities] = useState<City[]>([]);
  const [shipping, setShipping] = useState<{ amount: number; label: string } | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [stockBanner, setStockBanner] = useState<string | null>(null);
  const stockValidateTimerRef = useRef<number | null>(null);
  const lastStockKeyRef = useRef<string>("");
  const [orderSummary, setOrderSummary] = useState<{
    order_id: number;
    subtotal: number;
    total: number;
    shipping: { amount: number; label: string };
  } | null>(null);

  const subtotal = Math.round(
    items.reduce(
      (acc, item) => acc + parseFloat(item.price) * item.quantity,
      0
    )
  );

  const stockValidateItems = useMemo(() => {
    return (items || []).map((item) => ({
      product_variant_id: item.variantId,
      quantity: item.quantity,
    }));
  }, [items]);

  async function runStockValidate() {
    if (!stockValidateItems.length) return;

    const key = JSON.stringify(stockValidateItems);
    if (key === lastStockKeyRef.current) return;
    lastStockKeyRef.current = key;

    try {
      const res = await validateCartStock(stockValidateItems);
      setStockWarnings(res.warningsByVariantId || {});
    } catch {
      // Non-blocking: do not show errors for validation failures
    }
  }

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      document_type: "CC",
    },
  });

  const watchedCity = watch("city_code");

  useEffect(() => {
    fetchCities()
      .then(setCities)
      .catch(() => {
        setCities([]);
      });
  }, []);

  useEffect(() => {
    if (stockValidateTimerRef.current) window.clearTimeout(stockValidateTimerRef.current);

    // Debounce to avoid spamming when user edits quantities
    stockValidateTimerRef.current = window.setTimeout(() => {
      runStockValidate();
    }, 400);

    return () => {
      if (stockValidateTimerRef.current) window.clearTimeout(stockValidateTimerRef.current);
    };
  }, [stockValidateItems]);

  useEffect(() => {
    if (!watchedCity || subtotal <= 0) return;
    fetchShippingQuote({ city_code: watchedCity, subtotal })
      .then((quote) => setShipping(quote))
      .catch(() => setShipping(null));
  }, [watchedCity, subtotal]);

  const onSubmit = async (values: CheckoutFormValues) => {
    if (!items.length) {
      setSubmitError("Tu carrito está vacío.");
      return;
    }

    setStockBanner(null);
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        customer: {
          full_name: values.full_name,
          email: values.email || "",
          phone: values.phone,
          document_type: values.document_type,
          document_number: values.document_number,
        },
        shipping_address: {
          city_code: values.city_code,
          address: values.address,
          notes: values.notes || "",
        },
        items: items.map((item) => ({
          product_variant_id: item.variantId,
          quantity: item.quantity,
        })),
      };

      const res = await apiFetch<{
        order_id: number;
        subtotal: number;
        total: number;
        shipping: { amount: number; label: string };
      }>("/orders/checkout/", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setOrderSummary(res);
      clearCart();
    } catch (error: any) {
      // Default message
      const fallback =
        error?.message ||
        "No se pudo procesar tu pedido. Intenta de nuevo en unos minutos.";

      // Try to parse backend JSON from apiFetch error format: "API 400: <json>"
      let parsed: any = null;
      try {
        const msg = String(error?.message || "");
        const idx = msg.indexOf("API 400:");
        if (idx !== -1) {
          const raw = msg.slice(idx + "API 400:".length).trim();
          if (raw) parsed = JSON.parse(raw);
        }
      } catch {
        parsed = null;
      }

      const code = parsed?.code || parsed?.error || parsed?.detail_code;
      if (code === "STOCK_EXCEEDED" || parsed?.code === "STOCK_EXCEEDED") {
        // Banner + per-item warnings
        setStockBanner(
          parsed?.message ||
            "Algunos productos no tienen el stock solicitado. Ajusta cantidades o continúa y lo revisamos."
        );

        if (parsed?.warningsByVariantId) {
          setStockWarnings(parsed.warningsByVariantId || {});
        } else if (Array.isArray(parsed?.items)) {
          // Build warningsByVariantId from items if backend returns an array
          const map: Record<number, { status: import("@/store/cart").StockWarningStatus; available: number; message: string }> = {};
          for (const it of parsed.items) {
            const vid = Number(it.product_variant_id ?? it.variant_id ?? it.variantId);
            if (!Number.isFinite(vid)) continue;
            map[vid] = {
              status:
                it.status === "missing" ||
                it.status === "inactive" ||
                it.status === "error" ||
                it.status === "ok"
                  ? it.status
                  : "exceeds_stock",
              available: typeof it.available === "number" ? it.available : 0,
              message: it.message || "Stock insuficiente para este ítem.",
            };
          }
          setStockWarnings(map);
        }

        // Keep submitError null (banner is the UX)
        setSubmitError(null);
      } else {
        setSubmitError(fallback);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!items.length && orderSummary) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-zinc-100">
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-zinc-100">¡Gracias por tu pedido!</h1>
        <p className="mb-4 text-white/70">
          Hemos recibido tu orden <span className="font-semibold">#{orderSummary.order_id}</span>.
          Te contactaremos por WhatsApp o email para coordinar el pago y envío.
        </p>
        <div className="card-surface mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-100">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>${orderSummary.subtotal.toLocaleString("es-CO")}</span>
          </div>
          <div className="flex justify-between">
            <span>{orderSummary.shipping.label}</span>
            <span>${orderSummary.shipping.amount.toLocaleString("es-CO")}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-white/10 pt-2 font-semibold">
            <span>Total</span>
            <span>${orderSummary.total.toLocaleString("es-CO")}</span>
          </div>
        </div>
        <Link href="/" className="inline-flex w-full">
          <Button type="button" variant="primary" fullWidth>
            Volver al inicio
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8 text-zinc-100 md:flex-row md:py-12">
      <section className="w-full md:w-2/3">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-zinc-100">Checkout</h1>

        {!items.length && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            Tu carrito está vacío.{" "}
            <Link href="/" className="font-medium text-white/85 hover:text-white hover:underline">
              Volver a la tienda
            </Link>
          </div>
        )}

        {items.length > 0 && (
          <>
            {stockBanner && (
              <div className="mb-4 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
                {stockBanner}
              </div>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                Datos de contacto
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/80">Nombre completo</label>
                  <input
                    type="text"
                    {...register("full_name")}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-white/35 outline-none transition focus:border-white/20 focus:ring-2 focus:ring-white/20"
                  />
                  {errors.full_name && (
                    <p className="mt-1 text-xs text-red-600">{errors.full_name.message}</p>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-white/80">Email</label>
                    <input
                      type="email"
                      placeholder="correo@ejemplo.com"
                      {...register("email")}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-white/35 outline-none transition focus:border-white/20 focus:ring-2 focus:ring-white/20"
                    />
                    {errors.email && (
                      <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-white/80">Teléfono</label>
                    <div className="flex rounded-xl border border-white/10 bg-white/5 text-sm text-zinc-100 transition focus-within:border-white/20 focus-within:ring-2 focus-within:ring-white/20">
                      <div className="flex items-center gap-1 border-r border-white/10 bg-white/5 px-3 text-white/80">
                        <span aria-hidden>🇨🇴</span>
                        <span className="text-xs font-semibold text-white/80">+57</span>
                      </div>
                      <input
                        type="tel"
                        {...register("phone")}
                        placeholder="310 000 0000"
                        className="h-10 w-full rounded-r-xl border-0 bg-transparent px-3 py-2 text-sm text-zinc-100 placeholder:text-white/35 focus:outline-none"
                      />
                    </div>
                    {errors.phone && (
                      <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-white/80">Tipo de documento</label>
                    <select
                      {...register("document_type")}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-white/35 outline-none transition focus:border-white/20 focus:ring-2 focus:ring-white/20"
                    >
                      <option value="CC">CC</option>
                      <option value="NIT">NIT</option>
                    </select>
                    {errors.document_type && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.document_type.message as string}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-white/80">Número de documento</label>
                    <input
                      type="text"
                      {...register("document_number")}
                      placeholder="1234567890"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-white/35 outline-none transition focus:border-white/20 focus:ring-2 focus:ring-white/20"
                    />
                    {errors.document_number && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.document_number.message}
                      </p>
                    )}
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
                  <div>
                    <label className="mb-1 block text-sm font-medium text-white/80">Ciudad</label>
                    <select
                      {...register("city_code")}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-white/35 outline-none transition focus:border-white/20 focus:ring-2 focus:ring-white/20"
                    >
                      <option value="">Selecciona una ciudad</option>
                      {cities.map((city) => (
                        <option key={city.code} value={city.code}>
                          {city.label}
                        </option>
                      ))}
                    </select>
                    {errors.city_code && (
                      <p className="mt-1 text-xs text-red-600">{errors.city_code.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-white/80">Dirección</label>
                    <input
                      type="text"
                      {...register("address")}
                      placeholder="Calle 123 #45-67"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-white/35 outline-none transition focus:border-white/20 focus:ring-2 focus:ring-white/20"
                    />
                    {errors.address && (
                      <p className="mt-1 text-xs text-red-600">{errors.address.message}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/80">
                    Indicaciones para el envío (opcional)
                  </label>
                  <textarea
                    rows={3}
                    {...register("notes")}
                    placeholder="Apartamento, portería, referencias..."
                    className="min-h-[96px] w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 placeholder:text-white/35 outline-none transition focus:border-white/20 focus:ring-2 focus:ring-white/20"
                  />
                  {errors.notes && (
                    <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p>
                  )}
                </div>
              </div>
            </div>

            {submitError && (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {submitError}
              </div>
            )}

            <Button type="submit" variant="primary" fullWidth disabled={isSubmitting}>
              {isSubmitting ? "Procesando pedido..." : "Confirmar pedido"}
            </Button>
          </form>
          </>
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
                              <p className="text-[11px] text-amber-300/90">
                                {w.message}
                                {available !== null ? (
                                  <span className="text-amber-200/80"> (disp: {available})</span>
                                ) : null}
                              </p>

                              {canAdjust ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (available === 0) {
                                      removeItem(item.variantId);
                                    } else {
                                      updateQuantity(item.variantId, available);
                                    }
                                  }}
                                  className="mt-1 inline-flex items-center rounded-lg border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-400/15"
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
                <div className="mt-2 border-t border-white/10 pt-2 flex justify-between text-base font-semibold">
                  <span>Total estimado</span>
                  <span>
                    $
                    {(
                      subtotal + (shipping ? shipping.amount : 0)
                    ).toLocaleString("es-CO")}
                  </span>
                </div>
                <p className="mt-2 text-xs text-white/50">
                  El total final se confirma al crear la orden en el backend. No se
                  realiza el pago aún; coordinamos por WhatsApp o transferencia.
                </p>
                {hasStockWarnings() && (
                  <p className="mt-2 text-xs text-amber-200/80">
                    Nota: algunos ítems tienen stock limitado. Ajusta cantidades si lo deseas.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

