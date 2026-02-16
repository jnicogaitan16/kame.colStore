import { getHomepageBanners, getHomepageStory } from "@/lib/api";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { BrandStory } from "@/components/home/BrandStory";
import HomepagePromos from "@/components/home/HomepagePromos";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const [banners, story] = await Promise.all([
    getHomepageBanners(),
    getHomepageStory(),
  ]);

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
        ) : null}
      </main>
    </>
  );
}
