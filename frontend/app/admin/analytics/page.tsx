"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getAnalytics } from "@/lib/admin-api";
import { ADMIN_DATE_INPUT_CLASS } from "@/lib/admin-ui";
import type { AnalyticsData, ProductPerformanceRow } from "@/types/admin";

const EVENT_LABELS: Record<string, string> = {
  home_visit: "Visita al inicio (home)",
  product_view: "Vista de producto",
  product_click: "Click en producto",
  add_to_cart: "Agregar al carrito",
  checkout_start: "Inicio checkout",
  purchase_complete: "Compra completada",
  checkout_step: "Paso checkout",
  cart_abandon: "Abandono carrito",
};

/** Pasos enviados desde CheckoutClient (trackCheckoutStep). */
const CHECKOUT_STEP_LABELS: Record<string, string> = {
  formulario_checkout: "Formulario de checkout visible",
  envio_ciudad: "Ciudad de envío seleccionada",
  orden_lista_para_pago: "Orden creada (antes de pagar)",
  wompi_widget_abierto: "Widget de pago abierto",
};

const CHECKOUT_STEP_ORDER = [
  "formulario_checkout",
  "envio_ciudad",
  "orden_lista_para_pago",
  "wompi_widget_abierto",
] as const;

function sortCheckoutSteps(rows: { step: string; count: number }[]) {
  const order = new Map<string, number>(
    CHECKOUT_STEP_ORDER.map((s, i) => [s, i])
  );
  return [...rows].sort((a, b) => {
    const ia = order.has(a.step) ? order.get(a.step)! : 999;
    const ib = order.has(b.step) ? order.get(b.step)! : 999;
    if (ia !== ib) return ia - ib;
    return a.step.localeCompare(b.step);
  });
}

type DateRange = { start: string; end: string };

type SortKey = keyof Pick<
  ProductPerformanceRow,
  "add_to_cart" | "product_views" | "product_clicks" | "conv_view_to_cart_pct" | "click_through_pct"
>;

