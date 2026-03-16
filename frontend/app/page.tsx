import { Suspense } from "react";
import { getHomepageBanners, getHomepagePromos, getHomepageStory } from "@/lib/api";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { BrandStory } from "@/components/home/BrandStory";
import HomepagePromos from "@/components/home/HomepagePromos";

export const revalidate = 300;

function isDevEnvironment(): boolean {
  return process.env.NODE_ENV !== "production";
}

function logHomeDiagnostic(message: string, extra?: Record<string, unknown>) {
  if (!isDevEnvironment()) return;
  if (extra) {
    console.warn(`[HomePage] ${message}`, extra);
    return;
  }
  console.warn(`[HomePage] ${message}`);
}

function extractArray<T>(res: any): T[] {
  if (Array.isArray(res)) return res as T[];
  if (Array.isArray(res?.results)) return res.results as T[];
  if (Array.isArray(res?.data)) return res.data as T[];
  if (Array.isArray(res?.promos)) return res.promos as T[];
  return [];
}

async function HomePromosProbe({ placement }: { placement: "TOP" | "MID" }) {
  if (!isDevEnvironment()) return null;

  try {
    const promos = extractArray(await getHomepagePromos(placement));
    if (promos.length === 0) {
      logHomeDiagnostic(`no promos returned for placement=${placement}`);
    }
  } catch (error) {
    logHomeDiagnostic(`promos probe failed for placement=${placement}`, {
      placement,
      error,
    });
  }

  return null;
}

export default async function HomePage() {
  const [bannersRes, storyRes] = await Promise.allSettled([
    getHomepageBanners(),
    getHomepageStory(),
  ]);

  const banners = bannersRes.status === "fulfilled" ? bannersRes.value : [];
  const story = storyRes.status === "fulfilled" ? storyRes.value : null;

  if (isDevEnvironment()) {
    if (bannersRes.status === "rejected") {
      logHomeDiagnostic("homepage banners request failed", {
        reason: bannersRes.reason,
      });
    }

    if (storyRes.status === "rejected") {
      logHomeDiagnostic("homepage story request failed", {
        reason: storyRes.reason,
      });
    }

    if (bannersRes.status === "fulfilled" && (!Array.isArray(banners) || banners.length === 0)) {
      logHomeDiagnostic("homepage banners resolved with empty result");
    }

    if (storyRes.status === "fulfilled" && !story) {
      logHomeDiagnostic("homepage story resolved empty or unusable");
    }

    const failedBlocks: string[] = [];
    if (bannersRes.status === "rejected") failedBlocks.push("hero:banners");
    if (storyRes.status === "rejected") failedBlocks.push("brand-story");

    if (failedBlocks.length > 0) {
      logHomeDiagnostic("homepage rendered with partial block failures", {
        failedBlocks,
      });
    }
  }

  return (
    <>
      {isDevEnvironment() ? (
        <>
          <Suspense fallback={null}>
            <HomePromosProbe placement="TOP" />
          </Suspense>
          <Suspense fallback={null}>
            <HomePromosProbe placement="MID" />
          </Suspense>
        </>
      ) : null}

      {/* Hero full-bleed */}
      <HeroCarousel banners={banners} />

      {/* Spacer between Hero and TOP promos */}
      <div className="h-10 md:h-14" />

      {/* PROMOS TOP (full-bleed, same level as Hero) */}
      <HomepagePromos placement="TOP" />

      {/* Spacer after TOP promos */}
      <div className="h-10 md:h-14" />

      {/* Content sections with consistent spacing */}
      <main className="mx-auto max-w-6xl space-y-10 px-4 py-10 md:space-y-14 md:py-14">
        {/* PROMOS (identity / gallery) */}
        <section>
          <HomepagePromos placement="MID" />
        </section>

        {story ? (
          <section>
            <BrandStory story={story} />
          </section>
        ) : process.env.NODE_ENV !== "production" ? (
          <section className="rounded-xl border border-white/10 bg-neutral-900/40 p-4 text-sm text-neutral-400">
            No llegó contenido de <code className="text-neutral-200">/api/home_sections/</code>. Revisa que exista al menos 1
            registro activo en Django Admin → <span className="text-neutral-200">Secciones de Home</span>.
          </section>
        ) : null}
      </main>
    </>
  );
}
