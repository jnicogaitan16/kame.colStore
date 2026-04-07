"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getInventoryHistory } from "@/lib/admin-api";
import type { AdjustmentLog } from "@/types/admin";

export default function InventarioHistorialPage({ params }: { params: Promise<{ pool_id: string }> }) {
  const { pool_id } = use(params);
  const [data, setData] = useState<{
    pool_id: number;
    category: string;
    value: string;
    color: string;
    history: AdjustmentLog[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getInventoryHistory(Number(pool_id))
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [pool_id]);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-2 text-xs text-white/40">
        <Link href="/admin/inventario" className="hover:text-white">Inventario</Link>
        <span>/</span>
        <span className="text-white">Historial</span>
      </div>

      {data && (
        <h1 className="text-lg font-semibold">
          {data.category}
          {data.value && <span className="text-white/50 font-normal"> / {data.value}</span>}
          {data.color && <span className="text-white/50 font-normal"> / {data.color}</span>}
        </h1>
      )}

      {loading && <div className="text-white/40 text-sm">Cargando...</div>}
      {error && <div className="text-[#e63946] text-sm">{error}</div>}

      {data && (
        <div className="bg-white/5 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-white/30 border-b border-white/10">
                <th className="text-left px-4 py-3">Fecha</th>
                <th className="text-right px-4 py-3">Anterior</th>
                <th className="text-right px-4 py-3">Nuevo</th>
                <th className="text-right px-4 py-3">Diferencia</th>
                <th className="text-left px-4 py-3">Motivo</th>
                <th className="text-left px-4 py-3">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {data.history.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/30 text-sm">
                    Sin ajustes registrados.
                  </td>
                </tr>
              )}
              {data.history.map((log) => (
                <tr key={log.id} className="border-b border-white/5">
                  <td className="px-4 py-3 text-white/40 text-xs">
                    {new Date(log.created_at).toLocaleString("es-CO")}
                  </td>
                  <td className="px-4 py-3 text-right text-white/60 text-xs font-mono">{log.previous_stock}</td>
                  <td className="px-4 py-3 text-right text-white/80 text-xs font-mono">{log.new_stock}</td>
                  <td className="px-4 py-3 text-right text-xs font-mono font-semibold">
                    <span className={log.diff >= 0 ? "text-green-400" : "text-red-400"}>
                      {log.diff >= 0 ? "+" : ""}{log.diff}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/50 text-xs">{log.reason || "—"}</td>
                  <td className="px-4 py-3 text-white/30 text-xs">{log.adjusted_by || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
