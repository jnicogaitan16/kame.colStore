import Image from "next/image";
import Link from "next/link";

import { getHomepagePromos } from "@/lib/api";
import type { HomepagePromo } from "@/types/catalog";

const HERO_OVERLAY_CLASS =
  "absolute inset-0 bg-gradient-to-b from-black/65 via-black/35 to-black/75";

const HERO_CONTAINER_CLASS =
  "relative z-10 mx-auto flex w-full max-w-6xl items-center px-4";

const HERO_TITLE_CLASS =
  "text-3xl font-extrabold tracking-tight text-white md:text-5xl";

const HERO_SUBTITLE_CLASS =
  "mb-3 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold tracking-widest text-white/85";

function getGridColsClass(count: number): string {
  // Mobile: 1 column always. Desktop: 2 cols for 1-2 items, 3 cols for 3+.
  if (count <= 2) return "md:grid-cols-2";
  return "md:grid-cols-3";
}

function normalizeHref(href: string | null | undefined): string | null {
  const raw = (href || "").trim();
  if (!raw) return null;
  // Ensure relative route. Backend already enforces, this is just extra safety.
  if (raw.startsWith("http://") || raw.startsWith("https://")) return null;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export default async function HomepagePromos({
  placement = "MID",
}: {
  placement?: "TOP" | "MID";
}) {
  let promos: HomepagePromo[] = [];

  try {
    promos = await getHomepagePromos(placement);
  } catch {
    // Home should never hard-fail if promos endpoint has an issue.
    return null;
  }

  const list = (promos || [])
    .filter((p) => !!p && typeof p.id === "number")
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  if (list.length === 0) return null;

  // const gridColsClass = getGridColsClass(list.length);

  return (
    <section>
      <div className="flex flex-col gap-10">
        {list.map((promo) => {
          const href = normalizeHref(promo.cta_url);
          const hasCta = !!href;

          const title = (promo.title || "").trim();
          const subtitle = (promo.subtitle || "").trim();
          const showText = promo.show_text !== false;
          const hasText = showText && (!!title || !!subtitle);

          const isTop = placement === "TOP";

          const breakoutClass = isTop
            ? "relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen"
            : "";

          const PROMO_HEIGHT_TOP =
            "min-h-[75vh] md:min-h-[85vh]";

          const PROMO_HEIGHT_MID =
            "min-h-[45vh] md:min-h-[55vh]";

          const promoHeightClass = isTop
            ? PROMO_HEIGHT_TOP
            : PROMO_HEIGHT_MID;

          const CardInner = (
            <div
              className={
                "promo-enter group relative w-full overflow-hidden " +
                "bg-black transition-all duration-300"
              }
            >
              {/* Background image */}
              <div className="absolute inset-0">
                {promo.image ? (
                  <Image
                    src={promo.image}
                    alt={promo.alt_text || title || "Promo"}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.01]"
                    priority={false}
                  />
                ) : (
                  <div className="h-full w-full bg-neutral-900" />
                )}
              </div>

              {/* Banner-like overlay for readability */}
              <div
                className={`pointer-events-none ${HERO_OVERLAY_CLASS}`}
              />

              {/* Content */}
              <div className={`relative w-full ${promoHeightClass} flex items-end py-12 md:py-16`}>
                <div className={HERO_CONTAINER_CLASS}>
                  <div className="w-full">
                    {hasText ? (
                      <div>
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
                        {subtitle ? (
                          <p
                            className={
                              isTop
                                ? "mt-4 text-sm leading-relaxed text-white/80 md:text-base"
                                : "mt-2 text-sm text-white/80 md:text-base max-w-prose"
                            }
                          >
                            {subtitle}
                          </p>
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
                  aria-label={promo.cta_label?.trim() || `Ver más: ${title || "promo"}`}
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