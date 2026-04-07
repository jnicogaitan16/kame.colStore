"use client";

import { useEffect, useState } from "react";
import { getPendingRecovery, sendReminder } from "@/lib/admin-api";
import type { PendingOrder } from "@/types/admin";

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

export default function RecuperacionPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [showBulkModal, setShowBulkModal] = useState(false);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    getPendingRecovery()
      .then((r) => setOrders(r.results))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleSendReminder(reference: string) {
    setSending(reference);
    try {
      const res = await sendReminder(reference);
      showToast(res.message || "Recordatorio enviado.");
    } catch (e: any) {
      showToast(e?.payload?.error || "Error al enviar recordatorio.");
    } finally {
      setSending(null);
    }
  }

  async function handleSendAll() {
    setShowBulkModal(false);
    for (const o of orders) {
      try {
        await sendReminder(o.reference);
      } catch {
        // continue with others
      }
    }
    showToast(`Recordatorios enviados a ${orders.length} órdenes.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Recuperación de pagos</h1>
          <p className="text-xs text-white/40 mt-0.5">Órdenes pendientes con más de 2 horas sin cambio de estado.</p>
        </div>
        {orders.length > 0 && (
          <button
            onClick={() => setShowBulkModal(true)}
            className="text-xs px-3 py-2 bg-[#e63946]/10 border border-[#e63946]/20 text-[#e63946] rounded-lg hover:bg-[#e63946]/20 transition-colors"
          >
            Enviar a todos ({orders.length})
          </button>
        )}
      </div>

      <div className="bg-white/5 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-white/30 border-b border-white/10">
                <th className="text-left px-4 py-3">Referencia</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Productos</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Tiempo pendiente</th>
                <th className="text-left px-4 py-3">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading && [...Array(4)].map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {[...Array(7)].map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 bg-white/10 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-white/30 text-sm">
                    No hay órdenes pendientes de recuperación. ✓
                  </td>
                </tr>
              )}
              {!loading && orders.map((o) => (
                <tr key={o.reference} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 font-mono text-[#e63946] text-xs">{o.reference}</td>
                  <td className="px-4 py-3 text-white/70 text-xs">{o.customer_name}</td>
                  <td className="px-4 py-3 text-white/40 text-xs">{o.email || "—"}</td>
                  <td className="px-4 py-3 text-white/40 text-xs max-w-[160px] truncate">{o.items_summary}</td>
                  <td className="px-4 py-3 text-right font-medium text-xs">{fmt(o.total)}</td>
                  <td className="px-4 py-3 text-yellow-400 text-xs font-medium">{o.time_pending}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleSendReminder(o.reference)}
                      disabled={sending === o.reference || !o.email}
                      className="text-xs px-3 py-1 bg-[#e63946]/10 border border-[#e63946]/20 text-[#e63946] rounded hover:bg-[#e63946]/20 disabled:opacity-40 transition-colors whitespace-nowrap"
                    >
                      {sending === o.reference ? "Enviando..." : "Enviar recordatorio"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk confirm modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-xl p-5 w-full max-w-sm">
            <h3 className="font-medium text-sm mb-3">Enviar a todos</h3>
            <p className="text-white/50 text-sm mb-4">
              ¿Enviar recordatorio de pago a las <span className="text-white font-semibold">{orders.length}</span> órdenes pendientes?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBulkModal(false)}
                className="flex-1 text-sm py-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendAll}
                className="flex-1 text-sm py-2 bg-[#e63946] text-white rounded-lg hover:bg-[#e63946]/80 transition-colors"
              >
                Enviar todos
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 bg-white/10 backdrop-blur border border-white/10 rounded-lg px-4 py-2 text-sm text-white z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