function todayISO() {
  return new Date().toISOString().split("T")[0];
}
function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}
function fmtShortDate(isoDate: string) {
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

function sortValue(row: ProductPerformanceRow, key: SortKey): number {
  const v = row[key];
  if (v == null) return -Infinity;
  return typeof v === "number" ? v : 0;
}

function ActivityChart({ points }: { points: { date: string; events: number }[] }) {
  // Interacción (mobile): tap/click para ver el conteo exacto por día.
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (!points.length) {
    return <p className="text-zinc-400 text-sm py-6 text-center">Sin actividad por día en este rango.</p>;
  }

  const max = Math.max(...points.map((p) => p.events), 1);
  const H = 136;
  const padL = 34;
  const padR = 10;
  const padT = 10;
  const padB = 52;

  // Mobile-friendly: keep a stable bar width and allow horizontal scroll.
  const barW = 14;
  const gap = 8;
  const innerW = points.length * (barW + gap) - gap;
  const W = padL + padR + Math.max(innerW, 260);

  const selected = selectedIdx != null ? points[selectedIdx] : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          {selected ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1">
              <span className="text-[11px] text-zinc-600 truncate">
                {fmtShortDate(selected.date)}
              </span>
              <span className="text-[11px] font-semibold text-zinc-900 tabular-nums">
                {selected.events.toLocaleString()}
              </span>
              <span className="text-[11px] text-zinc-500">eventos</span>
            </div>
          ) : (
            <p className="text-[11px] text-zinc-400">Toca una barra para ver el total del día.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSelectedIdx(null)}
          className={`text-[11px] px-2 py-1 rounded-lg border transition-colors ${
            selected
              ? "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
              : "border-transparent text-zinc-300 cursor-default"
          }`}
          disabled={!selected}
        >
          Limpiar
        </button>
      </div>

      <div className="overflow-x-auto overscroll-x-contain touch-pan-x -mx-4 px-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-32 w-[max(100%,_560px)]"
          preserveAspectRatio="xMinYMid meet"
        >
        {/* baseline */}
        <line
          x1={padL}
          x2={W - padR}
          y1={H - padB + 0.5}
          y2={H - padB + 0.5}
          className="stroke-zinc-200"
          strokeWidth={1}
        />

        {/* max label */}
        <text x={4} y={padT + 10} className="fill-zinc-400" style={{ fontSize: "9px" }}>
          {max} evt
        </text>

        {points.map((p, i) => {
          const x = padL + i * (barW + gap) + barW / 2;
        const h = ((H - padT - padB) * p.events) / max;
        const y = padT + (H - padT - padB) - h;
        const bx = x - barW / 2;
          const isSelected = selectedIdx === i;
          // En mobile, el eje X se depreca: la fecha vive en el badge superior al seleccionar una barra.
        return (
          <g key={p.date}>
            <rect
              x={bx}
              y={y}
              width={barW}
              height={Math.max(h, 1)}
              rx={2}
                className={isSelected ? "fill-red-500" : "fill-red-400/90"}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedIdx(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedIdx(i);
                }}
            />
            <title>
              {fmtShortDate(p.date)}: {p.events.toLocaleString()} eventos
            </title>
          </g>
        );
        })}
        </svg>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<DateRange>({ start: daysAgoISO(7), end: todayISO() });
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("add_to_cart");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadAnalytics(opts: { silent?: boolean } = {}) {
    const silent = Boolean(opts.silent);
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await getAnalytics({ start: range.start, end: range.end });
      setData(next);
    } catch (e) {
      console.error(e);
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);

  // Auto-refresh "barato": polling solo cuando la pestaña está visible.
  useEffect(() => {
    if (!autoRefresh) return;

    // Si el rango NO incluye hoy, refrescar más lento (menos útil).
    const isToday = range.end === todayISO();
    const intervalMs = isToday ? 30_000 : 90_000;

    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (cancelled) return;
      if (inFlight) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      inFlight = true;
      try {
        await loadAnalytics({ silent: true });
      } finally {
        inFlight = false;
      }
    };

    const id = window.setInterval(tick, intervalMs);
    // Primer refresh rápido (sin esperar todo el intervalo)
    window.setTimeout(tick, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, range.start, range.end]);

  const sortedPerformance = useMemo(() => {
    if (!data?.product_performance?.length) return [];
    const rows = [...data.product_performance];
    rows.sort((a, b) => sortValue(b, sortKey) - sortValue(a, sortKey));
    return rows;
  }, [data?.product_performance, sortKey]);

  const maxFunnelSessions = useMemo(() => {
    if (!data?.funnel?.length) return 1;
    return Math.max(...data.funnel.map((s) => s.sessions), 1);
  }, [data?.funnel]);

  const maxFunnelVolume = useMemo(() => {
    if (!data?.funnel_volume?.length) return 1;
    return Math.max(...data.funnel_volume.map((s) => s.count), 1);
  }, [data?.funnel_volume]);

  const maxEventType = useMemo(() => {
    if (!data?.summary?.events_by_type) return 1;
    return Math.max(...Object.values(data.summary.events_by_type), 1);
  }, [data?.summary?.events_by_type]);

  const sortBtn = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => setSortKey(key)}
      className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
        sortKey === key
          ? "bg-red-50 border-red-400 text-red-700 font-medium"
          : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-zinc-900">Analítica</h1>
          <p className="text-[11px] text-zinc-500 mt-0.5 max-w-xl">
            Métricas por producto y embudo para priorizar stock, campañas y UX. Las tasas vista→carrito usan la
            misma sesión (vieron el PDP y agregaron ese producto).
          </p>
        </div>
        <div className="flex w-full min-w-0 shrink-0 flex-col gap-2 sm:w-fit sm:max-w-full sm:items-end">
          <div className="flex w-full flex-col gap-1 sm:w-fit sm:items-end">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 sm:text-right">
              Período de consulta
            </span>
            <div className="flex w-full flex-col gap-2 sm:w-fit sm:flex-row sm:flex-nowrap sm:items-center sm:gap-2">
              <input
                type="date"
                aria-label="Fecha inicial"
                value={range.start}
                max={range.end}
                onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
                className={ADMIN_DATE_INPUT_CLASS}
              />
              <span className="hidden text-zinc-300 text-xs shrink-0 select-none sm:inline" aria-hidden>
                —
              </span>
              <input
                type="date"
                aria-label="Fecha final"
                value={range.end}
                min={range.start}
                max={todayISO()}
                onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
                className={ADMIN_DATE_INPUT_CLASS}
              />
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <label className="flex items-center gap-2 text-[11px] text-zinc-500 select-none">
              <input
                type="checkbox"
                className="w-4 h-4 accent-red-500"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Actualizar en vivo
              {refreshing && <span className="text-zinc-400">· actualizando…</span>}
            </label>
            <button
              type="button"
              onClick={() => loadAnalytics({ silent: true })}
              className="text-[11px] px-2.5 py-1 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600"
            >
              Actualizar ahora
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 bg-zinc-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPIs */}
          <div className="space-y-3">
            <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Visitas al home</p>
              <p className="text-xl font-semibold text-zinc-900 tabular-nums">
                {(data.home_traffic?.hits ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Cargas de la página de inicio (<span className="text-zinc-500">/</span>).{" "}
                {(data.home_traffic?.sessions ?? 0).toLocaleString()} sesiones distintas tocaron el home en el período.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Eventos totales</p>
                <p className="text-xl font-semibold text-zinc-900 tabular-nums">
                  {data.summary.total_events.toLocaleString()}
                </p>
              </div>
              <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Sesiones únicas</p>
                <p className="text-xl font-semibold text-zinc-900 tabular-nums">
                  {data.summary.unique_sessions.toLocaleString()}
                </p>
              </div>
              <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Eventos / sesión</p>
                <p className="text-xl font-semibold text-zinc-900 tabular-nums">
                  {data.summary.unique_sessions
                    ? (data.summary.total_events / data.summary.unique_sessions).toFixed(1)
                    : "—"}
                </p>
              </div>
              <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Rango</p>
                <p className="text-sm font-medium text-zinc-800">
                  {fmtShortDate(data.start_date)} – {fmtShortDate(data.end_date)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white border border-zinc-200 rounded-xl p-4">
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1">Actividad diaria</p>
              <p className="text-[11px] text-zinc-400 mb-2">Volumen de eventos capturados por día.</p>
              <ActivityChart points={data.daily_activity} />
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-4">
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1">Mix de eventos</p>
              <p className="text-[11px] text-zinc-400 mb-3">Distribución en el período (conteo bruto).</p>
              <div className="space-y-2 max-h-[9rem] overflow-y-auto pr-1">
                {Object.entries(data.summary.events_by_type)
                  .sort((a, b) => b[1] - a[1])
                  .map(([ev, cnt]) => (
                    <div key={ev}>
                      <div className="flex justify-between text-[11px] text-zinc-700 mb-0.5">
                        <span>{EVENT_LABELS[ev] || ev}</span>
                        <span className="text-zinc-500 tabular-nums">{cnt.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-zinc-700/70 rounded-full"
                          style={{ width: `${(cnt / maxEventType) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                {Object.keys(data.summary.events_by_type).length === 0 && (
                  <p className="text-zinc-400 text-sm">Sin eventos.</p>
                )}
              </div>
            </div>
          </div>

          {/* Funnel: sesiones vs volumen */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-1">Embudo (resumen)</p>
            <p className="text-[11px] text-zinc-400 mb-4">
              <strong className="text-zinc-600">Sesiones:</strong> cuántas sesiones distintas tuvieron al menos un
              evento de cada tipo (no implica orden ni el mismo usuario en todos los pasos).{" "}
              <strong className="text-zinc-600">Volumen:</strong> número total de eventos registrados.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-[10px] text-zinc-500 uppercase mb-2">Por sesión (al menos 1 evento)</p>
                <div className="space-y-2.5">
                  {data.funnel.map((step) => {
                    const pct = Math.round((step.sessions / maxFunnelSessions) * 100);
                    return (
                      <div key={`s-${step.event}`}>
                        <div className="flex justify-between text-xs text-zinc-600 mb-0.5">
                          <span>{EVENT_LABELS[step.event] || step.event}</span>
                          <span className="tabular-nums text-zinc-500">
                            {step.sessions.toLocaleString()} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 uppercase mb-2">Volumen (eventos)</p>
                <div className="space-y-2.5">
                  {data.funnel_volume.map((step) => {
                    const pct = Math.round((step.count / maxFunnelVolume) * 100);
                    return (
                      <div key={`v-${step.event}`}>
                        <div className="flex justify-between text-xs text-zinc-600 mb-0.5">
                          <span>{EVENT_LABELS[step.event] || step.event}</span>
                          <span className="tabular-nums text-zinc-500">
                            {step.count.toLocaleString()} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-400/90 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Tabla rendimiento por producto */}
          <div className="bg-white border border-zinc-200 rounded-xl p-3 sm:p-4 overflow-x-auto">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between mb-3">
              <div className="min-w-0">
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide">Rendimiento por producto</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Vista (PDP +2s), clics desde listados, agregados al carrito y conversión vista→carrito en la misma
                  sesión.
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {sortBtn("add_to_cart", "Carritos")}
                {sortBtn("product_views", "Vistas")}
                {sortBtn("product_clicks", "Clics")}
                {sortBtn("conv_view_to_cart_pct", "Conv. %")}
                {sortBtn("click_through_pct", "CTR clics/vista")}
              </div>
            </div>
            {sortedPerformance.length === 0 ? (
              <p className="text-zinc-400 text-sm py-6">Sin eventos con <code className="text-xs">product_id</code> en este rango. Comprueba que el tracker envíe ID o slug del producto.</p>
            ) : (
              <>
                <div className="md:hidden space-y-3">
                  {sortedPerformance.map((row) => (
                    <div
                      key={row.product_id}
                      className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 space-y-2 text-xs"
                    >
                      <p className="font-medium text-zinc-900 text-sm break-words" title={row.product_name || row.product_id}>
                        {row.product_name || `— (${row.product_id})`}
                      </p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-zinc-600">
                        <span>Vistas: <strong className="text-zinc-800 tabular-nums">{row.product_views}</strong></span>
                        <span>Ses. vista: <strong className="text-zinc-800 tabular-nums">{row.view_sessions}</strong></span>
                        <span>Clics: <strong className="text-zinc-800 tabular-nums">{row.product_clicks}</strong></span>
                        <span>+ Carrito: <strong className="text-zinc-800 tabular-nums">{row.add_to_cart}</strong></span>
                        <span>Ses. cart: <strong className="text-zinc-800 tabular-nums">{row.cart_sessions}</strong></span>
                        <span>
                          Vista→cart:{" "}
                          <strong className="text-zinc-800">
                            {row.conv_view_to_cart_pct != null ? `${row.conv_view_to_cart_pct}%` : "—"}
                          </strong>
                        </span>
                        <span className="col-span-2">
                          CTR vista→clic:{" "}
                          <strong className="text-zinc-800">
                            {row.click_through_pct != null ? `${row.click_through_pct}%` : "—"}
                          </strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto overscroll-x-contain touch-pan-x -mx-1 px-1">
              <table className="w-full text-xs text-left min-w-[720px]">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-100">
                    <th className="py-2 pr-3 font-medium">Producto</th>
                    <th className="py-2 pr-3 font-medium text-right tabular-nums">Vistas</th>
                    <th className="py-2 pr-3 font-medium text-right tabular-nums">Ses. vista</th>
                    <th className="py-2 pr-3 font-medium text-right tabular-nums">Clics</th>
                    <th className="py-2 pr-3 font-medium text-right tabular-nums">+ Carrito</th>
                    <th className="py-2 pr-3 font-medium text-right tabular-nums">Ses. cart</th>
                    <th className="py-2 pr-3 font-medium text-right tabular-nums">Vista→cart %</th>
                    <th className="py-2 font-medium text-right tabular-nums">CTR vista→clic %</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPerformance.map((row) => (
                    <tr key={row.product_id} className="border-b border-zinc-50 hover:bg-zinc-50/80">
                      <td className="py-2 pr-3 font-medium text-zinc-800 max-w-[200px]">
                        <span className="truncate block" title={row.product_name || row.product_id}>
                          {row.product_name || `— (${row.product_id})`}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-zinc-700">{row.product_views}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-zinc-500">{row.view_sessions}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-zinc-700">{row.product_clicks}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-zinc-700">{row.add_to_cart}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-zinc-500">{row.cart_sessions}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {row.conv_view_to_cart_pct != null ? (
                          <span className="text-green-700 font-medium">{row.conv_view_to_cart_pct}%</span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                        <span className="text-zinc-400 font-normal ml-1">({row.sessions_view_and_cart})</span>
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {row.click_through_pct != null ? `${row.click_through_pct}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
              </>
            )}
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white border border-zinc-200 rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-1 font-semibold uppercase tracking-wide">Top vistas (PDP)</p>
              <p className="text-[11px] text-zinc-400 mb-2">Productos más vistos (dwell ≥ 2s).</p>
              {data.top_products_by_views.length === 0 ? (
                <p className="text-zinc-400 text-sm">Sin datos.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.top_products_by_views.map((p, i) => (
                    <li key={p.product_id} className="flex justify-between text-xs text-zinc-700">
                      <span className="truncate pr-2">{i + 1}. {p.product_name || p.product_id}</span>
                      <span className="shrink-0 tabular-nums text-zinc-500">{p.views}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-1 font-semibold uppercase tracking-wide">Top clics</p>
              <p className="text-[11px] text-zinc-400 mb-2">Desde catálogo / tarjetas.</p>
              {data.top_products_by_clicks.length === 0 ? (
                <p className="text-zinc-400 text-sm">Sin datos.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.top_products_by_clicks.map((p, i) => (
                    <li key={p.product_id} className="flex justify-between text-xs text-zinc-700">
                      <span className="truncate pr-2">{i + 1}. {p.product_name || p.product_id}</span>
                      <span className="shrink-0 tabular-nums text-zinc-500">{p.clicks}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-1 font-semibold uppercase tracking-wide">Top al carrito</p>
              <p className="text-[11px] text-zinc-400 mb-2">Agregados desde PDP.</p>
              {data.top_products_by_add_to_cart.length === 0 ? (
                <p className="text-zinc-400 text-sm">Sin datos.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.top_products_by_add_to_cart.map((p, i) => (
                    <li key={p.product_id} className="flex justify-between text-xs text-zinc-700">
                      <span className="truncate pr-2">{i + 1}. {p.product_name || p.product_id}</span>
                      <span className="shrink-0 tabular-nums text-zinc-500">{p.add_to_cart}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-1 font-semibold uppercase tracking-wide">Pasos de checkout</p>
            <p className="text-[11px] text-zinc-400 mb-3">
              Sesiones únicas por hito (evento <code className="text-zinc-500">checkout_step</code>). Sirve para ver
              abandono entre formulario, datos de envío, orden creada y apertura del pago.
            </p>
            {data.checkout_steps.length === 0 ? (
              <p className="text-zinc-400 text-sm">Sin datos.</p>
            ) : (
              (() => {
                const ordered = sortCheckoutSteps(data.checkout_steps);
                const max = Math.max(...ordered.map((x) => x.count), 1);
                return (
                  <div className="space-y-2.5 max-w-md">
                    {ordered.map((s) => {
                      const label = CHECKOUT_STEP_LABELS[s.step] ?? s.step;
                      return (
                        <div key={s.step}>
                          <div className="flex justify-between text-xs text-zinc-700 mb-0.5">
                            <span className="font-medium" title={s.step}>
                              {label}
                            </span>
                            <span className="text-zinc-500">{s.count}</span>
                          </div>
                          <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-400 rounded-full"
                              style={{ width: `${(s.count / max) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>

          <p className="text-[10px] text-zinc-400 px-1">
            ID de producto en eventos puede ser numérico o slug según el origen del tracking. Para decisiones de compras,
            cruza esta tabla con margen y stock en{" "}
            <Link href="/admin/inventario" className="text-red-600 hover:underline">
              Inventario
            </Link>{" "}
            y{" "}
            <Link href="/admin/catalogo/productos" className="text-red-600 hover:underline">
              Productos
            </Link>.
          </p>
        </>
      )}
    </div>
  );
}
