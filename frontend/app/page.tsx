import { getHomepageBanners, getHomepageStory } from "@/lib/api";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { BrandStory } from "@/components/home/BrandStory";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const [banners, story] = await Promise.all([
    getHomepageBanners(),
    getHomepageStory(),
  ]);

  return (
    <>
      {/* FULL BLEED */}
      <HeroCarousel banners={banners} />

      {/* FULL WIDTH SECTION WITH EDITORIAL SPACING */}
      {story ? (
        <section className="py-12 md:py-20">
          <BrandStory story={story} />
        </section>
      ) : null}

      {/* Si luego agregas secciones con ancho controlado, envuélvelas así: */}
      {/* <div className="mx-auto max-w-6xl px-4 py-12 md:py-20">...</div> */}
    </>
  );
}
