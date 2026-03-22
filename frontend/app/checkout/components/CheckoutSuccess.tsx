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
          ? "w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-black/90 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:bg-black/[0.02] flex items-center"
          : "type-action inline-flex items-center justify-center rounded-xl border border-black/10 bg-white px-3 py-2 text-black/82 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:bg-black/[0.02]") +
        " " +
        className
      }
    >
      {asField ? (
        <span className="flex w-full items-center justify-between gap-3">
          <span className="flex-1 text-center font-mono text-[0.9rem] tracking-wide text-black/92">
            {displayValue ?? valueToCopy}
          </span>
          <span className="type-action shrink-0 rounded-xl border border-black/90 bg-[#111111] px-3 py-2 text-white transition-colors duration-200">
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
    <div className="text-[#111111]">
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-0 md:pb-12 md:pt-0">
        <div className="page-intro mb-6 md:mb-7">
          <p className="page-eyebrow">Finaliza tu pedido</p>
          <div className="page-title-block">
            <h1 className="type-page-title text-left text-[#111111]">
              Pedido creado
            </h1>
          </div>
        </div>

        <div className="card-surface mb-4 rounded-[1.75rem] border border-black/8 bg-white p-5 text-sm text-[#111111] shadow-[0_16px_44px_rgba(15,23,42,0.06)]">
        <div className="mb-4 flex flex-col items-center justify-center gap-2.5 text-center">
          <h2 className="type-section-title text-black/48">Paga por transferencia</h2>

          <div className="relative h-12 w-28 opacity-95">
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

        <div className="mb-3.5">
          <div className="mt-2">
            {brebKey ? (
              <CopyButton
                valueToCopy={brebKey}
                asField
                label="Copiar llave"
                copiedLabel="Copiada"
              />
            ) : (
              <div className="w-full rounded-2xl border border-black/10 bg-[#fafaf7] px-4 py-3 text-sm text-black/48">
                (No configurada)
              </div>
            )}
          </div>
        </div>

        <div className="mb-3.5 rounded-[1.5rem] border border-black/8 bg-[#f7f7f4] px-4 py-3.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <p className="type-ui-label text-black/50">Total a transferir</p>
          <p className="type-page-title mt-0.5 text-[#111111] md:text-[2.35rem]">
            ${totalText}
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-black/8 bg-[#fafaf7] px-4 py-3.5 text-sm text-black/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
          <p className="type-ui-label mb-1.5 text-black/50">Pasos</p>
          <ol className="type-body list-decimal space-y-1.25 pl-4 text-black/72">
            <li>Abre tu app bancaria y elige transferir por Bre-B.</li>
            <li>Pega la llave Bre-B.</li>
            <li>Transfiere el total exacto mostrado arriba.</li>
            <li>Cuando termines el pago, confirma.</li>
          </ol>
        </div>

        {(orderSummary.subtotal != null || orderSummary.total != null) && (
          <div className="mt-3.5 space-y-1.5">
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
              <div className="type-price flex justify-between border-t border-black/8 pt-3 text-[#111111]">
                <span>Total</span>
                <span>${orderSummary.total.toLocaleString("es-CO")}</span>
              </div>
            )}
          </div>
        )}
      </div>

        <div className="flex flex-col gap-2.5">
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
              className="type-action inline-flex w-full items-center justify-center rounded-full border border-black/10 bg-white px-4 py-3 text-black/82 transition hover:bg-black/[0.02]"
            >
              Volver al inicio
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}