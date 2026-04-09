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
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);

  useEffect(() => { load(); }, []);

  function load() {
    setLoading(true);
    getPendingRecovery().then((r) => setOrders(r.results)).catch(console.error).finally(() => setLoading(false));
  }

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSendReminder(reference: string) {
    setSending(reference);
    try {
      const res = await sendReminder(reference);
      showToast(res.message || "Recordatorio enviado.");
    } catch (e: any) {
      showToast(e?.payload?.error || "Error al enviar recordatorio.", false);
    } finally { setSending(null); }
  }

  async function handleSendAll() {
    setShowBulkModal(false);
    for (const o of orders) {
      try { await sendReminder(o.reference); } catch { /* continue */ }
    }
    showToast(`Recordatorios enviados a ${orders.length} órdenes.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-zinc-900">Recuperación de pagos</h1>
          <p className="text-xs text-zinc-500 mt-0.5 max-w-prose">
            Todas las órdenes con pago pendiente. El tiempo mostrado es desde la creación del pedido.
          </p>
        </div>
        {orders.length > 0 && (
          <button
            type="button"
            onClick={() => setShowBulkModal(true)}
            className="shrink-0 w-full sm:w-auto text-sm sm:text-xs px-4 py-2.5 sm:py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium text-center"
          >
            Enviar a todos ({orders.length})
          </button>
        )}
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        {/* Móvil: tarjetas */}
        <div className="md:hidden divide-y divide-zinc-100">
          {loading &&
            [...Array(4)].map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <div className="h-4 bg-zinc-100 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-zinc-100 rounded animate-pulse w-1/2" />
                <div className="h-10 bg-zinc-100 rounded animate-pulse" />
              </div>
            ))}
          {!loading && orders.length === 0 && (
            <p className="p-6 text-center text-zinc-400 text-sm">✓ No hay órdenes pendientes de recuperación.</p>
          )}
          {!loading &&
            orders.map((o) => (
              <div key={o.reference} className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-mono text-sm font-semibold text-red-600 break-all min-w-0">{o.reference}</p>
                  <span className="text-xs shrink-0 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                    {o.time_pending}
                  </span>
                </div>
                <dl className="space-y-2 text-xs">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold">Cliente</dt>
                    <dd className="text-zinc-800 font-medium mt-0.5 break-words">{o.customer_name}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold">Email</dt>
                    <dd className="text-zinc-600 mt-0.5 break-all">{o.email || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold">Productos</dt>
                    <dd className="text-zinc-600 mt-0.5 break-words">{o.items_summary || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-4 pt-1">
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500 font-semibold">Total</span>
                    <span className="font-bold text-zinc-900 tabular-nums">{fmt(o.total)}</span>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => handleSendReminder(o.reference)}
                  disabled={sending === o.reference || !o.email}
                  className="w-full text-sm py-2.5 px-3 bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-40 transition-colors font-medium"
                >
                  {sending === o.reference ? "Enviando..." : "Enviar recordatorio"}
                </button>
              </div>
            ))}
        </div>

        {/* Escritorio: tabla */}
        <div className="hidden md:block overflow-x-auto overscroll-x-contain touch-pan-x">
          <table className="w-full text-sm min-w-[880px]">
            <thead>
              <tr className="text-xs text-zinc-500 border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 whitespace-nowrap">Referencia</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Productos</th>
                <th className="text-right px-4 py-3 whitespace-nowrap">Total</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Tiempo pendiente</th>
                <th className="text-left px-4 py-3 whitespace-nowrap">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="border-b border-zinc-100">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-zinc-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}
              {!loading && orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-zinc-400 text-sm">
                    ✓ No hay órdenes pendientes de recuperación.
                  </td>
                </tr>
              )}
              {!loading &&
                orders.map((o) => (
                  <tr key={o.reference} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-red-500 text-xs font-semibold whitespace-nowrap align-top">
                      {o.reference}
                    </td>
                    <td className="px-4 py-3 text-zinc-800 text-xs font-medium max-w-[140px] break-words">
                      {o.customer_name}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs max-w-[180px] break-all align-top">{o.email || "—"}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs max-w-[200px] break-words align-top">
                      {o.items_summary}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-xs text-zinc-900 whitespace-nowrap align-top">
                      {fmt(o.total)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium inline-block">
                        {o.time_pending}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <button
                        type="button"
                        onClick={() => handleSendReminder(o.reference)}
                        disabled={sending === o.reference || !o.email}
                        className="text-xs px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-40 transition-colors whitespace-nowrap font-medium"
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

      {showBulkModal && (
        <div className="fixed inset-0 bg-zinc-950/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="font-semibold text-sm text-zinc-900 mb-3">Enviar a todos</h3>
            <p className="text-zinc-600 text-sm mb-4">
              ¿Enviar recordatorio de pago a las <span className="font-bold text-zinc-900">{orders.length}</span> órdenes pendientes?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowBulkModal(false)}
                className="flex-1 text-sm py-2.5 bg-white border border-zinc-300 text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSendAll}
                className="flex-1 text-sm py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium">
                Enviar todos
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-5 sm:max-w-md border rounded-xl px-4 py-2.5 text-sm shadow-md z-50 ${
            toast.ok ? "bg-white border-zinc-200 text-zinc-800" : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
