"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getInventoryHistory } from "@/lib/admin-api";
import type { AdjustmentLog } from "@/types/admin";

export default function InventarioHistorialPage({ params }: { params: { pool_id: string } }) {
  const { pool_id } = params;
  const [data, setData] = useState<{
    pool_id: number; category: string; value: string; color: string; history: AdjustmentLog[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getInventoryHistory(Number(pool_id)).then(setData).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [pool_id]);

  return (
    <div className="space-y-4 max-w-3xl w-full min-w-0">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
        <Link href="/admin/inventario" className="hover:text-zinc-700">
          Inventario
        </Link>
        <span>/</span>
        <span className="text-zinc-900">Historial de ajustes</span>
      </div>

      {data && (
        <h1 className="text-lg font-semibold text-zinc-900 break-words">
          {data.category}
          {data.value && <span className="text-zinc-500 font-normal"> / {data.value}</span>}
          {data.color && <span className="text-zinc-500 font-normal"> / {data.color}</span>}
        </h1>
      )}

      {loading && <div className="text-zinc-400 text-sm">Cargando...</div>}
      {error && <div className="text-red-500 text-sm">{error}</div>}

      {data && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="md:hidden divide-y divide-zinc-100">
            {data.history.length === 0 && (
              <p className="p-6 text-center text-zinc-400 text-sm">Sin ajustes registrados.</p>
            )}
            {data.history.map((log) => (
              <div key={log.id} className="p-4 space-y-2 text-sm">
                <p className="text-xs text-zinc-500">{new Date(log.created_at).toLocaleString("es-CO")}</p>
                <div className="flex flex-wrap gap-4 text-xs font-mono">
                  <span className="text-zinc-500">{log.previous_stock} →</span>
                  <span className="font-semibold text-zinc-900">{log.new_stock}</span>
                  <span className={log.diff >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                    ({log.diff >= 0 ? "+" : ""}
                    {log.diff})
                  </span>
                </div>
                <p className="text-xs text-zinc-600 break-words">
                  <span className="text-zinc-400">Motivo: </span>
                  {log.reason || "—"}
                </p>
                <p className="text-xs text-zinc-400 break-all">
                  <span className="text-zinc-500">Usuario: </span>
                  {log.adjusted_by || "—"}
                </p>
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto overscroll-x-contain touch-pan-x">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-4 py-3 whitespace-nowrap">Fecha</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">Anterior</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">Nuevo</th>
                  <th className="text-right px-4 py-3 whitespace-nowrap">Diferencia</th>
                  <th className="text-left px-4 py-3">Motivo</th>
                  <th className="text-left px-4 py-3">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {data.history.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-sm">
                      Sin ajustes registrados.
                    </td>
                  </tr>
                )}
                {data.history.map((log) => (
                  <tr key={log.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap align-top">
                      {new Date(log.created_at).toLocaleString("es-CO")}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500 text-xs font-mono align-top">
                      {log.previous_stock}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-800 text-xs font-mono font-semibold align-top">
                      {log.new_stock}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono font-bold align-top">
                      <span className={log.diff >= 0 ? "text-green-600" : "text-red-600"}>
                        {log.diff >= 0 ? "+" : ""}
                        {log.diff}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 text-xs max-w-[240px] break-words align-top">
                      {log.reason || "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs break-all align-top">{log.adjusted_by || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
