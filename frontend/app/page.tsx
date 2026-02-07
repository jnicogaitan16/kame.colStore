import Link from "next/link";
import { getCategories, getProducts } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const [categories, productsRes] = await Promise.all([
    getCategories(),
    getProducts({ page_size: 8 }),
  ]);
  const featured = productsRes.results;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      {/* Hero */}
      <section className="mb-10 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-12 text-white md:mb-14 md:py-16">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
          Kame.col Store
        </h1>
        <p className="mt-3 max-w-xl text-lg text-brand-100 md:text-xl">
          Productos personalizados: camisetas, hoodies, mugs y más. Diseño único para ti.
        </p>
      </section>

      {/* Categorías */}
      <section className="mb-10 md:mb-14">
        <h2 className="mb-4 text-xl font-semibold text-slate-800 md:text-2xl">
          Categorías
        </h2>
        <div className="flex flex-wrap gap-2 md:gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/categoria/${cat.slug}`}
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-brand-100 hover:text-brand-800 md:px-5 md:py-2.5"
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </section>

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
