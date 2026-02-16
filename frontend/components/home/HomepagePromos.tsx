import Image from "next/image";
import Link from "next/link";

import { getHomepagePromos } from "@/lib/api";
import type { HomepagePromo } from "@/types/catalog";

// Extiende el tipo del frontend sin tocar el archivo de tipos.
// Esto resuelve los errores TS de image_*_url.
type HomepagePromoWithOptimizedImages = HomepagePromo & {
  image_thumb_url?: string | null;
  image_medium_url?: string | null;
  image_large_url?: string | null;
};

const HERO_OVERLAY_CLASS =
  "absolute inset-0 bg-gradient-to-b from-black/65 via-black/35 to-black/75";

const HERO_CONTAINER_CLASS =
  "relative z-10 mx-auto flex w-full max-w-6xl items-center px-4";

const HERO_TITLE_CLASS =
  "text-3xl font-extrabold tracking-tight text-white md:text-5xl";

const HERO_SUBTITLE_CLASS =
  "mb-3 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold tracking-widest text-white/85";

function normalizeHref(href: string | null | undefined): string | null {
  const raw = (href || "").trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return null;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function normalizeImageSrc(src: string | null | undefined): string | null {
  const raw = (src || "").trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

// Blur placeholder liviano (mejora LCP/percepción sin depender del optimizador)
const BLUR_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=";

export default async function HomepagePromos({
  placement = "MID",
}: {
  placement?: "TOP" | "MID";
}) {
  let promos: HomepagePromoWithOptimizedImages[] = [];

  try {
    const res = await getHomepagePromos(placement);
    promos = res as HomepagePromoWithOptimizedImages[];
  } catch {
    return null;
  }

  const list = (promos || [])
    .filter((p) => !!p && typeof p.id === "number")
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  if (list.length === 0) return null;

  return (
    <section>
      <div className="flex flex-col gap-10">
        {list.map((promo, idx) => {
          const href = normalizeHref(promo.cta_url);
          const hasCta = !!href;

          const title = (promo.title || "").trim();
          const subtitle = (promo.subtitle || "").trim();
          const showText = promo.show_text !== false;
          const hasText = showText && (!!title || !!subtitle);

          const isTop = placement === "TOP";

          // Preferir URLs optimizadas (ImageKit). Fallback a `promo.image` por compatibilidad.
          const preferred = isTop
            ? promo.image_large_url || promo.image
            : promo.image_medium_url || promo.image;

          let imageSrc = normalizeImageSrc(preferred);

          // Paracaídas: si el preferred viene de ImageKit CACHE y en tu entorno falla,
          // hacemos fallback al original (promo.image) para evitar bloque negro.
          if (imageSrc?.includes("/media/CACHE/") && promo.image) {
            imageSrc = normalizeImageSrc(promo.image);
          }

          const imageSizes = isTop ? "100vw" : "(max-width: 768px) 100vw, 33vw";
          const imagePriority = isTop && idx === 0;

          const breakoutClass = isTop
            ? "relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen"
            : "";

          // Alturas más cortas para diferenciarse del Hero (aprox. la mitad)
          const PROMO_HEIGHT_TOP = "min-h-[40vh] md:min-h-[44vh]";
          const PROMO_HEIGHT_MID = "min-h-[28vh] md:min-h-[32vh]";
          const promoHeightClass = isTop ? PROMO_HEIGHT_TOP : PROMO_HEIGHT_MID;

          const CardInner = (
            <div
              className={
                "promo-enter group relative w-full overflow-hidden " +
                "bg-black transition-all duration-300"
              }
            >
              {/* Background image */}
              <div className="absolute inset-0">
                {imageSrc ? (
                  <Image
                    src={imageSrc}
                    alt={promo.alt_text || title || "Promo"}
                    fill
                    sizes={imageSizes}
                    priority={imagePriority}
                    unoptimized
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                    {...(!isTop ? { loading: "lazy" as const } : {})}
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.01]"
                  />
                ) : (
                  <div className="h-full w-full bg-neutral-900" />
                )}
              </div>

              {/* Banner-like overlay for readability */}
              <div className={`pointer-events-none ${HERO_OVERLAY_CLASS}`} />

              {/* Content */}
              <div
                className={`relative w-full ${promoHeightClass} flex items-end py-10 md:py-12`}
              >
                <div className={HERO_CONTAINER_CLASS}>
                  <div className="w-full">
                    {hasText ? (
                      <div>
                        {subtitle ? (
                          <p
                            className={
                              isTop
                                ? HERO_SUBTITLE_CLASS
                                : "mb-3 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold tracking-widest text-white/85"
                            }
                          >
                            {subtitle}
                          </p>
                        ) : null}

                        {title ? (
                          <h3
                            className={
                              isTop
                                ? HERO_TITLE_CLASS
                                : "text-2xl font-semibold text-white md:text-3xl"
                            }
                          >
                            {title}
                          </h3>
                        ) : null}
                      </div>
                    ) : null}

                    {hasCta ? (
                      <div className={hasText ? "mt-4" : ""}>
                        <span
                          className={
                            isTop
                              ? "text-base md:text-lg text-white/90 transition-all duration-300 group-hover:text-white"
                              : "text-base text-white/90 underline decoration-white/20 transition-all duration-300 group-hover:text-white group-hover:decoration-white/60"
                          }
                        >
                          {promo.cta_label?.trim() || "Ver más"}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );

          return (
            <div key={promo.id} className={breakoutClass}>
              {hasCta ? (
                <Link
                  href={href as string}
                  className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
                  aria-label={
                    promo.cta_label?.trim() || `Ver más: ${title || "promo"}`
                  }
                >
                  {CardInner}
                </Link>
              ) : (
                CardInner
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}