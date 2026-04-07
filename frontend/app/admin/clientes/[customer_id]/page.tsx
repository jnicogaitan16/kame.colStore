"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getAdminCustomer } from "@/lib/admin-api";
import type { CustomerDetail } from "@/types/admin";

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

const STATUS_LABELS: Record<string, string> = {
  paid: "Pagado", pending_payment: "Pendiente", shipped: "Enviado", cancelled: "Cancelado",
};

export default function CustomerDetailPage({ params }: { params: Promise<{ customer_id: string }> }) {
  const { customer_id } = use(params);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminCustomer(Number(customer_id))
      .then(setCustomer)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [customer_id]);

  if (loading) return <div className="text-white/40 text-sm">Cargando...</div>;
  if (error) return <div className="text-[#e63946] text-sm">{error}</div>;
  if (!customer) return null;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-white/40">
        <Link href="/admin/clientes" className="hover:text-white">Clientes</Link>
        <span>/</span>
        <span className="text-white">{customer.full_name || customer.email}</span>
      </div>

      <h1 className="text-lg font-semibold">{customer.full_name || "(sin nombre)"}</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Contact */}
        <div className="bg-white/5 rounded-lg p-4">
          <p className="text-xs text-white/40 mb-3 uppercase tracking-wide">Datos de contacto</p>
          <InfoRow label="Email" value={customer.email} />
          <InfoRow label="Teléfono" value={customer.phone} />
          <InfoRow label="Documento" value={`${customer.document_type} ${customer.cedula}`} />
        </div>

        {/* Metrics */}
        <div className="bg-white/5 rounded-lg p-4">
          <p className="text-xs text-white/40 mb-3 uppercase tracking-wide">Métricas</p>
          <InfoRow label="Lifetime value" value={fmt(customer.metrics.lifetime_value)} />
          <InfoRow label="Órdenes" value={String(customer.metrics.order_count)} />
          <InfoRow label="Ticket promedio" value={fmt(customer.metrics.avg_ticket)} />
          <InfoRow
            label="Primera compra"
            value={customer.metrics.first_purchase ? new Date(customer.metrics.first_purchase).toLocaleDateString("es-CO") : "—"}
          />
          <InfoRow
            label="Última compra"
            value={customer.metrics.last_purchase ? new Date(customer.metrics.last_purchase).toLocaleDateString("es-CO") : "—"}
          />
        </div>
      </div>

      {/* Top products */}
      {customer.top_products.length > 0 && (
        <div className="bg-white/5 rounded-lg p-4">
          <p className="text-xs text-white/40 mb-3 uppercase tracking-wide">Top productos comprados</p>
          <div className="space-y-1.5">
            {customer.top_products.map((p, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="text-white/30 w-4">{i + 1}.</span>
                <span className="text-white/70">{p.name}</span>
                <span className="text-white/30">{p.variant}</span>
                <span className="ml-auto text-white/50">{p.units} uds</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders */}
      <div className="bg-white/5 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-xs text-white/40 uppercase tracking-wide">Historial de órdenes</p>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-white/30 border-b border-white/10">
              <th className="text-left px-4 py-2">Referencia</th>
              <th className="text-left px-4 py-2">Productos</th>
              <th className="text-right px-4 py-2">Total</th>
              <th className="text-left px-4 py-2">Estado</th>
              <th className="text-left px-4 py-2">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {customer.orders.map((o) => (
              <tr key={o.reference} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/ordenes/${encodeURIComponent(o.reference)}`} className="text-[#e63946] hover:underline font-mono">
                    {o.reference}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-white/40 max-w-[180px] truncate">{o.items_summary}</td>
                <td className="px-4 py-2.5 text-right font-medium">{fmt(o.total)}</td>
                <td className="px-4 py-2.5 text-white/50">{STATUS_LABELS[o.status] || o.status}</td>
                <td className="px-4 py-2.5 text-white/30">{new Date(o.created_at).toLocaleDateString("es-CO")}</td>
              </tr>
            ))}
            {customer.orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-white/30">Sin órdenes.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs mb-1.5">
      <span className="text-white/30 w-28 shrink-0">{label}</span>
      <span className="text-white/70">{value || "—"}</span>
    </div>
  );
}
