"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAdminOrder, shipOrder, cancelOrder } from "@/lib/admin-api";
import type { OrderDetail } from "@/types/admin";

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

const STATUS_BADGE: Record<string, string> = {
  paid: "bg-green-500/20 text-green-400",
  pending_payment: "bg-yellow-500/20 text-yellow-400",
  shipped: "bg-blue-500/20 text-blue-400",
  cancelled: "bg-red-500/20 text-red-400",
};
const STATUS_LABELS: Record<string, string> = {
  paid: "Pagado", pending_payment: "Pendiente de pago",
  shipped: "Enviado", cancelled: "Cancelado", refunded: "Reembolsado",
};

export default function OrderDetailPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [trackingInput, setTrackingInput] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [showShipModal, setShowShipModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    getAdminOrder(decodeURIComponent(reference))
      .then(setOrder)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [reference]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleShip() {
    if (!trackingInput.trim()) return;
    setActionLoading(true);
    try {
      await shipOrder(order!.reference, trackingInput.trim());
      showToast("Orden marcada como enviada.");
      setShowShipModal(false);
      const updated = await getAdminOrder(order!.reference);
      setOrder(updated);
    } catch (e: any) {
      showToast(e?.payload?.error || "Error al marcar como enviado.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    setActionLoading(true);
    try {
      await cancelOrder(order!.reference);
      showToast("Orden cancelada.");
      setShowCancelModal(false);
      const updated = await getAdminOrder(order!.reference);
      setOrder(updated);
    } catch (e: any) {
      showToast(e?.payload?.error || "Error al cancelar.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <div className="text-white/40 text-sm">Cargando...</div>;
  if (error) return <div className="text-[#e63946] text-sm">{error}</div>;
  if (!order) return null;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-white/40">
        <Link href="/admin/ordenes" className="hover:text-white">Órdenes</Link>
        <span>/</span>
        <span className="text-white font-mono">{order.reference}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold font-mono">{order.reference}</h1>
          <p className="text-xs text-white/40 mt-0.5">
            {new Date(order.created_at).toLocaleString("es-CO")}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className={`text-xs px-3 py-1 rounded-full ${STATUS_BADGE[order.status] || "bg-white/10 text-white/50"}`}>
            {STATUS_LABELS[order.status] || order.status}
          </span>
          {(order.status === "paid" || order.status === "pending_payment") && (
            <button
              onClick={() => setShowShipModal(true)}
              className="text-xs px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full hover:bg-blue-500/30 transition-colors"
            >
              Marcar como enviado
            </button>
          )}
          {order.status === "pending_payment" && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="text-xs px-3 py-1 bg-red-500/10 text-red-400 rounded-full hover:bg-red-500/20 transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {order.tracking_number && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-2 text-xs text-blue-300">
          Guía Servientrega: <span className="font-mono font-semibold">{order.tracking_number}</span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Customer */}
        <Section title="Cliente">
          <InfoRow label="Nombre" value={order.customer.full_name} />
          <InfoRow label="Email" value={order.customer.email} />
          <InfoRow label="Teléfono" value={order.customer.phone} />
          <InfoRow label="Documento" value={`${order.customer.document_type} ${order.customer.cedula}`} />
        </Section>

        {/* Shipping */}
        <Section title="Envío">
          <InfoRow label="Ciudad" value={order.shipping.city_code} />
          <InfoRow label="Dirección" value={order.shipping.address} />
          {order.shipping.notes && <InfoRow label="Notas" value={order.shipping.notes} />}
        </Section>
      </div>

      {/* Items */}
      <Section title="Productos">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-white/30 border-b border-white/10">
              <th className="text-left py-2">Producto</th>
              <th className="text-left py-2">Variante</th>
              <th className="text-right py-2">Qty</th>
              <th className="text-right py-2">Precio</th>
              <th className="text-right py-2">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, i) => (
              <tr key={i} className="border-b border-white/5">
                <td className="py-2 text-white/80">{item.product_name}</td>
                <td className="py-2 text-white/50">{item.variant}</td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{fmt(item.unit_price)}</td>
                <td className="py-2 text-right font-medium">{fmt(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-white/40">
              <td colSpan={4} className="pt-3 text-right">Subtotal</td>
              <td className="pt-3 text-right">{fmt(order.summary.subtotal)}</td>
            </tr>
            <tr className="text-white/40">
              <td colSpan={4} className="text-right">Envío</td>
              <td className="text-right">{fmt(order.summary.shipping_cost)}</td>
            </tr>
            <tr className="text-white font-semibold">
              <td colSpan={4} className="text-right pt-2">Total</td>
              <td className="text-right pt-2">{fmt(order.summary.total)}</td>
            </tr>
          </tfoot>
        </table>
      </Section>

      {/* Timeline */}
      <Section title="Historial de estado">
        {order.status_logs.length === 0 ? (
          <p className="text-white/30 text-xs">Sin registros.</p>
        ) : (
          <div className="space-y-2">
            {order.status_logs.map((log, i) => (
              <div key={i} className="flex gap-3 text-xs">
                <span className="text-white/30 shrink-0 w-32">
                  {new Date(log.created_at).toLocaleString("es-CO")}
                </span>
                <span className="text-white/60 capitalize">{STATUS_LABELS[log.status] || log.status}</span>
                {log.note && <span className="text-white/30">— {log.note}</span>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Modals */}
      {showShipModal && (
        <Modal title="Marcar como enviado" onClose={() => setShowShipModal(false)}>
          <p className="text-white/50 text-sm mb-3">Ingresa el número de guía Servientrega.</p>
          <input
            type="text"
            value={trackingInput}
            onChange={(e) => setTrackingInput(e.target.value)}
            placeholder="Ej: 1234567890"
            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white mb-3 focus:outline-none focus:border-white/20"
          />
          <button
            onClick={handleShip}
            disabled={actionLoading || !trackingInput.trim()}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm py-2 rounded-md"
          >
            {actionLoading ? "Guardando..." : "Confirmar envío"}
          </button>
        </Modal>
      )}

      {showCancelModal && (
        <Modal title="Cancelar orden" onClose={() => setShowCancelModal(false)}>
          <p className="text-white/50 text-sm mb-4">
            ¿Estás seguro de que deseas cancelar la orden <span className="font-mono text-white">{order.reference}</span>?
          </p>
          <button
            onClick={handleCancel}
            disabled={actionLoading}
            className="w-full bg-[#e63946] hover:bg-[#e63946]/80 disabled:opacity-40 text-white text-sm py-2 rounded-md"
          >
            {actionLoading ? "Cancelando..." : "Sí, cancelar"}
          </button>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 bg-white/10 backdrop-blur border border-white/10 rounded-lg px-4 py-2 text-sm text-white">
          {toast}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 rounded-lg p-4">
      <p className="text-xs text-white/40 mb-3 font-medium uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs mb-1.5">
      <span className="text-white/30 w-24 shrink-0">{label}</span>
      <span className="text-white/70">{value || "—"}</span>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/10 rounded-xl p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-sm">{title}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
