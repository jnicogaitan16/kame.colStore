"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteAdminCustomer, getAdminCustomer, updateAdminCustomer } from "@/lib/admin-api";
import type { CustomerDetail } from "@/types/admin";

const INPUT =
  "w-full bg-white border border-zinc-300 rounded-lg px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400/20";

function fmt(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}

const STATUS_LABELS: Record<string, string> = {
  paid: "Pagado",
  pending_payment: "Pendiente",
  shipped: "Enviado",
  cancelled: "Cancelado",
};
const STATUS_BADGE: Record<string, string> = {
  paid: "bg-green-50 text-green-700 border border-green-200",
  pending_payment: "bg-amber-50 text-amber-700 border border-amber-200",
  shipped: "bg-blue-50 text-blue-700 border border-blue-200",
  cancelled: "bg-red-50 text-red-600 border border-red-200",
};

type FormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  document_type: string;
  cedula: string;
  is_active: boolean;
};

function formFromCustomer(c: CustomerDetail): FormState {
  return {
    first_name: c.first_name || "",
    last_name: c.last_name || "",
    email: c.email || "",
    phone: c.phone || "",
    document_type: c.document_type || "CC",
    cedula: c.cedula || "",
    is_active: c.is_active,
  };
}

function formatApiError(err: unknown): string {
  if (err == null) return "Error al guardar.";
  if (typeof err === "string") return err;
  if (typeof err === "object" && !Array.isArray(err)) {
    const raw = (err as Record<string, unknown>).error;
    if (typeof raw === "string") return raw;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const labels: Record<string, string> = {
        first_name: "Nombre",
        last_name: "Apellido",
        email: "Email",
        phone: "Teléfono",
        document_type: "Tipo de documento",
        cedula: "Cédula",
        __all__: "General",
      };
      const parts: string[] = [];
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        const msg = Array.isArray(v) ? (v as string[]).join(" ") : String(v);
        parts.push(`${labels[k] || k}: ${msg}`);
      }
      return parts.join(" ") || "Error de validación.";
    }
  }
  return String(err);
}

