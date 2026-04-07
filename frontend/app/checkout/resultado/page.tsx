import Link from "next/link";
import { getTransactionStatus, type TransactionStatusResponse } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// /checkout/resultado?ref=<payment_reference>&ws=<widget_status>
//
// ws (widget_status) proviene directamente del callback del Widget de Wompi.
// Es la señal inmediata para la UX — no es la fuente de verdad del negocio.
// La fuente de verdad es el webhook (confirm_payment() en Django).
//
// Flujo:
// 1. Widget cierra → frontend navega aquí con ws=APPROVED|DECLINED|ERROR|PENDING
// 2. Esta página muestra UX basada en ws (inmediata, sin esperar webhook)
// 3. Si no hay ws, consulta el backend para el estado real
// ─────────────────────────────────────────────────────────────────────────────

type WompiStatus = "APPROVED" | "DECLINED" | "ERROR" | "PENDING" | (string & {});

function resolveDisplayStatus(
  ws: string | undefined,
  backendStatus: string | undefined
): "success" | "pending" | "failed" {
  if (ws === "APPROVED" || backendStatus === "paid") return "success";
  if (ws === "DECLINED" || ws === "ERROR" || backendStatus === "cancelled") return "failed";
  return "pending";
}

async function fetchStatus(ref: string): Promise<TransactionStatusResponse | null> {
  try {
    return await getTransactionStatus(ref);
  } catch {
    return null;
  }
}

export default async function ResultadoPage({
  searchParams,
}: {
  searchParams: { ref?: string; ws?: string };
}) {
  const ref = (searchParams.ref || "").trim();
  const ws = (searchParams.ws || "").trim() as WompiStatus | "";

  let orderData: TransactionStatusResponse | null = null;

  if (ref) {
    // Si hay ws=APPROVED/DECLINED no necesitamos el backend para la UX inicial,
    // pero lo consultamos de todas formas para mostrar el total.
    orderData = await fetchStatus(ref);
  }

  const displayStatus = resolveDisplayStatus(ws || undefined, orderData?.status);

  if (!ref) {
    return (
      <main className="page-shell page-shell--transactional min-h-screen">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="type-section-title text-black/50">Referencia no encontrada</p>
          <div className="mt-6">
            <Link href="/" className="type-action underline">
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell page-shell--transactional min-h-screen">
      <div className="mx-auto max-w-2xl px-4 pb-16 pt-8 text-[#111111]">
        {displayStatus === "success" && (
          <SuccessView orderData={orderData} />
        )}
        {displayStatus === "failed" && (
          <FailedView />
        )}
        {displayStatus === "pending" && (
          <PendingView orderData={orderData} />
        )}
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-vistas
// ─────────────────────────────────────────────────────────────────────────────

function SuccessView({ orderData }: { orderData: TransactionStatusResponse | null }) {
  return (
    <div>
      <div className="mb-8">
        <p className="type-section-title mb-3 text-black/45">Pago recibido</p>
        <h1 className="type-page-title text-[#111111]">¡Gracias por tu compra!</h1>
        <p className="type-body mt-3 max-w-lg text-black/62">
          Tu pago fue procesado exitosamente. Recibirás un email de confirmación con los detalles de tu pedido.
        </p>
      </div>

      {orderData && (
        <div className="mb-6 rounded-[1.75rem] border border-black/8 bg-white p-5 shadow-[0_16px_44px_rgba(15,23,42,0.06)]">
          <div className="space-y-2">
            {orderData.subtotal != null && orderData.subtotal > 0 && (
              <div className="type-body flex justify-between">
                <span className="text-black/60">Subtotal</span>
                <span>${orderData.subtotal.toLocaleString("es-CO")}</span>
              </div>
            )}
            {orderData.shipping_cost != null && orderData.shipping_cost > 0 && (
              <div className="type-body flex justify-between">
                <span className="text-black/60">Envío</span>
                <span>${orderData.shipping_cost.toLocaleString("es-CO")}</span>
              </div>
            )}
            {orderData.total != null && orderData.total > 0 && (
              <div className="type-price flex justify-between border-t border-black/8 pt-3 text-[#111111]">
                <span>Total pagado</span>
                <span>${orderData.total.toLocaleString("es-CO")}</span>
              </div>
            )}
          </div>
          {orderData.payment_reference && (
            <p className="mt-4 text-xs text-black/40">
              Referencia: {orderData.payment_reference}
            </p>
          )}
        </div>
      )}

      <Link href="/" className="inline-flex">
        <button className="rounded-2xl bg-[#111111] px-6 py-3.5 text-sm font-medium text-white hover:bg-black/85">
          Volver al inicio
        </button>
      </Link>
    </div>
  );
}

function FailedView() {
  return (
    <div>
      <div className="mb-8">
        <p className="type-section-title mb-3 text-black/45">Pago no completado</p>
        <h1 className="type-page-title text-[#111111]">El pago fue rechazado</h1>
        <p className="type-body mt-3 max-w-lg text-black/62">
          Tu pago no pudo procesarse. No se realizó ningún cobro. Puedes intentarlo de nuevo o elegir otro método de pago.
        </p>
      </div>

      <div className="flex gap-3">
        <Link href="/checkout" className="inline-flex">
          <button className="rounded-2xl bg-[#111111] px-6 py-3.5 text-sm font-medium text-white hover:bg-black/85">
            Intentar de nuevo
          </button>
        </Link>
        <Link href="/" className="inline-flex">
          <button className="rounded-2xl border border-black/12 px-6 py-3.5 text-sm font-medium text-black/80 hover:bg-black/[0.03]">
            Volver al inicio
          </button>
        </Link>
      </div>
    </div>
  );
}

function PendingView({ orderData }: { orderData: TransactionStatusResponse | null }) {
  return (
    <div>
      <div className="mb-8">
        <p className="type-section-title mb-3 text-black/45">Procesando pago</p>
        <h1 className="type-page-title text-[#111111]">Tu pago está en proceso</h1>
        <p className="type-body mt-3 max-w-lg text-black/62">
          Estamos verificando tu pago. Esto puede tomar unos segundos. Recibirás un email cuando se confirme.
        </p>
      </div>

      {orderData?.payment_reference && (
        <p className="mb-6 text-sm text-black/40">
          Referencia: {orderData.payment_reference}
        </p>
      )}

      <Link href="/" className="inline-flex">
        <button className="rounded-2xl border border-black/12 px-6 py-3.5 text-sm font-medium text-black/80 hover:bg-black/[0.03]">
          Volver al inicio
        </button>
      </Link>
    </div>
  );
}
