

"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/Button";

type OrderSummary = {
  order_id: number | string;
  payment_reference?: string | null;
  subtotal?: number | null;
  shipping_cost?: number | null;
  total?: number | null;
};

type CheckoutSuccessProps = {
  orderSummary: OrderSummary;
  brebKey: string;
  whatsappUrl?: string | null;
  totalText: string;
};

type CopyButtonProps = {
  valueToCopy: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  asField?: boolean;
  displayValue?: string;
};

function CopyButton({
  valueToCopy,
  label = "Copiar",
  copiedLabel = "Copiado",
  className = "",
  asField = false,
  displayValue,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = valueToCopy || "";
    if (!text) return;

    const markCopied = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    };

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        markCopied();
        return;
      }
    } catch {}

    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "true");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      markCopied();
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        (asField
          ? "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90 hover:bg-white/10"
          : "type-action inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white/85 hover:bg-white/10") +
        " " +
        className
      }
    >
      {asField ? (
        <span className="flex w-full items-center justify-between gap-3">
          <span className="truncate font-mono text-white">
            {displayValue ?? valueToCopy}
          </span>
          <span className="type-action shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white/85">
            {copied ? copiedLabel : label}
          </span>
        </span>
      ) : (
        <>{copied ? copiedLabel : label}</>
      )}
    </button>
  );
}

export default function CheckoutSuccess({
  orderSummary,
  brebKey,
  whatsappUrl,
  totalText,
}: CheckoutSuccessProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-zinc-100">
      <h1 className="type-page-title mb-6 text-center text-zinc-100">
        Pedido creado
      </h1>

      <div className="card-surface mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-100">
        <div className="mb-5 flex flex-col items-center justify-center gap-3 text-center">
          <h2 className="type-section-title text-white">Paga por transferencia</h2>

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
              />
            ) : (
              <div className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                (No configurada)
              </div>
            )}
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-center">
          <p className="type-ui-label text-white/60">Total a transferir</p>
          <p className="type-page-title mt-1 text-white md:text-[2.5rem]">
            ${totalText}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/80">
          <p className="type-ui-label mb-2 text-white/60">Pasos</p>
          <ol className="type-legal-body list-decimal space-y-1 pl-4 text-white/80">
            <li>Abre tu app bancaria y elige transferir por Bre-B.</li>
            <li>Pega la llave Bre-B.</li>
            <li>Transfiere el total exacto mostrado arriba.</li>
            <li>Cuando termines el pago, confirma.</li>
          </ol>
        </div>

        {(orderSummary.subtotal != null || orderSummary.total != null) && (
          <div className="mt-4 space-y-2">
            {orderSummary.subtotal != null && (
              <div className="type-body flex justify-between">
                <span>Subtotal</span>
                <span>${orderSummary.subtotal.toLocaleString("es-CO")}</span>
              </div>
            )}

            {orderSummary.shipping_cost != null && (
              <div className="type-body flex justify-between">
                <span>Envío</span>
                <span>${orderSummary.shipping_cost.toLocaleString("es-CO")}</span>
              </div>
            )}

            {orderSummary.total != null && (
              <div className="type-price flex justify-between border-t border-white/10 pt-2 text-white">
                <span>Total</span>
                <span>${orderSummary.total.toLocaleString("es-CO")}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full"
          >
            <Button type="button" variant="primary" fullWidth>
              Confirmar pago
            </Button>
          </a>
        ) : null}

        <Link href="/" className="inline-flex w-full">
          <button
            type="button"
            className="type-action inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-transparent px-4 py-3 text-white/85 transition hover:bg-white/5"
          >
            Volver al inicio
          </button>
        </Link>
      </div>
    </div>
  );
}