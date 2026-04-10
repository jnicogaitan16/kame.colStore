import {
  getHomepageBanners,
  getHomepageMarqueeProducts,
  getHomepageStory,
} from "@/lib/api";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { BrandStory } from "@/components/home/BrandStory";
import HomeProductMarquee from "@/components/home/HomeProductMarquee";
import HomepagePromos from "@/components/home/HomepagePromos";
import HomeVisitTracker from "@/components/analytics/HomeVisitTracker";

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

export default async function HomePage() {
  const [bannersRes, storyRes, marqueeRes] = await Promise.allSettled([
    getHomepageBanners(),
    getHomepageStory(),
    getHomepageMarqueeProducts(),
  ]);

  const banners = bannersRes.status === "fulfilled" ? bannersRes.value : [];
  const story = storyRes.status === "fulfilled" ? storyRes.value : null;
  const marqueeProducts = marqueeRes.status === "fulfilled" ? marqueeRes.value : [];

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

    if (marqueeRes.status === "rejected") {
      logHomeDiagnostic("homepage marquee products request failed", {
        reason: marqueeRes.reason,
      });
    }

    if (bannersRes.status === "fulfilled" && (!Array.isArray(banners) || banners.length === 0)) {
      logHomeDiagnostic("homepage banners resolved with empty result");
    }

    if (storyRes.status === "fulfilled" && !story) {
      logHomeDiagnostic("homepage story resolved empty or unusable");
    }

    if (marqueeRes.status === "fulfilled" && (!Array.isArray(marqueeProducts) || marqueeProducts.length === 0)) {
      logHomeDiagnostic("homepage marquee products resolved with empty result");
    }

    const failedBlocks: string[] = [];
    if (bannersRes.status === "rejected") failedBlocks.push("hero:banners");
    if (marqueeRes.status === "rejected") failedBlocks.push("home:marquee");
    if (storyRes.status === "rejected") failedBlocks.push("brand-story");

    if (failedBlocks.length > 0) {
      logHomeDiagnostic("homepage rendered with partial block failures", {
        failedBlocks,
      });
    }
  }

  return (
    <div className="home-page" data-page-type="home">
      <HomeVisitTracker />

      {/* Home remains the controlled exception: it must start behind the fixed header instead of using the internal page shell offset. */}
      <HeroCarousel banners={banners} />


      <HomepagePromos placement="TOP" />

      <section className="sr-only" aria-label="Descripción de Kame.col">
        <h1>Kame.col</h1>
        <p>
          Kame.col es una marca de ropa urbana en Bogotá, Colombia, enfocada en diseño,
          calidad y detalle.
        </p>
      </section>

      <main className="home-editorial-shell mx-auto max-w-6xl px-4 md:px-6">
        <div className="home-editorial-flow">
          {marqueeProducts.length > 0 ? <HomeProductMarquee products={marqueeProducts} /> : null}
          <HomepagePromos placement="MID" />

          {story ? (
            <section aria-label="Nuestra historia">
              <BrandStory story={story} />
            </section>
          ) : storyRes.status === "fulfilled" && isDevEnvironment() ? (
            <section className="rounded-2xl border border-zinc-900/8 bg-white/78 p-4 text-sm text-zinc-600 shadow-[0_16px_40px_rgba(24,24,27,0.06)] backdrop-blur-sm">
              La API respondió sin historia usable desde <code className="text-zinc-900">/api/homepage-story/</code>. Crea al menos 1 sección activa en Django Admin →{" "}
              <span className="text-zinc-900">Secciones de Home</span>.
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
