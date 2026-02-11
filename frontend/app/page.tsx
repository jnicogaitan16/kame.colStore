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
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      {/* Hero con carrusel de banners administrables */}
      <HeroCarousel banners={banners} />

      {/* Historia editable desde Django */}
      {story ? <BrandStory story={story} /> : null}
    </div>
  );
}
