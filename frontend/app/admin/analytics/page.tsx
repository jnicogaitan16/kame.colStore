"use client";

import { useEffect, useState } from "react";
import { getAnalytics } from "@/lib/admin-api";
import type { AnalyticsData } from "@/types/admin";

const EVENT_LABELS: Record<string, string> = {
  product_view: "Vista de producto",
  product_click: "Click en producto",
  add_to_cart: "Agregar al carrito",
  checkout_start: "Inicio checkout",
  purchase_complete: "Compra completada",
};

const PERIODS = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("7d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getAnalytics(period)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Analítica</h1>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                period === p.value ? "bg-[#e63946] text-white" : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-48 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!loading && data && (
        <>
          {/* Funnel */}
          <div className="bg-white/5 rounded-lg p-5">
            <p className="text-xs text-white/40 mb-4 uppercase tracking-wide">Funnel de conversión</p>
            {data.funnel.length === 0 ? (
              <p className="text-white/30 text-sm">Sin datos de eventos todavía.</p>
            ) : (
              <div className="space-y-3">
                {data.funnel.map((step, i) => {
                  const maxSessions = data.funnel[0]?.sessions || 1;
                  const pct = maxSessions ? Math.round((step.sessions / maxSessions) * 100) : 0;
                  const drop = i > 0 && data.funnel[i - 1].sessions
                    ? Math.round((1 - step.sessions / data.funnel[i - 1].sessions) * 100)
                    : null;
                  return (
                    <div key={step.event}>
                      <div className="flex items-center justify-between text-xs text-white/50 mb-1">
                        <span>{EVENT_LABELS[step.event] || step.event}</span>
                        <div className="flex items-center gap-3">
                          {drop !== null && (
                            <span className="text-red-400 text-xs">-{drop}%</span>
                          )}
                          <span>{step.sessions.toLocaleString()} sesiones ({pct}%)</span>
                        </div>
                      </div>
                      <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#e63946] rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Top products by clicks */}
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-xs text-white/40 mb-3 uppercase tracking-wide">Top productos (clics)</p>
              {data.top_products_by_clicks.length === 0 ? (
                <p className="text-white/30 text-sm">Sin datos.</p>
              ) : (
                <div className="space-y-2">
                  {data.top_products_by_clicks.map((p, i) => {
                    const max = data.top_products_by_clicks[0]?.clicks || 1;
                    return (
                      <div key={p.product_id}>
                        <div className="flex justify-between text-xs text-white/60 mb-0.5">
                          <span className="truncate">{i + 1}. {p.product_name || `Producto ${p.product_id}`}</span>
                          <span className="ml-2 shrink-0">{p.clicks}</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-[#e63946]/60 rounded-full" style={{ width: `${(p.clicks / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Checkout steps */}
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-xs text-white/40 mb-3 uppercase tracking-wide">Pasos de checkout</p>
              {data.checkout_steps.length === 0 ? (
                <p className="text-white/30 text-sm">Sin datos.</p>
              ) : (
                <div className="space-y-2">
                  {data.checkout_steps.map((s) => {
                    const max = Math.max(...data.checkout_steps.map((x) => x.count), 1);
                    return (
                      <div key={s.step}>
                        <div className="flex justify-between text-xs text-white/60 mb-0.5">
                          <span>{s.step}</span>
                          <span>{s.count}</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-400/60 rounded-full" style={{ width: `${(s.count / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
