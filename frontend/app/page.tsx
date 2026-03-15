import { getHomepageBanners, getHomepageStory } from "@/lib/api";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { BrandStory } from "@/components/home/BrandStory";
import HomepagePromos from "@/components/home/HomepagePromos";

export const revalidate = 300;

export default async function HomePage() {
  const [bannersRes, storyRes] = await Promise.allSettled([
    getHomepageBanners(),
    getHomepageStory(),
  ]);

  const banners = bannersRes.status === "fulfilled" ? bannersRes.value : [];
  const story = storyRes.status === "fulfilled" ? storyRes.value : null;

  return (
    <>
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
