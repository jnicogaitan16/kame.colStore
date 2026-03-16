import HomepagePromosClient from "@/components/home/HomepagePromosClient";
import { getHomepagePromos } from "@/lib/api";
import type { HomepagePromo } from "@/types/catalog";

// Extiende el tipo del frontend sin tocar el archivo de tipos.
// Esto resuelve los errores TS de image_*_url.
type HomepagePromoWithOptimizedImages = HomepagePromo & {
  // Imagenes optimizadas (ImageKit)
  image_thumb_url?: string | null;
  image_medium_url?: string | null;
  image_large_url?: string | null;

  // Campos que llegan desde backend pero el tipo base del frontend puede no incluir aún
  show_text?: boolean | null;
  alt_text?: string | null;
};

function extractArray<T>(res: any): T[] {
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray(res?.results)) return res.results as T[];
  // Some backends wrap payloads differently
  if (Array.isArray(res?.data)) return res.data as T[];
  if (Array.isArray(res?.promos)) return res.promos as T[];
  return [];
}

function normalizePlacement(p: any): "TOP" | "MID" | "" {
  const v = String(p || "").trim().toUpperCase();
  if (v === "TOP") return "TOP";
  if (v === "MID") return "MID";
  return "";
}

function isDevEnvironment(): boolean {
  return process.env.NODE_ENV !== "production";
}

function logPlacementMismatch(params: {
  requestedPlacement: "TOP" | "MID";
  promoId: number;
  receivedPlacement: string;
}) {
  if (!isDevEnvironment()) return;
  console.warn(
    `[HomepagePromos] placement mismatch: requested=${params.requestedPlacement} promoId=${params.promoId} received=${params.receivedPlacement}`
  );
}

function logEmptyPlacementResult(requestedPlacement: "TOP" | "MID") {
  if (!isDevEnvironment()) return;
  console.warn(
    `[HomepagePromos] no promos left after defensive placement filter for placement=${requestedPlacement}`
  );
}

function dedupeById<T extends { id?: any }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const key = String((it as any)?.id ?? "");
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

export default async function HomepagePromos({
  placement = "MID",
}: {
  placement?: "TOP" | "MID";
}) {
  let promos: unknown = [];

  try {
    const res = await getHomepagePromos(placement);
    promos = extractArray<HomepagePromoWithOptimizedImages>(res);
  } catch {
    return null;
  }

  const promosArray: HomepagePromoWithOptimizedImages[] = Array.isArray(promos)
    ? (promos as HomepagePromoWithOptimizedImages[])
    : [];

  // Defensivo: evita duplicados por payload raro y filtra por placement si el backend lo incluye.
  const filtered = promosArray.filter((p: any) => {
    if (!p) return false;
    if (typeof p.id !== "number") return false;
    if (p.is_active === false) return false;

    // Si backend trae placement, lo respetamos; si no, asumimos que el endpoint ya viene filtrado.
    const backendPlacement = normalizePlacement(p.placement);
    if (backendPlacement) {
      const isMatch = backendPlacement === placement;
      if (!isMatch) {
        logPlacementMismatch({
          requestedPlacement: placement,
          promoId: p.id,
          receivedPlacement: backendPlacement,
        });
      }
      return isMatch;
    }
    return true;
  });

  const list = dedupeById(filtered).sort(
    (a: any, b: any) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
  );

  if (list.length === 0) {
    logEmptyPlacementResult(placement);
    return null;
  }

  return <HomepagePromosClient promos={list} />;
}