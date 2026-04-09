"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAdminOrder, shipOrder, cancelOrder } from "@/lib/admin-api";
import type { OrderDetail } from "@/types/admin";

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

const STATUS_BADGE: Record<string, string> = {
  paid: "bg-green-50 text-green-700 border border-green-200",
  pending_payment: "bg-amber-50 text-amber-700 border border-amber-200",
  shipped: "bg-blue-50 text-blue-700 border border-blue-200",
  cancelled: "bg-red-50 text-red-600 border border-red-200",
};
const STATUS_LABELS: Record<string, string> = {
  paid: "Pagado", pending_payment: "Pendiente de pago",
  shipped: "Enviado", cancelled: "Cancelado", refunded: "Reembolsado",
};

export default function OrderDetailPage({ params }: { params: { reference: string } }) {
  const { reference } = params;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [trackingInput, setTrackingInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showShipModal, setShowShipModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    getAdminOrder(decodeURIComponent(reference))
      .then(setOrder).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [reference]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleShip() {
    if (!trackingInput.trim()) return;
    setActionLoading(true);
    try {
      await shipOrder(order!.reference, trackingInput.trim());
      showToast("Orden marcada como enviada.");
      setShowShipModal(false);
      setOrder(await getAdminOrder(order!.reference));
    } catch (e: any) {
      showToast(e?.payload?.error || "Error al marcar como enviado.", false);
    } finally { setActionLoading(false); }
  }

  async function handleCancel() {
    setActionLoading(true);
    try {
      await cancelOrder(order!.reference);
      showToast("Orden cancelada.");
      setShowCancelModal(false);
      setOrder(await getAdminOrder(order!.reference));
    } catch (e: any) {
      showToast(e?.payload?.error || "Error al cancelar.", false);
    } finally { setActionLoading(false); }
  }

  if (loading) return <div className="text-zinc-400 text-sm">Cargando...</div>;
  if (error) return <div className="text-red-500 text-sm">{error}</div>;
  if (!order) return null;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <Link href="/admin/ordenes" className="hover:text-zinc-700">Órdenes</Link>
        <span>/</span>
        <span className="text-zinc-900 font-mono">{order.reference}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold font-mono text-zinc-900">{order.reference}</h1>
          <p className="text-xs text-zinc-400 mt-0.5">{new Date(order.created_at).toLocaleString("es-CO")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className={`text-xs px-3 py-1 rounded-full ${STATUS_BADGE[order.status] || "bg-zinc-100 text-zinc-500 border border-zinc-200"}`}>
            {STATUS_LABELS[order.status] || order.status}
          </span>
          {(order.status === "paid" || order.status === "pending_payment") && (
            <button onClick={() => setShowShipModal(true)}
              className="text-xs px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full hover:bg-blue-100 transition-colors">
              Marcar como enviado
            </button>
          )}
          {order.status === "pending_payment" && (
            <button onClick={() => setShowCancelModal(true)}
              className="text-xs px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-full hover:bg-red-100 transition-colors">
              Cancelar
            </button>
          )}
        </div>
      </div>

      {order.tracking_number && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-xs text-blue-700">
          Guía Servientrega: <span className="font-mono font-semibold">{order.tracking_number}</span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Section title="Cliente">
          <InfoRow label="Nombre" value={order.customer.full_name} />
          <InfoRow label="Email" value={order.customer.email} />
          <InfoRow label="Teléfono" value={order.customer.phone} />
          <InfoRow label="Documento" value={`${order.customer.document_type} ${order.customer.cedula}`} />
        </Section>
        <Section title="Envío">
          <InfoRow label="Ciudad" value={order.shipping.city_code} />
          <InfoRow label="Dirección" value={order.shipping.address} />
          {order.shipping.notes && <InfoRow label="Notas" value={order.shipping.notes} />}
        </Section>
      </div>

      <Section title="Productos">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-400 border-b border-zinc-100">
              <th className="text-left py-2">Producto</th>
              <th className="text-left py-2">Variante</th>
              <th className="text-right py-2">Qty</th>
              <th className="text-right py-2">Precio</th>
              <th className="text-right py-2">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={i} className="border-b border-zinc-100">
                <td className="py-2 text-zinc-800">{item.product_name}</td>
                <td className="py-2 text-zinc-500">{item.variant}</td>
                <td className="py-2 text-right text-zinc-700">{item.quantity}</td>
                <td className="py-2 text-right text-zinc-600">{fmt(item.unit_price)}</td>
                <td className="py-2 text-right font-medium text-zinc-900">{fmt(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-zinc-500">
              <td colSpan={4} className="pt-3 text-right text-xs">Subtotal</td>
              <td className="pt-3 text-right text-xs">{fmt(order.summary.subtotal)}</td>
            </tr>
            <tr className="text-zinc-500">
              <td colSpan={4} className="text-right text-xs">Envío</td>
              <td className="text-right text-xs">{fmt(order.summary.shipping_cost)}</td>
            </tr>
            <tr className="text-zinc-900 font-bold">
              <td colSpan={4} className="text-right pt-2">Total</td>
              <td className="text-right pt-2">{fmt(order.summary.total)}</td>
            </tr>
          </tfoot>
        </table>
      </Section>

      <Section title="Historial de estado">
        {order.status_logs.length === 0 ? (
          <p className="text-zinc-400 text-xs">Sin registros.</p>
        ) : (
          <div className="space-y-2">
            {order.status_logs.map((log, i) => (
              <div key={i} className="flex gap-3 text-xs">
                <span className="text-zinc-400 shrink-0 w-32">{new Date(log.created_at).toLocaleString("es-CO")}</span>
                <span className="text-zinc-700 capitalize">{STATUS_LABELS[log.status] || log.status}</span>
                {log.note && <span className="text-zinc-400">— {log.note}</span>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Ship modal */}
      {showShipModal && (
        <Modal title="Marcar como enviado" onClose={() => setShowShipModal(false)}>
          <p className="text-zinc-500 text-sm mb-3">Ingresa el número de guía Servientrega.</p>
          <input type="text" value={trackingInput} onChange={(e) => setTrackingInput(e.target.value)}
            placeholder="Ej: 1234567890" autoFocus
            className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900 mb-3 focus:outline-none focus:border-red-400" />
          <button onClick={handleShip} disabled={actionLoading || !trackingInput.trim()}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm py-2.5 rounded-lg">
            {actionLoading ? "Guardando..." : "Confirmar envío"}
          </button>
        </Modal>
      )}

      {/* Cancel modal */}
      {showCancelModal && (
        <Modal title="Cancelar orden" onClose={() => setShowCancelModal(false)}>
          <p className="text-zinc-600 text-sm mb-4">
            ¿Cancelar la orden <span className="font-mono font-semibold text-zinc-900">{order.reference}</span>?
          </p>
          <button onClick={handleCancel} disabled={actionLoading}
            className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white text-sm py-2.5 rounded-lg">
            {actionLoading ? "Cancelando..." : "Sí, cancelar orden"}
          </button>
        </Modal>
      )}

      {toast && (
        <div className={`fixed bottom-5 right-5 border rounded-xl px-4 py-2.5 text-sm shadow-md ${
          toast.ok ? "bg-white border-zinc-200 text-zinc-800" : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-4">
      <p className="text-xs text-zinc-500 mb-3 font-semibold uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs mb-1.5">
      <span className="text-zinc-400 w-24 shrink-0">{label}</span>
      <span className="text-zinc-700">{value || "—"}</span>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-zinc-950/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-zinc-200 rounded-2xl p-5 w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-zinc-900">{title}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
