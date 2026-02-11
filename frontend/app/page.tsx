import Link from "next/link";
import { getCategories, getHomepageBanners, getProducts } from "@/lib/api";
import { ProductCard } from "@/components/product/ProductCard";
import { HeroCarousel } from "@/components/home/HeroCarousel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const [categories, productsRes, banners] = await Promise.all([
    getCategories(),
    getProducts({ page_size: 8 }),
    getHomepageBanners(),
  ]);
  const featured = productsRes.results;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      {/* Hero con carrusel de banners administrables */}
      <HeroCarousel banners={banners} />

      {/* Destacados */}
      <section>
        <div className="mb-4 flex items-center justify-between md:mb-6">
          <h2 className="text-xl font-semibold text-slate-800 md:text-2xl">
            Destacados
          </h2>
          {categories[0] && (
            <Link
              href={`/categoria/${categories[0].slug}`}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Ver todo
            </Link>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