export default function CustomerDetailPage({ params }: { params: { customer_id: string } }) {
  const { customer_id } = params;
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setLoading(true);
    setError("");
    getAdminCustomer(Number(customer_id))
      .then((c) => {
        setCustomer(c);
        setForm(formFromCustomer(c));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [customer_id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setFormError("");
    if (!form.first_name.trim()) {
      setFormError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateAdminCustomer(Number(customer_id), {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        document_type: form.document_type.trim() || "CC",
        cedula: form.cedula.trim(),
        is_active: form.is_active,
      });
      setCustomer(updated);
      setForm(formFromCustomer(updated));
      setEditing(false);
    } catch (err: unknown) {
      const e = err as { payload?: { error?: unknown } };
      setFormError(formatApiError(e?.payload?.error ?? err));
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    if (customer) setForm(formFromCustomer(customer));
    setFormError("");
    setEditing(false);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAdminCustomer(Number(customer_id));
      router.replace("/admin/clientes");
    } catch (err: unknown) {
      const e = err as { payload?: { error?: string }; message?: string };
      alert(e?.payload?.error || e?.message || "No se pudo eliminar.");
    } finally {
      setDeleting(false);
      setShowDelete(false);
    }
  }

  if (loading) return <div className="text-zinc-400 text-sm">Cargando...</div>;
  if (error) return <div className="text-red-500 text-sm">{error}</div>;
  if (!customer || !form) return null;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Link href="/admin/clientes" className="hover:text-zinc-700">
              Clientes
            </Link>
            <span>/</span>
            <span className="text-zinc-900">{customer.full_name || customer.email}</span>
          </div>
          <h1 className="text-lg font-semibold text-zinc-900 mt-1">{customer.full_name || "(sin nombre)"}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {!editing ? (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs px-3 py-1.5 bg-white border border-zinc-300 text-zinc-800 rounded-lg hover:bg-zinc-50 font-medium"
              >
                Editar datos
              </button>
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="text-xs px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
              >
                Eliminar cliente
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-3 font-semibold uppercase tracking-wide">Datos de contacto</p>
          {editing ? (
            <form onSubmit={handleSave} className="space-y-3">
              <p className="text-[11px] text-zinc-400 pb-1 border-b border-zinc-100">
                Fecha de registro:{" "}
                <span className="text-zinc-600">
                  {new Date(customer.created_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </p>
              <div>
                <label className="block text-xs text-zinc-500 mb-1 font-medium">Nombre *</label>
                <input
                  type="text"
                  value={form.first_name}
                  onChange={(e) => setForm((f) => (f ? { ...f, first_name: e.target.value } : f))}
                  className={INPUT}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1 font-medium">Apellido</label>
                <input
                  type="text"
                  value={form.last_name}
                  onChange={(e) => setForm((f) => (f ? { ...f, last_name: e.target.value } : f))}
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1 font-medium">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => (f ? { ...f, email: e.target.value } : f))}
                  className={INPUT}
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1 font-medium">Teléfono</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm((f) => (f ? { ...f, phone: e.target.value } : f))}
                  className={INPUT}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1 font-medium">Tipo documento</label>
                  <input
                    type="text"
                    value={form.document_type}
                    onChange={(e) => setForm((f) => (f ? { ...f, document_type: e.target.value } : f))}
                    className={INPUT}
                    placeholder="CC"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1 font-medium">Cédula / Número</label>
                  <input
                    type="text"
                    value={form.cedula}
                    onChange={(e) => setForm((f) => (f ? { ...f, cedula: e.target.value } : f))}
                    className={INPUT}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => (f ? { ...f, is_active: e.target.checked } : f))}
                  className="accent-red-500"
                />
                <span className="text-sm text-zinc-700">Cliente activo</span>
              </label>
              {formError && (
                <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 text-sm py-2 border border-zinc-300 rounded-lg hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 text-sm py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 font-medium"
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <InfoRow label="Email" value={customer.email} />
              <InfoRow label="Teléfono" value={customer.phone} />
              <InfoRow label="Documento" value={`${customer.document_type} ${customer.cedula}`} />
              <InfoRow label="Estado" value={customer.is_active ? "Activo" : "Inactivo"} />
              <InfoRow
                label="Fecha de registro"
                value={new Date(customer.created_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
              />
            </>
          )}
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-3 font-semibold uppercase tracking-wide">Métricas</p>
          <InfoRow label="Lifetime value" value={fmt(customer.metrics.lifetime_value)} highlight />
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

      {customer.top_products.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-3 font-semibold uppercase tracking-wide">Top productos comprados</p>
          <div className="space-y-2">
            {customer.top_products.map((p, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="text-zinc-400 w-4">{i + 1}.</span>
                <span className="text-zinc-800 font-medium">{p.name}</span>
                <span className="text-zinc-400">{p.variant}</span>
                <span className="ml-auto text-zinc-500 font-medium">{p.units} uds</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50">
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide">Historial de órdenes</p>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-400 border-b border-zinc-100">
              <th className="text-left px-4 py-2">Referencia</th>
              <th className="text-left px-4 py-2">Productos</th>
              <th className="text-right px-4 py-2">Total</th>
              <th className="text-left px-4 py-2">Estado</th>
              <th className="text-left px-4 py-2">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {customer.orders.map((o) => (
              <tr key={o.reference} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/admin/ordenes/${encodeURIComponent(o.reference)}`}
                    className="text-red-500 hover:text-red-600 hover:underline font-mono"
                  >
                    {o.reference}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-zinc-500 max-w-[180px] truncate">{o.items_summary}</td>
                <td className="px-4 py-2.5 text-right font-bold text-zinc-900">{fmt(o.total)}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[o.status] || "bg-zinc-100 text-zinc-500"}`}>
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-zinc-400">{new Date(o.created_at).toLocaleDateString("es-CO")}</td>
              </tr>
            ))}
            {customer.orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                  Sin órdenes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showDelete && (
        <div className="fixed inset-0 bg-zinc-950/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <p className="text-sm text-zinc-800 font-medium">¿Eliminar este cliente?</p>
            <p className="text-xs text-zinc-500 mt-2">
              Solo se puede eliminar si no tiene órdenes. Si tiene órdenes, el sistema rechazará la operación.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowDelete(false)}
                className="flex-1 text-sm py-2.5 border border-zinc-300 rounded-lg hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="flex-1 text-sm py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 font-medium"
              >
                {deleting ? "…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex gap-2 text-xs mb-1.5">
      <span className="text-zinc-400 w-28 shrink-0">{label}</span>
      <span className={highlight ? "text-zinc-900 font-bold" : "text-zinc-700"}>{value || "—"}</span>
    </div>
  );
}
