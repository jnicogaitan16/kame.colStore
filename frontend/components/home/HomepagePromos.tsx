import Image from "next/image";
import Link from "next/link";

import { getHomepagePromos } from "@/lib/api";
import type { HomepagePromo } from "@/types/catalog";

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

export default async function HomepagePromos({ placement = "MID" }: { placement?: "TOP" | "MID" }) {
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

  const gridColsClass = getGridColsClass(list.length);

  return (
    <section className="mt-10">
      <div className={`grid grid-cols-1 gap-4 ${gridColsClass} md:gap-6`}>
        {list.map((promo) => {
          const href = normalizeHref(promo.cta_url);
          const hasCta = !!href;

          const title = (promo.title || "").trim();
          const subtitle = (promo.subtitle || "").trim();
          const hasText = !!title || !!subtitle;

          const CardInner = (
            <div
              className={
                "group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/60 " +
                "shadow-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-[1px] " +
                "hover:border-neutral-700"
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

              {/* Dark overlay for legibility (only when there's text) */}
              {hasText ? (
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
              ) : null}

              {/* Subtle border glow on hover (neutral, no blue) */}
              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <div className="absolute inset-0 ring-1 ring-neutral-700/70" />
              </div>

              {/* Content */}
              {hasText ? (
                <div className="relative flex min-h-[220px] flex-col justify-end p-5 md:min-h-[260px]">
                  <div>
                    {title ? (
                      <h3 className="text-lg font-semibold text-neutral-50 md:text-xl">
                        {title}
                      </h3>
                    ) : null}
                    {subtitle ? (
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-200/90">
                        {subtitle}
                      </p>
                    ) : null}
                  </div>

                  {hasCta ? (
                    <div className="mt-4">
                      <span
                        className={
                          "inline-flex items-center rounded-full border border-neutral-700 bg-black/40 " +
                          "px-4 py-2 text-sm font-medium text-neutral-100 backdrop-blur-sm " +
                          "transition-colors duration-200 group-hover:border-neutral-600"
                        }
                      >
                        {promo.cta_label?.trim() || "Ver más"}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );

          return (
            <div key={promo.id}>
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